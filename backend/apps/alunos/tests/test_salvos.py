"""Salvos da plataforma pública."""
import json

import pytest

from apps.accounts.models import User
from apps.alunos.models import Salvo
from apps.cursos.models import Curso
from apps.feed.models import Post
from apps.professores.models import Professor, Video

pytestmark = pytest.mark.django_db


@pytest.fixture
def aluno(client):
    user = User.objects.create_user(username='aluno', password='SenhaForte123!', email='a@eyk.ao')
    client.force_login(user)
    return user


@pytest.fixture
def catalogo(db):
    prof_user = User.objects.create_user(username='prof', password='SenhaForte123!', email='p@eyk.ao')
    professor = Professor.objects.create(user=prof_user)
    curso = Curso.objects.create(titulo='LGA 1', descricao='d', professor=professor)
    video = Video.objects.create(titulo='Saudações', professor=professor)
    post = Post.objects.create(autor=prof_user, conteudo='Olá')
    return curso, video, post


def _alternar(client, tipo, pk):
    return client.post('/api/salvos/', json.dumps({'tipo': tipo, 'id': pk}), content_type='application/json')


def test_guardar_e_tirar(client, aluno, catalogo):
    curso, video, post = catalogo
    assert _alternar(client, 'curso', curso.pk).json() == {'salvo': True}
    assert _alternar(client, 'video', video.pk).json() == {'salvo': True}
    assert _alternar(client, 'post', post.pk).json() == {'salvo': True}
    assert set(client.get('/api/salvos/ids/').json()['ids']) == {f'curso:{curso.pk}', f'video:{video.pk}', f'post:{post.pk}'}
    d = client.get('/api/salvos/').json()
    assert [c['id'] for c in d['cursos']] == [curso.pk]
    assert [v['id'] for v in d['videos']] == [video.pk]
    assert [p['id'] for p in d['posts']] == [post.pk]
    assert _alternar(client, 'curso', curso.pk).json() == {'salvo': False}
    assert client.get('/api/salvos/').json()['cursos'] == []


def test_o_que_deixa_de_estar_disponivel_nao_aparece(client, aluno, catalogo):
    curso, video, post = catalogo
    for tipo, pk in (('curso', curso.pk), ('video', video.pk), ('post', post.pk)):
        _alternar(client, tipo, pk)
    Curso.objects.filter(pk=curso.pk).update(oculto=True)
    Video.objects.filter(pk=video.pk).update(oculto=True)
    Post.objects.filter(pk=post.pk).update(oculto=True)
    assert client.get('/api/salvos/').json() == {'cursos': [], 'videos': [], 'posts': []}
    assert _alternar(client, 'video', video.pk).status_code == 404


def test_salvos_sao_de_cada_pessoa(client, aluno, catalogo):
    Salvo.objects.create(utilizador=aluno, curso=catalogo[0])
    outro = User.objects.create_user(username='outro', password='SenhaForte123!', email='o@eyk.ao')
    client.force_login(outro)
    assert client.get('/api/salvos/ids/').json() == {'ids': []}


def test_pedido_invalido_e_sem_sessao(client, aluno, catalogo):
    assert _alternar(client, 'aula', 1).status_code == 400
    assert _alternar(client, 'curso', 'x').status_code == 404
    client.logout()
    assert client.get('/api/salvos/').status_code in (401, 403)
