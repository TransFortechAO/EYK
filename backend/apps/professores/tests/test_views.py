import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from apps.cursos.models import Curso, RecursoCurso
from apps.professores.models import ComentarioVideo, ReacaoVideo, RecursoVideo, Video, VisualizacaoVideo


@pytest.fixture
def curso(db, professor):
    return Curso.objects.create(professor=professor, titulo="Curso com aulas", descricao="desc")


def _pdf_file(nome="apostila.pdf", conteudo=b"%PDF-1.4 conteudo falso"):
    return SimpleUploadedFile(nome, conteudo, content_type="application/pdf")


def _video_file(nome="aula.mp4"):
    return SimpleUploadedFile(nome, b"dados de video falsos", content_type="video/mp4")


@pytest.mark.django_db
class TestProfessorCursoEngajamento:
    def test_mostra_engajamento_de_cada_aula_do_curso(self, client, professor_user, professor, curso, aluno_user):
        v1 = Video.objects.create(professor=professor, curso=curso, titulo="Aula 1", ativo=True, ordem=0)
        v2 = Video.objects.create(professor=professor, curso=curso, titulo="Aula 2", ativo=True, ordem=1)
        ReacaoVideo.objects.create(video=v1, utilizador=aluno_user, tipo="like")
        VisualizacaoVideo.objects.create(video=v1, utilizador=aluno_user, count=3)
        ComentarioVideo.objects.create(video=v2, autor=aluno_user, conteudo="Boa aula!")

        client.force_login(professor_user)
        response = client.get(reverse("api-professor-curso-engajamento", args=[curso.id]))

        assert response.status_code == 200
        body = response.json()
        assert body["totalAulas"] == 2
        aulas_por_id = {a["id"]: a for a in body["aulas"]}
        assert aulas_por_id[v1.id]["totalLikes"] == 1
        assert aulas_por_id[v1.id]["totalVisualizacoes"] == 3
        assert aulas_por_id[v2.id]["totalComentarios"] == 1
        # Ordem das aulas preservada (ordem=0 antes de ordem=1).
        assert [a["id"] for a in body["aulas"]] == [v1.id, v2.id]

    def test_outro_professor_nao_acede(self, client, professor_user, curso):
        from apps.accounts.models import User
        from apps.professores.models import Professor

        outro_user = User.objects.create_user(username="outroprof", password="SenhaForte123!", is_teacher=True)
        Professor.objects.create(user=outro_user, nome_publico="Outro", area="Arte")
        client.force_login(outro_user)

        response = client.get(reverse("api-professor-curso-engajamento", args=[curso.id]))
        assert response.status_code == 404


@pytest.mark.django_db
class TestProfessorVideoEngajamento:
    def test_mostra_outras_aulas_do_mesmo_curso(self, client, professor_user, professor, curso, aluno_user):
        v1 = Video.objects.create(professor=professor, curso=curso, titulo="Aula 1", ativo=True, ordem=0)
        v2 = Video.objects.create(professor=professor, curso=curso, titulo="Aula 2", ativo=True, ordem=1)
        ReacaoVideo.objects.create(video=v2, utilizador=aluno_user, tipo="like")

        client.force_login(professor_user)
        response = client.get(reverse("api-professor-video-engajamento", args=[v1.id]))

        assert response.status_code == 200
        body = response.json()
        assert body["cursoId"] == curso.id
        assert len(body["outrasAulasDoCurso"]) == 1
        assert body["outrasAulasDoCurso"][0]["id"] == v2.id
        assert body["outrasAulasDoCurso"][0]["totalLikes"] == 1

    def test_video_avulso_nao_tem_outras_aulas(self, client, professor_user, professor):
        video = Video.objects.create(professor=professor, titulo="Avulso", ativo=True)

        client.force_login(professor_user)
        response = client.get(reverse("api-professor-video-engajamento", args=[video.id]))

        assert response.status_code == 200
        body = response.json()
        assert body["cursoId"] is None
        assert body["outrasAulasDoCurso"] == []


