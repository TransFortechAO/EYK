"""Repostar publicações da comunidade e dados públicos para pré-visualizar links partilhados."""
import json

import pytest
from django.urls import reverse

from apps.cursos.models import Curso
from apps.feed.api_views import TAMANHO_FEED
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


PNG_1PX = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\rIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


@pytest.mark.django_db
class TestPublicarComFoto:
    def test_publica_so_com_foto(self, client, aluno_user, settings, tmp_path):
        from django.core.files.uploadedfile import SimpleUploadedFile

        settings.MEDIA_ROOT = tmp_path
        client.force_login(aluno_user)
        foto = SimpleUploadedFile("foto.png", PNG_1PX, content_type="image/png")
        r = client.post(reverse("api-post-list"), data={"conteudo": "", "imagem": foto})
        assert r.status_code == 201
        assert r.json()["imagem"]

    def test_recusa_ficheiro_que_nao_e_imagem(self, client, aluno_user):
        from django.core.files.uploadedfile import SimpleUploadedFile

        client.force_login(aluno_user)
        ficheiro = SimpleUploadedFile("x.pdf", b"%PDF-1.4", content_type="application/pdf")
        r = client.post(reverse("api-post-list"), data={"conteudo": "olá", "imagem": ficheiro})
        assert r.status_code == 400


@pytest.mark.django_db
class TestFeedAleatorio:
    def _criar(self, autor, quantidade):
        return [Post.objects.create(autor=autor, conteudo=f"Post {i}") for i in range(quantidade)]

    def test_publicacoes_antigas_tambem_aparecem(self, client, aluno_user):
        # Mais publicações do que cabem no feed: as mais antigas não podem ficar sempre de fora.
        posts = self._criar(aluno_user, TAMANHO_FEED + 10)
        client.force_login(aluno_user)
        antigos = {p.id for p in posts[:10]}
        vistos = set()
        for _ in range(8):
            vistos |= {p["id"] for p in client.get(reverse("api-post-list")).json()}
        assert vistos & antigos

    def test_o_feed_tem_no_maximo_o_tamanho_definido(self, client, aluno_user):
        self._criar(aluno_user, TAMANHO_FEED + 3)
        client.force_login(aluno_user)
        assert len(client.get(reverse("api-post-list")).json()) == TAMANHO_FEED

    def test_post_de_um_link_vem_primeiro_sem_repetir(self, client, aluno_user):
        posts = self._criar(aluno_user, TAMANHO_FEED + 10)
        client.force_login(aluno_user)
        alvo = posts[0].id
        lista = client.get(reverse("api-post-list"), {"post": alvo}).json()
        ids = [p["id"] for p in lista]
        assert ids[0] == alvo
        assert ids.count(alvo) == 1

    def test_link_para_post_ocultado_nao_o_mostra(self, client, aluno_user, professor_user):
        oculto = Post.objects.create(autor=professor_user, conteudo="x", oculto=True)
        client.force_login(aluno_user)
        ids = [p["id"] for p in client.get(reverse("api-post-list"), {"post": oculto.id}).json()]
        assert oculto.id not in ids


@pytest.mark.django_db
class TestRepostComFoto:
    def _original(self, autor, settings, tmp_path):
        from django.core.files.uploadedfile import SimpleUploadedFile

        settings.MEDIA_ROOT = tmp_path
        foto = SimpleUploadedFile("foto.png", PNG_1PX, content_type="image/png")
        return Post.objects.create(autor=autor, conteudo="Legenda da foto", imagem=foto)

    def test_o_repost_traz_a_foto_e_a_legenda(self, client, aluno_user, professor_user, settings, tmp_path):
        original = self._original(professor_user, settings, tmp_path)
        client.force_login(aluno_user)
        resumo = _repostar(client, original.id).json()["repost_de"]
        assert resumo["conteudo"] == "Legenda da foto"
        assert resumo["imagem"] == original.imagem.url

    def test_partilhar_o_repost_leva_a_foto_e_a_legenda(self, client, aluno_user, professor_user, settings, tmp_path):
        original = self._original(professor_user, settings, tmp_path)
        repost = Post.objects.create(autor=aluno_user, conteudo="Vejam isto", repost_de=original)
        dados = client.get(reverse("api-partilha-publica", args=["post", repost.id])).json()
        assert dados["imagem"] == original.imagem.url
        assert dados["descricao"] == "Vejam isto — Legenda da foto"

    def test_original_ocultado_nao_passa_para_a_partilha(self, client, aluno_user, professor_user, settings, tmp_path):
        original = self._original(professor_user, settings, tmp_path)
        original.oculto = True
        original.save()
        repost = Post.objects.create(autor=aluno_user, conteudo="", repost_de=original)
        dados = client.get(reverse("api-partilha-publica", args=["post", repost.id])).json()
        assert dados["imagem"] is None
        assert "Legenda" not in dados["descricao"]
