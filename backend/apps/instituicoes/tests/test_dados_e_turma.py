"""Exportar e eliminar dados; fotos, gostos e comentários na comunidade da turma."""
import io
import json
import zipfile

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.instituicoes.models import (
    AnexoEscola,
    Consentimento,
    GrupoInstituicao,
    Instituicao,
    MembroInstituicao,
    PedidoDados,
    PerfilAluno,
    RegistoAuditoria,
    RespostaVideo,
)

pytestmark = pytest.mark.django_db


def _turma(escola, *membros):
    t = GrupoInstituicao.objects.create(
        instituicao=escola, nome='LGA 1', tipo='turma_lga', lga_publico='ouvintes', lga_nivel='iniciacao',
    )
    for m in membros:
        m.grupos.add(t)
    return t


def _anexo(api, nome='v.mp4', tamanho=10):
    r = api.ficheiro('anexos/', {'ficheiro': SimpleUploadedFile(nome, b'0' * tamanho), 'duracaoSeg': '30'})
    assert r.status_code == 201, r.content
    return r.json()


def _crianca_com_resposta(api, pessoa, escola):
    """Criança com conta, tutor, consentimento e uma resposta em vídeo."""
    edu, aluno, tutor = pessoa('educador'), pessoa('aluno'), pessoa('familia')
    turma = _turma(escola, edu, aluno)
    perfil = PerfilAluno.objects.create(instituicao=escola, nome='Kiala', conta=aluno, estado=PerfilAluno.ATIVO)
    perfil.tutores.add(tutor)
    Consentimento.objects.create(
        instituicao=escola, aluno=perfil, tutor=tutor, tutor_nome='T', finalidade='respostas_video', aceite=True,
        versao_texto='1',
    )
    api.como(edu)
    aula = api.post(f'turmas/srv-{turma.pk}/aulas/', {
        'tipo': 'aula', 'titulo': 'A', 'videoId': _anexo(api)['id'], 'pedeResposta': True, 'enunciado': 'E',
    }).json()
    api.como(aluno)
    r = api.post(f'aulas/{aula["id"]}/respostas/', {'videoId': _anexo(api)['id']})
    assert r.status_code == 201, r.content
    return perfil, tutor, aluno


def _ler_zip(resposta):
    z = zipfile.ZipFile(io.BytesIO(b''.join(resposta.streaming_content)))
    return z, json.loads(z.read('dados.json'))


def test_tutor_exporta_e_descarrega_os_dados_da_crianca(api, client, pessoa, escola):
    perfil, tutor, _ = _crianca_com_resposta(api, pessoa, escola)
    r = api.como(tutor).post('pedidos-dados/', {'tipo': 'exportacao', 'ambito': 'crianca', 'alunoId': f'srv-{perfil.pk}'})
    assert r.status_code == 201
    p = r.json()
    assert p['estado'] == 'concluido' and p['ficheiroPronto'] is True and p['alvo'] == 'Kiala'
    resposta = client.get(p['url'])
    assert resposta.status_code == 200 and resposta['Content-Type'] == 'application/zip'
    z, dados = _ler_zip(resposta)
    assert dados['dados']['crianca']['nome'] == 'Kiala'
    assert len(dados['dados']['consentimentos']) == 1
    assert len([n for n in z.namelist() if n.startswith('videos/')]) == 1


def test_familia_so_pede_dados_das_suas_criancas(api, pessoa, escola):
    perfil = PerfilAluno.objects.create(instituicao=escola, nome='Outra')
    r = api.como(pessoa('familia')).post('pedidos-dados/', {'tipo': 'exportacao', 'ambito': 'crianca', 'alunoId': f'srv-{perfil.pk}'})
    assert r.status_code == 403
    r = api.post('pedidos-dados/', {'tipo': 'exportacao', 'ambito': 'instituicao'})
    assert r.status_code == 403


def test_outra_pessoa_nao_descarrega_a_copia(api, client, pessoa, escola):
    perfil, tutor, _ = _crianca_com_resposta(api, pessoa, escola)
    url = api.como(tutor).post(
        'pedidos-dados/', {'tipo': 'exportacao', 'ambito': 'crianca', 'alunoId': f'srv-{perfil.pk}'},
    ).json()['url']
    client.force_login(pessoa('familia').utilizador)
    assert client.get(url).status_code == 403


def test_exportacao_da_instituicao_nao_revela_codigos(api, client, pessoa, escola):
    admin = pessoa('administrador')
    api.como(admin).post('convites/', {'canal': 'codigo', 'papel': 'aluno'})
    url = api.post('pedidos-dados/', {'tipo': 'exportacao', 'ambito': 'instituicao'}).json()['url']
    _, dados = _ler_zip(client.get(url))
    assert dados['dados']['membros'][0]['email'] == admin.utilizador.email
    assert 'codigo' not in dados['dados']['convites'][0]


