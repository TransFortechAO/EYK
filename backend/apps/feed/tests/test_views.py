import json

import pytest
from django.urls import reverse

from apps.feed.models import Comentario, Post, ReacaoComentario, ReacaoPost


@pytest.fixture
def post(db, aluno_user):
    return Post.objects.create(autor=aluno_user, conteudo="Olá comunidade!")


@pytest.fixture
def comentario(db, post, professor_user):
    return Comentario.objects.create(post=post, autor=professor_user, conteudo="Boa partilha!")


def _post_json(client, url_name, args, data):
    return client.post(reverse(url_name, args=args), data=json.dumps(data), content_type="application/json")


def _patch_json(client, url_name, args, data):
    return client.patch(reverse(url_name, args=args), data=json.dumps(data), content_type="application/json")


@pytest.mark.django_db
class TestPostReact:
    def test_reagir_cria_like_e_reagir_de_novo_remove(self, client, aluno_user, post):
        client.force_login(aluno_user)

        r1 = client.post(reverse("api-post-react", args=[post.id]))
        assert r1.status_code == 200
        assert r1.json() == {"liked": True, "likes": 1}
        assert ReacaoPost.objects.filter(post=post, utilizador=aluno_user).exists()

        r2 = client.post(reverse("api-post-react", args=[post.id]))
        assert r2.status_code == 200
        assert r2.json() == {"liked": False, "likes": 0}
        assert not ReacaoPost.objects.filter(post=post, utilizador=aluno_user).exists()

    def test_reagir_a_post_inexistente_404(self, client, aluno_user):
        client.force_login(aluno_user)
        response = client.post(reverse("api-post-react", args=[999999]))
        assert response.status_code == 404

    def test_exige_autenticacao(self, client, post):
        response = client.post(reverse("api-post-react", args=[post.id]))
        assert response.status_code in (401, 403)


@pytest.mark.django_db
class TestComentarios:
    def test_lista_e_cria_comentario(self, client, aluno_user, professor_user, post):
        client.force_login(professor_user)
        r_vazio = client.get(reverse("api-comentario-list", args=[post.id]))
        assert r_vazio.status_code == 200
        assert r_vazio.json() == []

        r_criar = _post_json(client, "api-comentario-list", [post.id], {"conteudo": "Parabéns!"})
        assert r_criar.status_code == 201
        body = r_criar.json()
        assert body["conteudo"] == "Parabéns!"
        assert body["autor_nome"]
        assert Comentario.objects.filter(post=post, autor=professor_user, conteudo="Parabéns!").exists()

        r_lista = client.get(reverse("api-comentario-list", args=[post.id]))
        assert r_lista.status_code == 200
        assert len(r_lista.json()) == 1

    def test_comentario_vazio_e_rejeitado(self, client, aluno_user, post):
        client.force_login(aluno_user)
        response = _post_json(client, "api-comentario-list", [post.id], {"conteudo": "   "})
        assert response.status_code == 400
        assert not Comentario.objects.filter(post=post).exists()


@pytest.mark.django_db
class TestRespostasComentario:
    def test_responder_a_comentario_fica_aninhado_na_resposta(self, client, aluno_user, post, comentario):
        client.force_login(aluno_user)
        response = _post_json(
            client, "api-comentario-list", [post.id], {"conteudo": "Concordo!", "parent": comentario.id},
        )
        assert response.status_code == 201
        resposta_id = response.json()["id"]
        assert Comentario.objects.get(id=resposta_id).parent_id == comentario.id

        r_lista = client.get(reverse("api-comentario-list", args=[post.id]))
        corpo = r_lista.json()
        # A resposta não aparece como comentário de topo — só aninhada.
        assert len(corpo) == 1
        assert corpo[0]["id"] == comentario.id
        assert len(corpo[0]["respostas"]) == 1
        assert corpo[0]["respostas"][0]["id"] == resposta_id
        assert corpo[0]["respostas"][0]["conteudo"] == "Concordo!"

    def test_responder_a_uma_resposta_fica_achatado_no_mesmo_nivel(self, client, aluno_user, professor_user, post, comentario):
        client.force_login(aluno_user)
        r1 = _post_json(
            client, "api-comentario-list", [post.id], {"conteudo": "Resposta 1", "parent": comentario.id},
        )
        resposta1_id = r1.json()["id"]

        client.force_login(professor_user)
        r2 = _post_json(
            client, "api-comentario-list", [post.id], {"conteudo": "Resposta 2", "parent": resposta1_id},
        )
        assert r2.status_code == 201
        resposta2_id = r2.json()["id"]
        # Mesmo respondendo à resposta 1, fica no mesmo nível (filha direta
        # do comentário original), não 3 níveis de profundidade.
        assert Comentario.objects.get(id=resposta2_id).parent_id == comentario.id

    def test_responder_a_comentario_de_outro_post_404(self, client, aluno_user, comentario):
        outro_post = Post.objects.create(autor=aluno_user, conteudo="Outro post")
        client.force_login(aluno_user)
        response = _post_json(
            client, "api-comentario-list", [outro_post.id], {"conteudo": "x", "parent": comentario.id},
        )
        assert response.status_code == 404


