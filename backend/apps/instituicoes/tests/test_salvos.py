"""Salvos da escola: o acesso volta a verificar-se ao listar."""
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.instituicoes.models import GrupoInstituicao, Instituicao, MembroInstituicao, SalvoEscola

pytestmark = pytest.mark.django_db


@pytest.fixture
def sala(pessoa, escola):
    edu, aluno = pessoa('educador'), pessoa('aluno')
    turma = GrupoInstituicao.objects.create(
        instituicao=escola, nome='LGA 1', tipo='turma_lga', lga_publico='ouvintes', lga_nivel='iniciacao',
    )
    edu.grupos.add(turma)
    aluno.grupos.add(turma)
    return edu, aluno, turma


def _itens(api, edu, turma, escola):
    api.como(edu)
    video = api.ficheiro('anexos/', {'ficheiro': SimpleUploadedFile('v.mp4', b'0'), 'duracaoSeg': '10'}).json()['id']
    aula = api.post(f'turmas/srv-{turma.pk}/aulas/', {'tipo': 'aula', 'titulo': 'Aula 1', 'videoId': video}).json()
    conteudo = api.post('conteudos/', {
        'tipo': 'video', 'titulo': 'Só a turma',
        'ambito': {'tipo': 'turma', 'instituicaoId': f'srv-{escola.pk}', 'turmaId': f'srv-{turma.pk}'},
    }).json()
    post = api.post(f'turmas/srv-{turma.pk}/posts/', {'texto': 'Olá'}).json()
    return aula['id'], conteudo['id'], post['id']


def test_guardar_listar_e_tirar(api, escola, sala):
    edu, aluno, turma = sala
    aula, conteudo, post = _itens(api, edu, turma, escola)
    api.como(aluno)
    assert api.post('salvos/', {'tipo': 'aula', 'id': aula}).json() == {'salvo': True}
    assert api.post('salvos/', {'tipo': 'conteudo', 'id': conteudo}).json() == {'salvo': True}
    assert api.post('salvos/', {'tipo': 'post_turma', 'id': post}).json() == {'salvo': True}
    assert set(api.get('salvos/ids/').json()['ids']) == {f'aula:{aula}', f'conteudo:{conteudo}', f'post_turma:{post}'}
    d = api.get('salvos/').json()
    assert d['aulas'][0]['turmaNome'] == 'LGA 1' and d['conteudos'][0]['titulo'] == 'Só a turma'
    assert d['posts'][0]['texto'] == 'Olá'
    assert api.post('salvos/', {'tipo': 'aula', 'id': aula}).json() == {'salvo': False}
    assert api.get('salvos/').json()['aulas'] == []


def test_nao_se_guarda_o_que_nao_se_ve(api, pessoa, escola, sala):
    edu, _, turma = sala
    aula, conteudo, post = _itens(api, edu, turma, escola)
    api.como(pessoa('aluno'))
    assert api.post('salvos/', {'tipo': 'aula', 'id': aula}).status_code == 404
    assert api.post('salvos/', {'tipo': 'conteudo', 'id': conteudo}).status_code == 404
    assert api.post('salvos/', {'tipo': 'post_turma', 'id': post}).status_code == 404
    assert not SalvoEscola.objects.exists()
    assert api.post('salvos/', {'tipo': 'outro', 'id': 'srv-1'}).status_code == 400


def test_quem_sai_da_turma_deixa_de_ver_o_que_guardou(api, escola, sala):
    edu, aluno, turma = sala
    aula, conteudo, post = _itens(api, edu, turma, escola)
    api.como(aluno)
    for tipo, item in (('aula', aula), ('conteudo', conteudo), ('post_turma', post)):
        api.post('salvos/', {'tipo': tipo, 'id': item})
    aluno.grupos.remove(turma)
    assert api.get('salvos/').json() == {'conteudos': [], 'aulas': [], 'posts': []}


def test_publicacao_escondida_sai_dos_salvos(api, escola, sala):
    edu, aluno, turma = sala
    _, _, post = _itens(api, edu, turma, escola)
    api.como(aluno).post('salvos/', {'tipo': 'post_turma', 'id': post})
    api.como(edu).post(f'posts/{post}/moderar/', {'visivel': False})
    assert api.como(aluno).get('salvos/').json()['posts'] == []


def test_salvos_nao_passam_de_uma_escola_para_outra(api, pessoa, escola, sala):
    edu, _, turma = sala
    aula, _, _ = _itens(api, edu, turma, escola)
    outra = Instituicao.objects.create(
        nome='Outra', tipo='escola', provincia='Huambo', estado=Instituicao.ATIVA, responsavel_nome='B',
        responsavel_email='b@o.ao',
    )
    fora: MembroInstituicao = pessoa('administrador', outra)
    r = api.client
    r.force_login(fora.utilizador)
    resposta = r.post(f'/api/instituicoes/srv-{outra.pk}/salvos/', {'tipo': 'aula', 'id': aula}, content_type='application/json')
    assert resposta.status_code == 404
