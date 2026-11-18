"""O número de consultas à base de dados das listagens não cresce com o número de itens
(cada consulta é uma ida e volta ao PostgreSQL; com 50 publicações eram centenas)."""
import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.accounts.models import Notificacao
from apps.cursos.models import Curso, Inscricao
from apps.feed.models import Comentario, Post, ReacaoComentario, ReacaoPost
from apps.professores.models import ComentarioVideo, ReacaoComentarioVideo, Video


def _consultas(client, rota):
    with CaptureQueriesContext(connection) as q:
        assert client.get(rota).status_code == 200
    return len(q)


@pytest.fixture
def mundo(db, professor, professor_user, aluno_user, aluno):
    post = Post.objects.create(autor=professor_user, conteudo='p')
    video = Video.objects.create(professor=professor, titulo='v', url_externa='https://youtu.be/x', ativo=True)

    def mais(n):
        for i in range(n):
            curso = Curso.objects.create(professor=professor, titulo=f'c{i}', descricao='d', ativo=True)
            Inscricao.objects.create(curso=curso, aluno=aluno)
            Video.objects.create(professor=professor, curso=curso, titulo=f'a{i}', url_externa='https://youtu.be/x', ativo=True)
            p = Post.objects.create(autor=aluno_user, conteudo=f'p{i}')
            ReacaoPost.objects.create(post=p, utilizador=professor_user, tipo='like')
            Post.objects.create(autor=professor_user, conteudo='', repost_de=p)
            pai = Comentario.objects.create(post=post, autor=aluno_user, conteudo='c')
            Comentario.objects.create(post=post, autor=professor_user, conteudo='r', parent=pai)
            ReacaoComentario.objects.create(comentario=pai, utilizador=professor_user)
            cv = ComentarioVideo.objects.create(video=video, autor=aluno_user, conteudo='c')
            ComentarioVideo.objects.create(video=video, autor=professor_user, conteudo='r', parent=cv)
            ReacaoComentarioVideo.objects.create(comentario=cv, utilizador=professor_user)
            Notificacao.objects.create(utilizador=aluno_user, tipo='novidade', mensagem='x')

    return post, video, mais


@pytest.mark.parametrize('rota', [
    '/api/comunidade/posts/',
    '/api/comunidade/posts/{post}/comentarios/',
    '/api/videos/{video}/comentarios/',
    '/api/inicio/continuar/',
    '/api/cursos/',
    '/api/videos/',
    '/api/notificacoes/',
])
def test_consultas_nao_crescem_com_os_itens(client, aluno_user, mundo, rota):
    post, video, mais = mundo
    rota = rota.format(post=post.id, video=video.id)
    client.force_login(aluno_user)
    mais(2)
    poucos = _consultas(client, rota)
    mais(6)
    assert _consultas(client, rota) <= poucos + 1
