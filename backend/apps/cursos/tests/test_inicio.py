"""Continuar a aprender e recomendações."""
import pytest

from apps.accounts.models import User
from apps.alunos.models import Aluno
from apps.cursos.models import Categoria, Curso, Inscricao
from apps.professores.models import PosicaoVisualizacao, Professor, Seguidor, Video, VisualizacaoVideo

pytestmark = pytest.mark.django_db


@pytest.fixture
def cenario(client):
    user = User.objects.create_user(username='aluno', password='SenhaForte123!', email='a@eyk.ao')
    aluno = Aluno.objects.create(profile=user)
    prof_user = User.objects.create_user(username='prof', password='SenhaForte123!', email='p@eyk.ao')
    prof = Professor.objects.create(user=prof_user, nome_publico='Maria Kiala')
    outro_user = User.objects.create_user(username='outro', password='SenhaForte123!', email='o@eyk.ao')
    outro = Professor.objects.create(user=outro_user, nome_publico='Bento')
    lga = Categoria.objects.create(nome='Saudações')
    curso = Curso.objects.create(titulo='LGA 1', descricao='d', professor=prof, categoria=lga)
    aulas = [Video.objects.create(titulo=f'Aula {i}', professor=prof, curso=curso, ordem=i, duracao_segundos=100) for i in range(4)]
    Inscricao.objects.create(aluno=aluno, curso=curso)
    client.force_login(user)
    return {'user': user, 'aluno': aluno, 'prof': prof, 'outro': outro, 'lga': lga, 'curso': curso, 'aulas': aulas}


def test_curso_em_andamento_com_progresso_real_e_ultima_aula(client, cenario):
    user, aulas = cenario['user'], cenario['aulas']
    VisualizacaoVideo.objects.create(video=aulas[0], utilizador=user)
    PosicaoVisualizacao.objects.create(video=aulas[1], utilizador=user, segundos=42)
    [c] = client.get('/api/inicio/continuar/').json()['cursos']
    assert c['progresso'] == 25 and (c['aulasVistas'], c['totalAulas']) == (1, 4)
    assert c['ultimaAula'] == {'id': aulas[1].id, 'titulo': 'Aula 1', 'segundos': 42, 'duracao': 100}


def test_sem_posicao_sugere_a_primeira_aula_por_ver(client, cenario):
    VisualizacaoVideo.objects.create(video=cenario['aulas'][0], utilizador=cenario['user'])
    [c] = client.get('/api/inicio/continuar/').json()['cursos']
    assert c['ultimaAula']['titulo'] == 'Aula 1' and c['ultimaAula']['segundos'] == 0


def test_curso_concluido_nao_aparece_e_video_a_meio_sim(client, cenario):
    Inscricao.objects.filter(curso=cenario['curso']).update(concluido=True)
    avulso = Video.objects.create(titulo='Avulso', professor=cenario['prof'], duracao_segundos=300)
    fim = Video.objects.create(titulo='Quase visto', professor=cenario['prof'], duracao_segundos=100)
    PosicaoVisualizacao.objects.create(video=avulso, utilizador=cenario['user'], segundos=120)
    PosicaoVisualizacao.objects.create(video=fim, utilizador=cenario['user'], segundos=95)
    r = client.get('/api/inicio/continuar/').json()
    assert r['cursos'] == [] and [v['titulo'] for v in r['videos']] == ['Avulso']


def test_recomendados_pela_categoria_e_por_quem_segues(client, cenario):
    mesma = Curso.objects.create(titulo='LGA 2', descricao='d', professor=cenario['outro'], categoria=cenario['lga'])
    Curso.objects.create(titulo='Outro tema', descricao='d', professor=cenario['outro'])
    Seguidor.objects.create(utilizador=cenario['user'], professor=cenario['prof'])
    v_seguido = Video.objects.create(titulo='Do prof seguido', professor=cenario['prof'])
    Video.objects.create(titulo='Qualquer', professor=cenario['outro'])
    r = client.get('/api/inicio/recomendados/').json()
    titulos = [c['titulo'] for c in r['cursos']]
    assert 'LGA 1' not in titulos  # já inscrito
    assert r['cursos'][0]['id'] == mesma.id and r['cursos'][0]['motivo'] == 'Porque aprendes Saudações'
    assert r['videos'][0]['id'] == v_seguido.id and r['videos'][0]['motivo'] == 'Porque segues Maria Kiala'
