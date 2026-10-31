"""Editar vídeos e cursos: muda o texto, a capa e os recursos, mas não troca o vídeo;
fica marcado como editado só quando muda o conteúdo."""
import json

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test.client import BOUNDARY, MULTIPART_CONTENT, encode_multipart
from django.urls import reverse

from apps.cursos.models import Curso
from apps.feed.models import Post
from apps.professores.models import Video


def _patch_json(client, url_name, args, data):
    return client.patch(reverse(url_name, args=args), data=json.dumps(data), content_type="application/json")


def _patch_multipart(client, url_name, args, data):
    return client.generic("PATCH", reverse(url_name, args=args), encode_multipart(BOUNDARY, data), content_type=MULTIPART_CONTENT)


LINK = "https://youtube.com/watch?v=alfabeto"


def _video_file(nome="outro.mp4"):
    return SimpleUploadedFile(nome, b"dados de video falsos", content_type="video/mp4")


@pytest.fixture
def video(db, professor):
    return Video.objects.create(professor=professor, titulo="Alfabeto", descricao="A a M", url_externa=LINK, ativo=True)


@pytest.fixture
def curso(db, professor):
    return Curso.objects.create(professor=professor, titulo="LGA", descricao="desc")


@pytest.mark.django_db
class TestEditarVideo:
    def test_nao_troca_o_ficheiro_do_video(self, client, professor_user, video):
        client.force_login(professor_user)
        r = _patch_multipart(client, "api-professor-video-detail", [video.id], {"titulo": "Novo", "arquivo": _video_file()})
        assert r.status_code == 400
        video.refresh_from_db()
        assert video.titulo == "Alfabeto"
        assert video.editado_em is None

    def test_nao_troca_o_link_do_video(self, client, professor_user, video):
        client.force_login(professor_user)
        r = _patch_json(client, "api-professor-video-detail", [video.id], {"url_externa": "https://youtube.com/watch?v=x"})
        assert r.status_code == 400

    def test_mudar_texto_marca_como_editado(self, client, professor_user, video):
        client.force_login(professor_user)
        # Enviar o mesmo link (o formulário manda-o sempre) não conta como trocar.
        r = _patch_json(client, "api-professor-video-detail", [video.id], {"descricao": "A a Z", "url_externa": LINK})
        assert r.status_code == 200
        assert r.json()["editado_em"] is not None

    def test_publicar_ou_esconder_nao_marca_como_editado(self, client, professor_user, video):
        client.force_login(professor_user)
        r = _patch_json(client, "api-professor-video-detail", [video.id], {"ativo": False})
        assert r.status_code == 200
        assert r.json()["editado_em"] is None


@pytest.mark.django_db
class TestEditarCurso:
    def test_nao_acrescenta_aulas_ao_editar(self, client, professor_user, curso):
        client.force_login(professor_user)
        r = _patch_multipart(client, "api-professor-curso-detail", [curso.id], {"titulo": "LGA 2", "videos": _video_file()})
        assert r.status_code == 400
        assert curso.videos.count() == 0

    def test_mudar_descricao_marca_como_editado(self, client, professor_user, curso):
        client.force_login(professor_user)
        r = _patch_json(client, "api-professor-curso-detail", [curso.id], {"descricao": "Nova descrição"})
        assert r.status_code == 200
        assert r.json()["editado_em"] is not None
        # Os alunos também vêem que foi editado.
        r_publico = client.get(f"/api/cursos/{curso.id}/")
        assert r_publico.json()["editado_em"] is not None

    def test_esconder_o_curso_nao_marca_como_editado(self, client, professor_user, curso):
        client.force_login(professor_user)
        r = _patch_json(client, "api-professor-curso-detail", [curso.id], {"ativo": False})
        assert r.status_code == 200
        assert r.json()["editado_em"] is None


@pytest.mark.django_db
class TestEditarPost:
    def test_o_autor_edita_e_fica_marcado(self, client, aluno_user):
        post = Post.objects.create(autor=aluno_user, conteudo="Olá a todos")
        client.force_login(aluno_user)
        r = _patch_json(client, "api-post-detail", [post.id], {"conteudo": "Olá a todos!"})
        assert r.status_code == 200
        assert r.json()["conteudo"] == "Olá a todos!"
        assert r.json()["editado_em"] is not None

    def test_sem_mudancas_nao_marca(self, client, aluno_user):
        post = Post.objects.create(autor=aluno_user, conteudo="Olá")
        client.force_login(aluno_user)
        r = _patch_json(client, "api-post-detail", [post.id], {"conteudo": "Olá"})
        assert r.status_code == 200
        assert r.json()["editado_em"] is None

    def test_outra_pessoa_nao_edita(self, client, aluno_user, professor_user):
        post = Post.objects.create(autor=aluno_user, conteudo="Olá")
        client.force_login(professor_user)
        r = _patch_json(client, "api-post-detail", [post.id], {"conteudo": "Mudado"})
        assert r.status_code == 403
        post.refresh_from_db()
        assert post.conteudo == "Olá"

    def test_nao_aceita_vazio(self, client, aluno_user):
        post = Post.objects.create(autor=aluno_user, conteudo="Olá")
        client.force_login(aluno_user)
        assert _patch_json(client, "api-post-detail", [post.id], {"conteudo": "  "}).status_code == 400
