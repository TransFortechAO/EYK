"""Conquistas de aluno e de professor não se misturam."""
import pytest
from django.urls import reverse

from apps.accounts.models import User
from apps.gamificacao.models import AlunoBadge, Badge
from apps.gamificacao.services import progresso_badges, verificar_badges
from apps.professores.models import Professor, Video, VisualizacaoVideo

pytestmark = pytest.mark.django_db


@pytest.fixture
def badges(db):
    Badge.objects.all().delete()
    return {
        'aluno': Badge.objects.create(slug='primeira-aula', nome='Primeira aula', descricao='x', icone='PlayCircle', publico='aluno'),
        'todos': Badge.objects.create(slug='fiel-a-rotina', nome='Fiel', descricao='x', icone='Flame', publico='todos'),
        'professor': Badge.objects.create(slug='professor-popular', nome='Popular', descricao='x', icone='Eye', publico='professor'),
        'mentor': Badge.objects.create(slug='mentor', nome='Mentor', descricao='x', icone='Video', publico='professor'),
    }


def _ids(client, user):
    client.force_login(user)
    return {b['id'] for b in client.get(reverse('badges-list')).json()}


def test_aluno_so_ve_as_de_aluno_e_as_comuns(client, badges):
    aluno = User.objects.create_user(username='aluno', password='SenhaForte123!', email='a@eyk.ao')
    assert _ids(client, aluno) == {'primeira-aula', 'fiel-a-rotina'}


def test_professor_so_ve_as_de_professor_e_as_comuns(client, badges):
    prof = User.objects.create_user(username='prof', password='SenhaForte123!', email='p@eyk.ao', is_teacher=True)
    assert _ids(client, prof) == {'professor-popular', 'mentor', 'fiel-a-rotina'}


def test_professor_ganha_as_suas_e_nao_as_de_aluno(badges):
    prof = User.objects.create_user(username='prof', password='SenhaForte123!', email='p@eyk.ao', is_teacher=True)
    professor = Professor.objects.create(user=prof, nome_publico='Prof')
    espectador = User.objects.create_user(username='v', password='SenhaForte123!', email='v@eyk.ao')
    videos = [Video.objects.create(titulo=f'V{i}', professor=professor) for i in range(10)]
    VisualizacaoVideo.objects.create(video=videos[0], utilizador=espectador, count=500)
    # Mesmo que o professor veja um vídeo, não ganha a conquista de aluno.
    VisualizacaoVideo.objects.create(video=videos[1], utilizador=prof, count=1)
    verificar_badges(prof)
    ganhas = set(AlunoBadge.objects.filter(utilizador=prof).values_list('badge__slug', flat=True))
    assert ganhas == {'professor-popular', 'mentor'}
    assert 'primeira-aula' not in progresso_badges(prof)


def test_perfil_nao_mostra_conquista_do_outro_papel(client, badges):
    prof = User.objects.create_user(username='prof', password='SenhaForte123!', email='p@eyk.ao', is_teacher=True)
    AlunoBadge.objects.create(utilizador=prof, badge=badges['aluno'])
    AlunoBadge.objects.create(utilizador=prof, badge=badges['mentor'])
    from apps.accounts.perfis import _conquistas

    assert [c['id'] for c in _conquistas(prof)] == ['mentor']