@pytest.mark.django_db
class TestProfessorCursoRecursosNaCriacao:
    def test_criar_curso_com_recursos(self, client, professor_user, professor):
        client.force_login(professor_user)
        response = client.post(
            reverse("api-professor-cursos"),
            data={
                "titulo": "Curso novo",
                "descricao": "desc",
                "videos": [_video_file()],
                "recursos": [_pdf_file("guia.pdf"), _pdf_file("exercicios.pdf")],
            },
        )
        assert response.status_code == 201
        body = response.json()
        assert len(body["recursos"]) == 2
        curso = Curso.objects.get(id=body["id"])
        assert RecursoCurso.objects.filter(curso=curso).count() == 2

    def test_criar_curso_com_recurso_invalido_nao_cria_nada(self, client, professor_user, professor):
        client.force_login(professor_user)
        ficheiro_invalido = SimpleUploadedFile("recurso.txt", b"nao e pdf", content_type="text/plain")
        response = client.post(
            reverse("api-professor-cursos"),
            data={
                "titulo": "Curso novo",
                "descricao": "desc",
                "videos": [_video_file()],
                "recursos": [ficheiro_invalido],
            },
        )
        assert response.status_code == 400
        # A transação reverte tudo — nem o curso nem os vídeos ficam criados.
        assert not Curso.objects.filter(titulo="Curso novo").exists()

    def test_adicionar_recurso_a_curso_existente_via_patch(self, client, professor_user, curso):
        from django.test.client import BOUNDARY, MULTIPART_CONTENT, encode_multipart

        client.force_login(professor_user)
        corpo = encode_multipart(BOUNDARY, {"recursos": _pdf_file()})
        response = client.patch(
            reverse("api-professor-curso-detail", args=[curso.id]),
            data=corpo,
            content_type=MULTIPART_CONTENT,
        )
        assert response.status_code == 200
        assert RecursoCurso.objects.filter(curso=curso).count() == 1


@pytest.mark.django_db
class TestProfessorVideoRecursosNaCriacao:
    def test_publicar_video_com_recursos(self, client, professor_user, professor):
        client.force_login(professor_user)
        response = client.post(
            reverse("api-professor-videos"),
            data={
                "titulo": "Vídeo novo",
                "descricao": "desc",
                "arquivo": _video_file(),
                "recursos": [_pdf_file()],
            },
        )
        assert response.status_code == 201
        body = response.json()
        assert len(body["recursos"]) == 1
        video = Video.objects.get(id=body["id"])
        assert RecursoVideo.objects.filter(video=video).count() == 1

    def test_publicar_video_com_recurso_invalido_nao_cria_video(self, client, professor_user, professor):
        client.force_login(professor_user)
        ficheiro_invalido = SimpleUploadedFile("recurso.txt", b"nao e pdf", content_type="text/plain")
        response = client.post(
            reverse("api-professor-videos"),
            data={
                "titulo": "Vídeo novo",
                "descricao": "desc",
                "arquivo": _video_file(),
                "recursos": [ficheiro_invalido],
            },
        )
        assert response.status_code == 400
        assert not Video.objects.filter(titulo="Vídeo novo").exists()


@pytest.mark.django_db
class TestProfessorVideoRecursoDelete:
    def test_professor_dono_apaga_recurso(self, client, professor_user, professor):
        video = Video.objects.create(professor=professor, titulo="Avulso", ativo=True)
        recurso = RecursoVideo.objects.create(video=video, nome="x.pdf", arquivo=_pdf_file(), tamanho_bytes=10)

        client.force_login(professor_user)
        response = client.delete(
            reverse("api-professor-video-recurso-delete", args=[video.id, recurso.id]),
        )
        assert response.status_code == 204
        assert not RecursoVideo.objects.filter(id=recurso.id).exists()

    def test_outro_professor_nao_pode_apagar(self, client, professor):
        from apps.accounts.models import User
        from apps.professores.models import Professor

        video = Video.objects.create(professor=professor, titulo="Avulso", ativo=True)
        recurso = RecursoVideo.objects.create(video=video, nome="x.pdf", arquivo=_pdf_file(), tamanho_bytes=10)

        outro_user = User.objects.create_user(username="outroprof2", password="SenhaForte123!", is_teacher=True)
        Professor.objects.create(user=outro_user, nome_publico="Outro", area="Arte")
        client.force_login(outro_user)

        response = client.delete(
            reverse("api-professor-video-recurso-delete", args=[video.id, recurso.id]),
        )
        assert response.status_code == 404
        assert RecursoVideo.objects.filter(id=recurso.id).exists()
