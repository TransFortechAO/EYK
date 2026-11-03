"""Repostar publicações da comunidade e dados públicos para pré-visualizar links partilhados."""
import json

import pytest
from django.urls import reverse

from apps.cursos.models import Curso
from apps.feed.models import Post
from apps.professores.models import Video


def _repostar(client, post_id, conteudo=""):
    return client.post(
        reverse("api-post-repostar", args=[post_id]),
        data=json.dumps({"conteudo": conteudo}),
        content_type="application/json",
    )


@pytest.mark.django_db
class TestRepostar:
    def test_reposta_e_aparece_o_original(self, client, aluno_user, professor_user):
        original = Post.objects.create(autor=professor_user, conteudo="Aprendi o gesto de obrigado")
        client.force_login(aluno_user)
        r = _repostar(client, original.id)
        assert r.status_code == 201
        assert r.json()["repost_de"]["id"] == original.id
        assert r.json()["repost_de"]["conteudo"] == "Aprendi o gesto de obrigado"
        lista = client.get(reverse("api-post-list")).json()
        assert next(p for p in lista if p["id"] == original.id)["reposts"] == 1

    def test_repostar_um_repost_aponta_para_o_original(self, client, aluno_user, professor_user):
        original = Post.objects.create(autor=professor_user, conteudo="Original")
        repost = Post.objects.create(autor=professor_user, conteudo="", repost_de=original)
        client.force_login(aluno_user)
        r = _repostar(client, repost.id, "Muito bom!")
        assert r.status_code == 201
        assert r.json()["repost_de"]["id"] == original.id
        assert r.json()["conteudo"] == "Muito bom!"

    def test_nao_reposta_duas_vezes_sem_comentario(self, client, aluno_user, professor_user):
        original = Post.objects.create(autor=professor_user, conteudo="Original")
        client.force_login(aluno_user)
        assert _repostar(client, original.id).status_code == 201
        assert _repostar(client, original.id).status_code == 400

    def test_nao_reposta_publicacao_ocultada(self, client, aluno_user, professor_user):
        original = Post.objects.create(autor=professor_user, conteudo="Original", oculto=True)
        client.force_login(aluno_user)
        assert _repostar(client, original.id).status_code == 404

    def test_original_ocultado_depois_fica_indisponivel(self, client, aluno_user, professor_user):
        original = Post.objects.create(autor=professor_user, conteudo="Original")
        client.force_login(aluno_user)
        repost_id = _repostar(client, original.id).json()["id"]
        original.oculto = True
        original.save()
        lista = client.get(reverse("api-post-list")).json()
        resumo = next(p for p in lista if p["id"] == repost_id)["repost_de"]
        assert resumo["indisponivel"] is True
        assert "conteudo" not in resumo


@pytest.mark.django_db
class TestPartilhaPublica:
    def test_post_sem_sessao_devolve_so_o_essencial(self, client, aluno_user):
        post = Post.objects.create(autor=aluno_user, conteudo="Olá comunidade " * 40)
        r = client.get(reverse("api-partilha-publica", args=["post", post.id]))
        assert r.status_code == 200
        dados = r.json()
        assert set(dados) == {"tipo", "titulo", "descricao", "autor", "imagem"}
        assert len(dados["descricao"]) <= 220

    def test_post_ocultado_nao_aparece(self, client, aluno_user):
        post = Post.objects.create(autor=aluno_user, conteudo="x", oculto=True)
        assert client.get(reverse("api-partilha-publica", args=["post", post.id])).status_code == 404

    def test_video_e_curso(self, client, professor):
        video = Video.objects.create(professor=professor, titulo="Alfabeto", descricao="A a Z",
                                     url_externa="https://youtube.com/watch?v=x", ativo=True)
        curso = Curso.objects.create(professor=professor, titulo="LGA 1", descricao="Introdução")
        assert client.get(reverse("api-partilha-publica", args=["video", video.id])).json()["titulo"] == "Alfabeto"
        assert client.get(reverse("api-partilha-publica", args=["curso", curso.id])).json()["titulo"] == "LGA 1"

    def test_video_oculto_e_tipo_desconhecido(self, client, professor):
        video = Video.objects.create(professor=professor, titulo="X", oculto=True,
                                     url_externa="https://youtube.com/watch?v=x", ativo=True)
        assert client.get(reverse("api-partilha-publica", args=["video", video.id])).status_code == 404
        assert client.get(reverse("api-partilha-publica", args=["outro", 1])).status_code == 404
