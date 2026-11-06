"""Ensino de LGA: as regras de privacidade e de âmbito valem no servidor."""
import datetime

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.instituicoes.models import (
    AnexoEscola,
    Aula,
    Consentimento,
    ConviteInstituicao,
    GrupoInstituicao,
    Instituicao,
    PerfilAluno,
    RespostaVideo,
)
from apps.instituicoes.tasks import apagar_respostas_expiradas, enviar_lembretes_eventos

pytestmark = pytest.mark.django_db


def _turma(escola, *membros, publico='ouvintes'):
    t = GrupoInstituicao.objects.create(
        instituicao=escola, nome='LGA 1', tipo='turma_lga', lga_publico=publico, lga_nivel='iniciacao',
    )
    for m in membros:
        m.grupos.add(t)
    return t


def _anexo(api, nome='v.mp4', duracao='30'):
    r = api.ficheiro('anexos/', {'ficheiro': SimpleUploadedFile(nome, b'0123456789'), 'duracaoSeg': duracao})
    assert r.status_code == 201, r.content
    return r.json()


def _aula(api, turma, **extra):
    corpo = {
        'tipo': 'aula', 'titulo': 'Saudações', 'videoId': _anexo(api)['id'], 'pedeResposta': True,
        'enunciado': 'Apresenta-te', **extra,
    }
    r = api.post(f'turmas/srv-{turma.pk}/aulas/', corpo)
    assert r.status_code == 201, r.content
    return r.json()


def _responder(api, aula_id):
    return api.post(f'aulas/{aula_id}/respostas/', {'videoId': _anexo(api)['id']})


@pytest.fixture
def sala(pessoa, escola):
    edu, aluno = pessoa('educador'), pessoa('aluno')
    return edu, aluno, _turma(escola, edu, aluno)


def test_criar_turma_gera_codigos_do_ano_letivo(api, pessoa, escola):
    admin = pessoa('administrador')
    r = api.como(admin).post('turmas/', {'nome': 'LGA', 'publico': 'ouvintes', 'nivel': 'iniciacao', 'anoLetivo': '2026'})
    assert r.status_code == 201
    assert ConviteInstituicao.objects.filter(grupo__nome='LGA', canal='codigo', usos_max=60).count() == 2
    assert api.como(pessoa('familia')).post('turmas/', {'nome': 'X'}).status_code == 403


def test_turma_so_para_quem_pertence(api, pessoa, sala):
    _, aluno, turma = sala
    assert api.como(aluno).get(f'turmas/srv-{turma.pk}/').status_code == 200
    r = api.como(pessoa('aluno')).get(f'turmas/srv-{turma.pk}/')
    assert r.status_code == 403 and r.json()['detail'] == 'Não pertences a esta turma.'
    assert api.get('turmas/').json() == []


def test_educador_de_outra_turma_nao_publica(api, pessoa, sala):
    _, _, turma = sala
    api.como(pessoa('educador'))
    r = api.post(f'turmas/srv-{turma.pk}/aulas/', {'tipo': 'aula', 'titulo': 'X'})
    assert r.status_code == 403 and 'ensina nesta turma' in r.json()['detail']


def test_aula_precisa_de_video_proprio(api, pessoa, sala):
    edu, _, turma = sala
    colega = pessoa('educador')
    colega.grupos.add(turma)
    alheio = _anexo(api.como(colega))['id']
    r = api.como(edu).post(f'turmas/srv-{turma.pk}/aulas/', {'tipo': 'aula', 'titulo': 'X', 'videoId': alheio})
    assert r.status_code == 400 and 'Anexo inválido' in r.json()['detail']
    r = api.post(f'turmas/srv-{turma.pk}/aulas/', {'tipo': 'aula', 'titulo': 'X'})
    assert r.json()['detail'] == 'Carrega o vídeo sinalizado da aula.'