def test_eliminar_crianca_precisa_de_confirmacao_e_apaga_tudo(api, pessoa, escola):
    perfil, tutor, aluno = _crianca_com_resposta(api, pessoa, escola)
    admin = pessoa('administrador')
    r = api.como(tutor).post('pedidos-dados/', {'tipo': 'eliminacao', 'ambito': 'crianca', 'alunoId': f'srv-{perfil.pk}'})
    p = r.json()
    assert p['estado'] == 'em_curso' and p['ficheiroPronto'] is True
    # Pedir não apaga nada, e o tutor não confirma sozinho.
    assert PerfilAluno.objects.filter(pk=perfil.pk).exists()
    assert api.post(f'pedidos-dados/{p["id"]}/decidir/', {'aprovar': True}).status_code == 403

    r = api.como(admin).post(f'pedidos-dados/{p["id"]}/decidir/', {'aprovar': True})
    assert r.status_code == 200, r.content
    d = r.json()
    assert d['estado'] == 'concluido' and d['ficheiroPronto'] is False and d['alvo'] == 'Criança eliminada'
    assert not PerfilAluno.objects.filter(pk=perfil.pk).exists()
    assert not RespostaVideo.objects.exists() and not Consentimento.objects.exists()
    assert not MembroInstituicao.objects.filter(pk=aluno.pk).exists()
    assert not RegistoAuditoria.objects.filter(detalhe__contains='Kiala').exists()
    # A aula do professor continua.
    assert AnexoEscola.objects.count() == 1
    assert api.post(f'pedidos-dados/{p["id"]}/decidir/', {'aprovar': True}).status_code == 404


def test_eliminacao_recusada_nao_apaga(api, pessoa, escola):
    perfil, tutor, _ = _crianca_com_resposta(api, pessoa, escola)
    p = api.como(tutor).post('pedidos-dados/', {'tipo': 'eliminacao', 'ambito': 'crianca', 'alunoId': f'srv-{perfil.pk}'}).json()
    r = api.como(pessoa('administrador')).post(f'pedidos-dados/{p["id"]}/decidir/', {'aprovar': False})
    assert r.json()['estado'] == 'recusado' and r.json()['ficheiroPronto'] is False
    assert PerfilAluno.objects.filter(pk=perfil.pk).exists()


def test_eliminar_familia_desativa_a_crianca_sem_outro_tutor(api, pessoa, escola):
    perfil, tutor, _ = _crianca_com_resposta(api, pessoa, escola)
    p = api.como(tutor).post('pedidos-dados/', {'tipo': 'eliminacao', 'ambito': 'familia'}).json()
    assert api.como(pessoa('administrador')).post(f'pedidos-dados/{p["id"]}/decidir/', {'aprovar': True}).status_code == 200
    perfil.refresh_from_db()
    assert perfil.estado == PerfilAluno.RETIRADO
    assert not MembroInstituicao.objects.filter(pk=tutor.pk).exists()
    assert tutor.utilizador.__class__.objects.filter(pk=tutor.utilizador_id).exists()
    assert PedidoDados.objects.get().estado == 'concluido'


def test_ultimo_administrador_nao_se_elimina(api, pessoa):
    admin = pessoa('administrador')
    p = api.como(admin).post('pedidos-dados/', {'tipo': 'eliminacao', 'ambito': 'familia'}).json()
    r = api.post(f'pedidos-dados/{p["id"]}/decidir/', {'aprovar': True})
    assert r.status_code == 400 and 'pelo menos um administrador' in r.json()['detail']
    assert MembroInstituicao.objects.filter(pk=admin.pk).exists()
    assert PedidoDados.objects.get().estado == 'em_curso'


def test_eliminar_a_instituicao_e_so_com_a_equipa_eyk(api, client, pessoa, escola, django_user_model):
    _crianca_com_resposta(api, pessoa, escola)
    admin = pessoa('administrador')
    p = api.como(admin).post('pedidos-dados/', {'tipo': 'eliminacao', 'ambito': 'instituicao'}).json()
    assert api.post(f'pedidos-dados/{p["id"]}/decidir/', {'aprovar': True}).status_code == 403
    url = f'/api/instituicoes/admin/pedidos-dados/{p["id"]}/decidir/'
    assert client.post(url, '{"aprovar": true}', content_type='application/json').status_code == 403
    staff = django_user_model.objects.create_user(username='s', password='SenhaForte123!', is_staff=True)
    client.force_login(staff)
    [linha] = client.get('/api/instituicoes/admin/pedidos-dados/').json()
    assert linha['escola'] == escola.nome
    assert client.post(url, '{"aprovar": true}', content_type='application/json').status_code == 200
    assert not Instituicao.objects.filter(pk=escola.pk).exists()
    assert not AnexoEscola.objects.exists()