@pytest.mark.django_db
class TestComentarioReagir:
    def test_reagir_cria_like_e_reagir_de_novo_remove(self, client, aluno_user, post, comentario):
        client.force_login(aluno_user)

        r1 = client.post(reverse("api-comentario-reagir", args=[post.id, comentario.id]))
        assert r1.status_code == 200
        assert r1.json() == {"liked": True, "totalLikes": 1}
        assert ReacaoComentario.objects.filter(comentario=comentario, utilizador=aluno_user).exists()

        r2 = client.post(reverse("api-comentario-reagir", args=[post.id, comentario.id]))
        assert r2.status_code == 200
        assert r2.json() == {"liked": False, "totalLikes": 0}

    def test_comentario_mostra_liked_e_total_likes_no_serializer(self, client, aluno_user, post, comentario):
        client.force_login(aluno_user)
        client.post(reverse("api-comentario-reagir", args=[post.id, comentario.id]))

        response = client.get(reverse("api-comentario-list", args=[post.id]))
        body = response.json()[0]
        assert body["liked"] is True
        assert body["total_likes"] == 1


@pytest.mark.django_db
class TestComentarioDetail:
    def test_autor_edita_o_proprio_comentario(self, client, professor_user, post, comentario):
        client.force_login(professor_user)
        response = _patch_json(
            client, "api-comentario-detail", [post.id, comentario.id], {"conteudo": "Editado!"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["conteudo"] == "Editado!"
        assert body["editado_em"] is not None
        comentario.refresh_from_db()
        assert comentario.conteudo == "Editado!"

    def test_outro_utilizador_nao_pode_editar(self, client, aluno_user, post, comentario):
        client.force_login(aluno_user)
        response = _patch_json(
            client, "api-comentario-detail", [post.id, comentario.id], {"conteudo": "Hackeado"},
        )
        assert response.status_code == 403
        comentario.refresh_from_db()
        assert comentario.conteudo == "Boa partilha!"

    def test_edicao_vazia_e_rejeitada(self, client, professor_user, post, comentario):
        client.force_login(professor_user)
        response = _patch_json(client, "api-comentario-detail", [post.id, comentario.id], {"conteudo": "  "})
        assert response.status_code == 400

    def test_autor_do_comentario_apaga_o_proprio(self, client, professor_user, post, comentario):
        client.force_login(professor_user)
        response = client.delete(reverse("api-comentario-detail", args=[post.id, comentario.id]))
        assert response.status_code == 204
        assert not Comentario.objects.filter(id=comentario.id).exists()

    def test_autor_do_post_nao_pode_apagar_comentario_de_outro(self, client, aluno_user, post, comentario):
        # `post` é do aluno_user; `comentario` é do professor_user — o dono
        # do post NÃO pode apagar comentários de outras pessoas.
        client.force_login(aluno_user)
        response = client.delete(reverse("api-comentario-detail", args=[post.id, comentario.id]))
        assert response.status_code == 403
        assert Comentario.objects.filter(id=comentario.id).exists()

    def test_super_administrador_pode_apagar_qualquer_comentario(self, client, post, comentario):
        from apps.accounts.models import User

        root = User.objects.create_superuser(username="root", email="root@exemplo.com", password="SenhaForte123!")
        client.force_login(root)
        response = client.delete(reverse("api-comentario-detail", args=[post.id, comentario.id]))
        assert response.status_code == 204
        assert not Comentario.objects.filter(id=comentario.id).exists()

    def test_administrador_comum_nao_pode_apagar_comentario_de_outro(self, client, post, comentario):
        from apps.accounts.models import User

        staff = User.objects.create_user(username="staff1", password="SenhaForte123!", is_staff=True)
        client.force_login(staff)
        response = client.delete(reverse("api-comentario-detail", args=[post.id, comentario.id]))
        assert response.status_code == 403
        assert Comentario.objects.filter(id=comentario.id).exists()

    def test_pode_apagar_na_api_so_para_autor_e_super_administrador(self, client, aluno_user, post, comentario):
        client.force_login(aluno_user)  # dono do post, não autor do comentário
        lista = client.get(reverse("api-comentario-list", args=[post.id])).json()
        itens = lista["results"] if isinstance(lista, dict) and "results" in lista else lista
        assert itens and all(c["pode_apagar"] is False for c in itens)

    def test_terceiro_sem_relacao_nao_pode_apagar(self, client, post, comentario):
        from apps.accounts.models import User

        terceiro = User.objects.create_user(username="terceiro", password="SenhaForte123!")
        client.force_login(terceiro)
        response = client.delete(reverse("api-comentario-detail", args=[post.id, comentario.id]))
        assert response.status_code == 403
        assert Comentario.objects.filter(id=comentario.id).exists()