def test_video_da_crianca_so_para_professor_proprio_e_familia(api, client, pessoa, escola, sala):
    edu, aluno, turma = sala
    aula = _aula(api.como(edu), turma)
    r = _responder(api.como(aluno), aula['id'])
    assert r.status_code == 201
    url = r.json()['video']['url']

    tutor = pessoa('familia')
    perfil = PerfilAluno.objects.create(instituicao=escola, nome='K', conta=aluno, estado=PerfilAluno.ATIVO)
    perfil.tutores.add(tutor)

    client.force_login(edu.utilizador)
    assert client.get(url).status_code == 200
    client.force_login(tutor.utilizador)
    assert client.get(url).status_code == 200
    assert len(api.como(tutor).get('respostas/').json()) == 1
    # O administrador abre turmas, mas não vê os vídeos das crianças.
    admin = pessoa('administrador')
    client.force_login(admin.utilizador)
    assert client.get(url).status_code == 403
    assert api.como(admin).get('respostas/').json() == []
    # Nem o coordenador, nem outro aluno da turma, nem outro tutor.
    coordenador, colega, outro_tutor = pessoa('coordenador'), pessoa('aluno'), pessoa('familia')
    colega.grupos.add(turma)
    for quem in (coordenador, colega, outro_tutor):
        client.force_login(quem.utilizador)
        assert client.get(url).status_code == 403


def test_anexo_de_outra_escola_nao_abre(api, client, pessoa, escola, sala):
    edu, _, turma = sala
    aula = _aula(api.como(edu), turma)
    outra = Instituicao.objects.create(
        nome='Outra', tipo='escola', provincia='Huambo', estado=Instituicao.ATIVA, responsavel_nome='B',
        responsavel_email='b@o.ao',
    )
    fora = pessoa('administrador', outra)
    anexo = aula['video']['url'].split('/anexos/')[1]
    client.force_login(fora.utilizador)
    assert client.get(f'/api/instituicoes/srv-{outra.pk}/anexos/{anexo}').status_code == 403


def test_resposta_regras_e_pontos(api, pessoa, escola, sala):
    edu, aluno, turma = sala
    aula = _aula(api.como(edu), turma)
    api.como(aluno)
    rid = _responder(api, aula['id']).json()['id']
    assert _responder(api, aula['id']).json()['detail'] == 'A tua resposta ainda está à espera do professor.'
    api.como(edu)
    assert api.post(f'respostas/{rid}/feedback/', {'estado': 'repetir'}).json()['detail'] == (
        'Explica ao aluno o que deve corrigir.'
    )
    assert api.post(f'respostas/{rid}/feedback/', {'estado': 'repetir', 'texto': 'Mais devagar'}).status_code == 200
    api.como(aluno)
    novo = _responder(api, aula['id'])
    assert novo.json()['tentativa'] == 2
    api.como(edu).post(f'respostas/{novo.json()["id"]}/feedback/', {'estado': 'correto', 'texto': ''})
    api.post(f'respostas/{novo.json()["id"]}/feedback/', {'estado': 'correto', 'texto': ''})
    aluno.refresh_from_db()
    assert aluno.pontos == 10
    assert _responder(api.como(aluno), aula['id']).json()['detail'] == 'Esta resposta já está correta.'


def test_duracao_maxima_da_resposta(api, sala):
    edu, aluno, turma = sala
    aula = _aula(api.como(edu), turma)
    api.como(aluno)
    longo = _anexo(api, duracao='120')['id']
    r = api.post(f'aulas/{aula["id"]}/respostas/', {'videoId': longo})
    assert 'até 90 segundos' in r.json()['detail']


def test_consentimento_de_video_e_exigido_a_crianca_com_perfil(api, pessoa, escola, sala):
    edu, aluno, turma = sala
    aula = _aula(api.como(edu), turma)
    perfil = PerfilAluno.objects.create(instituicao=escola, nome='K', conta=aluno, estado=PerfilAluno.ATIVO)
    assert api.como(aluno).get('respostas/pode/').json()['pode'] is False
    r = _responder(api, aula['id'])
    assert r.status_code == 403 and 'ainda não autorizou' in r.json()['detail']
    tutor = pessoa('familia')
    Consentimento.objects.create(
        instituicao=escola, aluno=perfil, tutor=tutor, tutor_nome='T', finalidade='respostas_video', aceite=True,
        versao_texto='1',
    )
    assert _responder(api, aula['id']).status_code == 201


