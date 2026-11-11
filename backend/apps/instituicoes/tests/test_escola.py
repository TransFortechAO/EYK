"""Membros, convites, pedidos, grupos, alunos e consentimentos: as regras valem no servidor."""
import json

import pytest
from django.core import mail

from apps.accounts.models import User
from apps.instituicoes.models import (
    Consentimento,
    ConviteInstituicao,
    GrupoInstituicao,
    Instituicao,
    MembroInstituicao,
    PerfilAluno,
    RegistoAuditoria,
)

pytestmark = pytest.mark.django_db


def _grupo(escola, *membros, nome='3.ª A'):
    g = GrupoInstituicao.objects.create(instituicao=escola, nome=nome)
    for m in membros:
        m.grupos.add(g)
    return g


def _conta(client, username='nova', email='nova@mail.ao'):
    user = User.objects.create_user(username=username, password='SenhaForte123!', email=email)
    client.force_login(user)
    return user


def _aceitar(client, codigo, **dados):
    return client.post(f'/api/instituicoes/convites/{codigo}/aceitar/', json.dumps(dados), content_type='application/json')


def test_quem_nao_pertence_nao_entra(api, pessoa, escola):
    outra = Instituicao.objects.create(
        nome='Outra', tipo='escola', provincia='Huambo', estado=Instituicao.ATIVA, responsavel_nome='B',
        responsavel_email='b@o.ao',
    )
    r = api.como(pessoa('administrador', outra)).get('membros/')
    assert r.status_code == 403 and r.json()['detail'] == 'Não pertences a esta instituição.'


def test_escola_suspensa_bloqueia_com_a_mensagem_certa(api, pessoa, escola):
    admin = pessoa('administrador')
    Instituicao.objects.filter(pk=escola.pk).update(estado=Instituicao.SUSPENSA)
    r = api.como(admin).get('membros/')
    assert r.status_code == 403 and 'suspenso' in r.json()['detail']


def test_nao_se_pode_ficar_sem_administrador(api, pessoa):
    admin = pessoa('administrador')
    api.como(admin)
    assert api.delete(f'membros/srv-{admin.pk}/').status_code == 400
    assert api.patch(f'membros/srv-{admin.pk}/', {'papel': 'educador'}).status_code == 400
    outro = pessoa('administrador')
    assert api.patch(f'membros/srv-{admin.pk}/', {'papel': 'educador'}).status_code == 200
    assert RegistoAuditoria.objects.filter(acao='papel_alterado').count() == 1
    assert outro.papel == 'administrador'


def test_so_quem_gere_altera_papeis(api, pessoa):
    educador, familia = pessoa('educador'), pessoa('familia')
    r = api.como(educador).patch(f'membros/srv-{familia.pk}/', {'papel': 'administrador'})
    assert r.status_code == 403 and r.json()['detail'] == 'O teu papel não permite esta ação.'


def test_remover_membro_tira_vinculos_de_tutor(api, pessoa, escola):
    admin, tutor = pessoa('administrador'), pessoa('familia')
    aluno = PerfilAluno.objects.create(instituicao=escola, nome='Kiala')
    aluno.tutores.add(tutor)
    assert api.como(admin).delete(f'membros/srv-{tutor.pk}/').status_code == 204
    assert not aluno.tutores.exists()
    assert tutor.pk not in [int(m['id'].removeprefix('srv-')) for m in api.get('membros/').json()]


def test_visibilidade_dos_membros(api, pessoa, escola):
    edu, colega, familia, longe = pessoa('educador'), pessoa('educador'), pessoa('familia'), pessoa('educador')
    _grupo(escola, edu, colega)
    ids = {m['id'] for m in api.como(edu).get('membros/').json()}
    assert ids == {f'srv-{edu.pk}', f'srv-{colega.pk}'}
    assert [m['id'] for m in api.como(familia).get('membros/').json()] == [f'srv-{familia.pk}']
    assert longe


def test_educador_so_convida_familias_e_alunos_para_os_seus_grupos(api, pessoa, escola):
    edu = pessoa('educador')
    meu, alheio = _grupo(escola, edu), _grupo(escola, nome='Outra')
    api.como(edu)
    r = api.post('convites/', {'canal': 'codigo', 'papel': 'educador'})
    assert r.json()['detail'] == 'Educadores só podem convidar famílias e alunos.'
    r = api.post('convites/', {'canal': 'codigo', 'papel': 'aluno', 'grupoId': f'srv-{alheio.pk}'})
    assert r.json()['detail'] == 'Só podes convidar para os teus grupos.'
    assert api.post('convites/', {'canal': 'codigo', 'papel': 'aluno', 'grupoId': f'srv-{meu.pk}'}).status_code == 201