@pytest.fixture
def sala(pessoa, escola):
    edu, aluno, familia = pessoa('educador'), pessoa('aluno'), pessoa('familia')
    return edu, aluno, familia, _turma(escola, edu, aluno, familia)


def test_gostos_e_comentarios(api, sala):
    edu, aluno, familia, turma = sala
    url = f'turmas/srv-{turma.pk}/posts/'
    p = api.como(aluno).post(url, {'texto': 'Olá turma'}).json()
    assert (p['gostos'], p['comentarios'], p['gostei']) == (0, 0, False)
    api.como(familia)
    assert api.post(f'posts/{p["id"]}/gosto/').json() == {'gostei': True, 'gostos': 1}
    assert api.get(url).json()[0]['gostei'] is True
    assert api.post(f'posts/{p["id"]}/gosto/').json() == {'gostei': False, 'gostos': 0}
    # As famílias acompanham, mas não escrevem na turma.
    assert api.post(f'posts/{p["id"]}/comentarios/', {'texto': 'x'}).status_code == 403
    api.como(edu)
    c = api.post(f'posts/{p["id"]}/comentarios/', {'texto': 'Muito bem'}).json()
    assert api.como(familia).get(url).json()[0]['comentarios'] == 1
    r = api.como(aluno).post(f'posts/{p["id"]}/comentarios/', {'texto': 'vê http://x.ao'})
    assert 'não podem publicar links' in r.json()['detail']
    assert api.post(f'comentarios/{c["id"]}/denunciar/').status_code == 200
    assert api.como(familia).get(f'posts/{p["id"]}/comentarios/').json() == []
    assert len(api.como(edu).get(f'posts/{p["id"]}/comentarios/').json()) == 1
    assert api.post(f'comentarios/{c["id"]}/moderar/', {'visivel': True}).status_code == 200
    assert len(api.como(familia).get(f'posts/{p["id"]}/comentarios/').json()) == 1
    assert api.post(f'comentarios/{c["id"]}/moderar/', {'visivel': False}).status_code == 403


def test_quem_nao_e_da_turma_nao_ve_nem_reage(api, pessoa, sala):
    _, aluno, _, turma = sala
    p = api.como(aluno).post(f'turmas/srv-{turma.pk}/posts/', {'texto': 'Olá'}).json()
    api.como(pessoa('aluno'))
    assert api.post(f'posts/{p["id"]}/gosto/').status_code == 404
    assert api.get(f'posts/{p["id"]}/comentarios/').status_code == 404


def test_so_quem_ensina_publica_fotos(api, sala):
    edu, aluno, _, turma = sala
    url = f'turmas/srv-{turma.pk}/posts/'
    foto = _anexo(api.como(edu), 'a.jpg')['id']
    assert api.como(aluno).post(url, {'texto': 'x', 'fotoId': foto}).status_code == 403
    assert api.como(edu).post(url, {'texto': 'x', 'fotoId': _anexo(api, 'v.mp4')['id']}).json()['detail'] == 'Escolhe uma imagem.'
    grande = _anexo(api, 'g.jpg', 6 * 1024 * 1024)['id']
    assert 'até 5 MB' in api.post(url, {'fotoId': grande}).json()['detail']
    assert api.post(url, {'fotoId': foto}).json()['foto']['nome'] == 'a.jpg'


def test_foto_com_criancas_exige_consentimento_de_toda_a_turma(api, pessoa, escola, sala):
    edu, aluno, _, turma = sala
    perfil = PerfilAluno.objects.create(instituicao=escola, nome='Kiala', conta=aluno, estado=PerfilAluno.ATIVO)
    url = f'turmas/srv-{turma.pk}/posts/'
    foto = _anexo(api.como(edu), 'a.jpg')['id']
    r = api.post(url, {'fotoId': foto, 'temCriancas': True})
    assert r.status_code == 400 and 'Kiala' in r.json()['detail']
    Consentimento.objects.create(
        instituicao=escola, aluno=perfil, tutor=pessoa('familia'), tutor_nome='T', finalidade='fotografias', aceite=True,
        versao_texto='1',
    )
    assert api.post(url, {'fotoId': foto, 'temCriancas': True}).status_code == 201


def test_foto_so_abre_para_quem_e_da_turma(api, client, pessoa, sala):
    edu, aluno, _, turma = sala
    p = api.como(edu).post(f'turmas/srv-{turma.pk}/posts/', {'fotoId': _anexo(api, 'a.jpg')['id']}).json()
    client.force_login(aluno.utilizador)
    assert client.get(p['foto']['url']).status_code == 200
    client.force_login(pessoa('aluno').utilizador)
    assert client.get(p['foto']['url']).status_code == 403
