from datetime import timedelta

import pytest
from django.utils import timezone

from apps.feed.models import Comentario, Post, ReacaoPost


@pytest.fixture
def post(db, aluno_user):
    return Post.objects.create(autor=aluno_user, conteudo="Olá comunidade!")


@pytest.mark.django_db
class TestPostModel:
    def test_str_inclui_username_do_autor(self, post):
        assert str(post) == "Post de aluno1"

    def test_total_likes_sem_reacoes(self, post):
        assert post.total_likes() == 0

    def test_total_likes_conta_apenas_tipo_like(self, post, aluno_user, professor_user):
        ReacaoPost.objects.create(post=post, utilizador=aluno_user, tipo="like")
        ReacaoPost.objects.create(post=post, utilizador=professor_user, tipo="dislike")
        assert post.total_likes() == 1

    def test_total_comentarios(self, post, aluno_user):
        Comentario.objects.create(post=post, autor=aluno_user, conteudo="Boa!")
        Comentario.objects.create(post=post, autor=aluno_user, conteudo="Concordo!")
        assert post.total_comentarios() == 2

    def test_ordering_mais_recente_primeiro(self, aluno_user):
        primeiro = Post.objects.create(autor=aluno_user, conteudo="primeiro")
        Post.objects.filter(pk=primeiro.pk).update(criado_em=timezone.now() - timedelta(minutes=1))
        segundo = Post.objects.create(autor=aluno_user, conteudo="segundo")
        assert list(Post.objects.all()) == [segundo, primeiro]


@pytest.mark.django_db
class TestReacaoPostModel:
    def test_utilizador_nao_pode_reagir_duas_vezes_ao_mesmo_post(self, post, aluno_user):
        ReacaoPost.objects.create(post=post, utilizador=aluno_user, tipo="like")
        with pytest.raises(Exception):
            ReacaoPost.objects.create(post=post, utilizador=aluno_user, tipo="like")