def test_convite_por_email_sai_e_nao_ha_sms(api, pessoa):
    api.como(pessoa('administrador'))
    r = api.post('convites/', {'canal': 'email', 'destino': 'pai@mail.ao', 'papel': 'familia'})
    assert r.status_code == 201 and len(mail.outbox) == 1 and 'pai@mail.ao' in mail.outbox[0].to
    assert api.post('convites/', {'canal': 'sms', 'destino': '923 000 000', 'papel': 'familia'}).status_code == 400
    assert api.post('convites/', {'canal': 'email', 'destino': 'x', 'papel': 'familia'}).json()['detail'] == (
        'Email inválido.'
    )


def test_codigo_com_aprovacao_cria_pedido_e_nao_membro(client, api, pessoa, escola):
    admin = pessoa('administrador')
    g = _grupo(escola)
    codigo = api.como(admin).post(
        'convites/', {'canal': 'codigo', 'papel': 'aluno', 'grupoId': f'srv-{g.pk}', 'usosMax': 5},
    ).json()['codigo']
    user = _conta(client)
    assert _aceitar(client, codigo).json()['resultado'] == 'pendente'
    # Repetir não gasta outro uso nem duplica o pedido.
    assert _aceitar(client, codigo).json()['resultado'] == 'pendente'
    assert ConviteInstituicao.objects.get(codigo=codigo).usos == 1
    assert not escola.membros.filter(utilizador=user).exists()
    pedidos = api.como(admin).get('pedidos/').json()
    assert len(pedidos) == 1
    assert api.post(f'pedidos/{pedidos[0]["id"]}/decidir/', {'aprovar': True}).status_code == 200
    membro = escola.membros.get(utilizador=user)
    assert membro.papel == 'aluno' and membro.grupos.filter(pk=g.pk).exists()


def test_codigo_sem_aprovacao_entra_logo_e_respeita_o_limite(client, api, pessoa, escola):
    Instituicao.objects.filter(pk=escola.pk).update(aprovar_pedidos_por_codigo=False)
    codigo = api.como(pessoa('administrador')).post(
        'convites/', {'canal': 'codigo', 'papel': 'aluno', 'usosMax': 1},
    ).json()['codigo']
    _conta(client)
    assert _aceitar(client, codigo).json()['resultado'] == 'membro'
    _conta(client, 'outra', 'outra@mail.ao')
    r = _aceitar(client, codigo)
    assert r.status_code == 400 and 'máximo de utilizações' in r.json()['detail']


def test_limite_de_utilizadores(client, api, pessoa, escola):
    Instituicao.objects.filter(pk=escola.pk).update(aprovar_pedidos_por_codigo=False, utilizadores_max=1)
    codigo = api.como(pessoa('administrador')).post('convites/', {'canal': 'codigo', 'papel': 'aluno'}).json()['codigo']
    _conta(client)
    r = _aceitar(client, codigo)
    assert r.status_code == 400 and 'limite de utilizadores' in r.json()['detail']
    assert ConviteInstituicao.objects.get(codigo=codigo).usos == 0