def test_ligar_conta_ao_perfil(api, pessoa, escola):
    admin, aluno, familia = pessoa('administrador'), pessoa('aluno'), pessoa('familia')
    perfil = PerfilAluno.objects.create(instituicao=escola, nome='K')
    outro = PerfilAluno.objects.create(instituicao=escola, nome='L')
    api.como(admin)
    assert api.patch(f'alunos/srv-{perfil.pk}/conta/', {'contaId': f'srv-{familia.pk}'}).status_code == 400
    assert api.patch(f'alunos/srv-{perfil.pk}/conta/', {'contaId': f'srv-{aluno.pk}'}).json()['contaId'] == f'srv-{aluno.pk}'
    r = api.patch(f'alunos/srv-{outro.pk}/conta/', {'contaId': f'srv-{aluno.pk}'})
    assert r.json()['detail'] == 'Esta conta já está ligada a outra criança.'


def test_gestos_propostos_e_validacao(api, client, pessoa, escola):
    edu, outro, familia = pessoa('educador'), pessoa('educador'), pessoa('familia')
    api.como(edu)
    g = api.post('gestos/', {'palavra': 'Recreio', 'tema': 'escola', 'descricao': 'Mãos a correr'}).json()
    assert api.como(familia).get('gestos/').json() == []
    api.como(edu)
    r = api.post(f'gestos/{g["id"]}/validar/', {'aprovar': True})
    assert r.json()['detail'] == 'Outra pessoa tem de validar o gesto que propuseste.'
    api.como(outro)
    assert 'porque rejeitas' in api.post(f'gestos/{g["id"]}/validar/', {'aprovar': False}).json()['detail']
    assert api.post(f'gestos/{g["id"]}/validar/', {'aprovar': True}).json()['estado'] == 'validado'
    assert [x['palavra'] for x in api.como(familia).get('gestos/').json()] == ['Recreio']
    client.force_login(familia.utilizador)
    assert len(client.get('/api/instituicoes/gestos-validados/').json()) == 1


def test_pratica_mestria_e_desafio(api, pessoa, escola, sala):
    edu, aluno, turma = sala
    d = api.como(edu).post('desafios/', {
        'titulo': '2 letras', 'turmaId': f'srv-{turma.pk}', 'competencia': 'alfabeto', 'tema': None, 'meta': 2,
        'recompensa': 5, 'dias': 7,
    })
    assert d.status_code == 201
    api.como(aluno)
    pratica = {'competencia': 'alfabeto', 'tema': 'alfabeto', 'certo': True}
    assert api.post('pratica/', pratica).json() == {'pontos': 2, 'desafiosConcluidos': []}
    r = api.post('pratica/', pratica).json()
    assert r['pontos'] == 7 and len(r['desafiosConcluidos']) == 1
    # Só conta uma vez.
    assert api.post('pratica/', pratica).json()['pontos'] == 2
    p = api.get('progresso/').json()
    assert p['pontos'] == 11 and p['competencias']['alfabeto'] == {'mestria': 100, 'nivel': 'a_progredir', 'tentativas': 3}
    [visto] = api.get('desafios/').json()
    assert visto['concluido'] is True and visto['turmaNome'] == turma.nome
    assert api.get(f'turmas/srv-{turma.pk}/progresso/').status_code == 403
    assert api.como(edu).get(f'turmas/srv-{turma.pk}/progresso/').json()['media']['alfabeto'] == 100


def test_desafio_regras(api, pessoa):
    api.como(pessoa('administrador'))
    base = {'titulo': 'X', 'competencia': 'vocabulario', 'meta': 5, 'dias': 3}
    assert 'entre 1 e 200' in api.post('desafios/', {**base, 'meta': 500}).json()['detail']
    assert 'não pertence' in api.post('desafios/', {**base, 'tema': 'alfabeto'}).json()['detail']


def test_conteudo_por_ambito_e_vistas(api, pessoa, escola, sala):
    edu, aluno, turma = sala
    corpo = {
        'tipo': 'video', 'titulo': 'Só a turma', 'descricao': '', 'duracaoMin': 5, 'aulas': 1,
        'ambito': {'tipo': 'turma', 'instituicaoId': f'srv-{escola.pk}', 'turmaId': f'srv-{turma.pk}'},
    }
    c = api.como(edu).post('conteudos/', corpo).json()
    fora = pessoa('aluno')
    assert api.como(fora).get('conteudos/').json() == []
    assert api.get(f'conteudos/{c["id"]}/').status_code == 403
    assert api.como(aluno).get(f'conteudos/{c["id"]}/').json()['vistas'] == 1
    outro_edu = pessoa('educador')
    assert api.como(outro_edu).post('conteudos/', corpo).status_code == 403


