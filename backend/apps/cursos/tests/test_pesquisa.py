"""Pesquisa em toda a plataforma."""
import pytest

from apps.accounts.models import User
from apps.cursos.models import Categoria, Curso
from apps.feed.models import Post
from apps.professores.models import Professor, Video

pytestmark = pytest.mark.django_db


@pytest.fixture
def dados(client):
    aluno = User.objects.create_user(username='aluno', password='SenhaForte123!', email='a@eyk.ao')
    prof = User.objects.create_user(username='kiala', password='SenhaForte123!', email='p@eyk.ao', first_name='Maria', last_name='Kiala')
    professor = Professor.objects.create(user=prof)
    cat = Categoria.objects.create(nome='Saudações')
    Curso.objects.create(titulo='LGA para iniciantes', descricao='Alfabeto e números', professor=professor, categoria=cat)
    Curso.objects.create(titulo='Escondido', descricao='alfabeto', professor=professor, oculto=True)
    Video.objects.create(titulo='O alfabeto em gestos', professor=professor)
    Post.objects.create(autor=prof, conteudo='Hoje treinámos o alfabeto!')
    Post.objects.create(autor=prof, conteudo='alfabeto oculto', oculto=True)
    client.force_login(aluno)
    return client


def test_pesquisa_encontra_em_todos_os_tipos(dados):
    r = dados.get('/api/pesquisa/?q=alfabeto').json()
    assert [c['titulo'] for c in r['cursos']] == ['LGA para iniciantes']
    assert [v['titulo'] for v in r['videos']] == ['O alfabeto em gestos']
    assert len(r['posts']) == 1


def test_todas_as_palavras_contam_e_o_professor_tambem(dados):
    assert len(dados.get('/api/pesquisa/?q=kiala alfabeto').json()['cursos']) == 1
    assert dados.get('/api/pesquisa/?q=alfabeto inexistente').json()['cursos'] == []
    assert len(dados.get('/api/pesquisa/?q=saudações').json()['cursos']) == 1


def test_termo_curto_nao_pesquisa(dados):
    assert dados.get('/api/pesquisa/?q=a').json() == {'q': 'a', 'cursos': [], 'videos': [], 'posts': []}