def test_tutor_tem_de_consentir_e_o_historico_nao_se_apaga(client, api, pessoa, escola):
    admin = pessoa('administrador')
    aluno = PerfilAluno.objects.create(instituicao=escola, nome='Kiala')
    convite = api.como(admin).post(
        'convites/', {'canal': 'email', 'destino': 'mae@mail.ao', 'papel': 'familia', 'alunoId': f'srv-{aluno.pk}'},
    ).json()
    user = _conta(client, 'mae', 'mae@mail.ao')
    info = client.get(f'/api/instituicoes/convites/{convite["codigo"]}/').json()
    assert info['pedeConsentimento'] is True and info['aluno']['nome'] == 'Kiala'

    r = _aceitar(client, convite['codigo'], consentimentos={'utilizacao': False})
    assert r.status_code == 400 and 'Sem o consentimento' in r.json()['detail']
    assert not escola.membros.filter(utilizador=user).exists()

    assert _aceitar(client, convite['codigo'], consentimentos={'utilizacao': True}).status_code == 200
    aluno.refresh_from_db()
    assert aluno.estado == PerfilAluno.ATIVO
    tutor = escola.membros.get(utilizador=user)
    assert aluno.tutores.filter(pk=tutor.pk).exists()
    assert Consentimento.objects.filter(aluno=aluno).count() == 4

    # Retirar acrescenta um registo e desativa o perfil.
    api.como(tutor)
    corpo = {'alunoId': f'srv-{aluno.pk}', 'finalidade': 'utilizacao', 'aceite': False}
    assert api.post('consentimentos/', corpo).json()['estado'] == PerfilAluno.RETIRADO
    assert Consentimento.objects.filter(aluno=aluno, finalidade='utilizacao').count() == 2
    # A mesma decisão outra vez não cria registo.
    api.post('consentimentos/', corpo)
    assert Consentimento.objects.filter(aluno=aluno, finalidade='utilizacao').count() == 2


def test_so_o_tutor_da_crianca_decide(api, pessoa, escola):
    aluno = PerfilAluno.objects.create(instituicao=escola, nome='Kiala')
    r = api.como(pessoa('familia')).post(
        'consentimentos/', {'alunoId': f'srv-{aluno.pk}', 'finalidade': 'fotografias', 'aceite': True},
    )
    assert r.status_code == 403 and r.json()['detail'] == 'Só o tutor da criança pode decidir isto.'


def test_consentimentos_so_para_quem_pode(api, pessoa):
    assert api.como(pessoa('educador')).get('consentimentos/').status_code == 403
    assert api.como(pessoa('administrador')).get('consentimentos/').status_code == 200


def test_grupos_visiveis_e_geridos_por_quem_pertence(api, pessoa, escola):
    edu = pessoa('educador')
    alheio = _grupo(escola, nome='Alheio')
    api.como(edu)
    r = api.post('grupos/', {'nome': '4.ª B', 'tipo': 'turma', 'anoLetivo': '2026'})
    assert r.status_code == 201
    assert [g['nome'] for g in api.get('grupos/').json()] == ['4.ª B']
    assert api.patch(f'grupos/srv-{alheio.pk}/', {'arquivado': True}).status_code == 403
    assert api.post(f'grupos/srv-{alheio.pk}/membros/', {'membroId': f'srv-{edu.pk}', 'dentro': True}).status_code == 403
    assert api.post('alunos/', {'nome': 'Kiala', 'grupoId': f'srv-{alheio.pk}'}).status_code == 403


def test_alunos_visiveis_por_papel(api, pessoa, escola):
    edu, tutor, aluno_m = pessoa('educador'), pessoa('familia'), pessoa('aluno')
    g = _grupo(escola, edu)
    meu = PerfilAluno.objects.create(instituicao=escola, nome='Meu', grupo=g)
    PerfilAluno.objects.create(instituicao=escola, nome='Outro')
    filho = PerfilAluno.objects.create(instituicao=escola, nome='Filho')
    filho.tutores.add(tutor)
    assert [a['nome'] for a in api.como(edu).get('alunos/').json()] == [meu.nome]
    assert [a['nome'] for a in api.como(tutor).get('alunos/').json()] == ['Filho']
    assert api.como(aluno_m).get('alunos/').json() == []


def test_definicoes_so_para_administracao(api, pessoa):
    corpo = {'aprovarPedidosPorCodigo': False, 'escola': {'comunidadePublicaParaAlunos': True, 'rankingVisivel': False}}
    assert api.como(pessoa('educador')).patch('definicoes/', corpo).status_code == 403
    r = api.como(pessoa('administrador')).patch('definicoes/', corpo)
    assert r.json()['aprovarPedidosPorCodigo'] is False and r.json()['escola']['rankingVisivel'] is False


def test_minhas_devolve_o_membro_completo(client, pessoa, escola):
    edu = pessoa('educador')
    g = _grupo(escola, edu)
    client.force_login(edu.utilizador)
    [p] = client.get('/api/instituicoes/minhas/').json()
    assert p['instituicao']['id'] == f'srv-{escola.pk}'
    assert p['membro']['gruposIds'] == [f'srv-{g.pk}'] and p['membro']['email'] == edu.utilizador.email
    assert MembroInstituicao.objects.get(pk=edu.pk).ultimo_acesso is not None