def test_proposta_para_a_plataforma_geral(api, client, pessoa, escola, django_user_model):
    admin = pessoa('administrador')
    corpo = {
        'tipo': 'curso', 'titulo': 'Curso', 'ambito': {'tipo': 'instituicao', 'instituicaoId': f'srv-{escola.pk}'},
    }
    c = api.como(admin).post('conteudos/', corpo).json()
    assert api.post(f'conteudos/{c["id"]}/propor/').json()['propostaPublica'] == 'pendente'
    assert api.post(f'conteudos/{c["id"]}/propor/').json()['detail'] == 'Já foi proposto.'
    assert client.get('/api/instituicoes/admin/propostas/').status_code == 403
    staff = django_user_model.objects.create_user(username='s', password='SenhaForte123!', is_staff=True)
    client.force_login(staff)
    [p] = client.get('/api/instituicoes/admin/propostas/').json()
    assert p['escola'] == escola.nome
    r = client.post(f'/api/instituicoes/admin/propostas/{c["id"]}/', '{"aceitar": true}', content_type='application/json')
    assert r.status_code == 200
    assert client.get('/api/instituicoes/admin/propostas/').json() == []


def test_comunidade_da_turma(api, pessoa, sala):
    edu, aluno, turma = sala
    url = f'turmas/srv-{turma.pk}/posts/'
    api.como(aluno)
    assert 'não podem publicar links' in api.post(url, {'texto': 'vê http://x.ao'}).json()['detail']
    p = api.post(url, {'texto': 'Olá turma'}).json()
    colega = pessoa('aluno')
    colega.grupos.add(turma)
    assert api.como(colega).post(f'posts/{p["id"]}/denunciar/').status_code == 200
    assert api.get(url).json() == []
    assert api.como(aluno).get(url).json()[0]['estado'] == 'denunciado'
    assert len(api.como(edu).get(url).json()) == 1
    assert api.post(f'posts/{p["id"]}/moderar/', {'visivel': True}).status_code == 200
    assert api.como(colega).get(url).json()[0]['estado'] == 'visivel'
    assert api.post(url, {'texto': 'x' * 501}).json()['detail'] == 'No máximo 500 caracteres.'


def test_classificacao_respeita_a_definicao(api, pessoa, escola):
    aluno = pessoa('aluno')
    assert api.como(aluno).get('classificacao/').json()['participantes'] == 1
    Instituicao.objects.filter(pk=escola.pk).update(ranking_visivel=False)
    assert api.get('classificacao/').json()['detail'] == 'A escola desligou as classificações.'


def test_ver_plataforma_geral(api, pessoa):
    aluno = pessoa('aluno')
    assert api.como(aluno).get('ver-geral/').json() == {'ver': False}
    r = api.client.put(api._url('ver-geral/'), '{"ver": true}', content_type='application/json')
    assert r.json() == {'ver': True}
    assert api.como(pessoa('educador')).get('ver-geral/').json() == {'ver': True}


def test_resumo_da_escola(api, pessoa, escola, sala):
    edu, aluno, turma = sala
    _aula(api.como(edu), turma)
    r = api.como(aluno).get('resumo/').json()
    assert [t['estado'] for t in r['tarefas']] == ['por_fazer'] and len(r['aulasNovas']) == 1
    aula = Aula.objects.get()
    _responder(api, f'srv-{aula.pk}')
    assert api.como(edu).get('resumo/').json()['porRever'] == 1


def test_lembrete_sai_uma_so_vez(api, pessoa, escola):
    admin = pessoa('administrador')
    inicio = timezone.now() + datetime.timedelta(minutes=30)
    api.como(admin).post('eventos/', {
        'titulo': 'Festa', 'inicio': inicio.isoformat(), 'destinatarios': {'tipo': 'instituicao'}, 'lembretes': ['1h', '1d'],
    })
    assert enviar_lembretes_eventos() == 2
    assert enviar_lembretes_eventos() == 0


def test_respostas_expiradas_sao_apagadas_com_o_video(api, sala):
    edu, aluno, turma = sala
    aula = _aula(api.como(edu), turma)
    _responder(api.como(aluno), aula['id'])
    RespostaVideo.objects.update(apagar_em=timezone.now() - datetime.timedelta(days=1))
    antes = AnexoEscola.objects.count()
    assert apagar_respostas_expiradas() == 1
    assert not RespostaVideo.objects.exists() and AnexoEscola.objects.count() == antes - 1
