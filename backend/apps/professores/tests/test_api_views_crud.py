import json

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from apps.accounts.models import User
from apps.cursos.models import Curso
from apps.professores.models import Professor, Video


def _post_json(client, url_name, data, args=None):
    return client.post(
        reverse(url_name, args=args) if args else reverse(url_name),
        data=json.dumps(data),
        content_type="application/json",
    )


def _patch_json(client, url_name, args, data):
    return client.patch(reverse(url_name, args=args), data=json.dumps(data), content_type="application/json")


def _video_file(nome="aula.mp4"):
    return SimpleUploadedFile(nome, b"dados de video falsos", content_type="video/mp4")


@pytest.fixture
def curso(db, professor):
    return Curso.objects.create(professor=professor, titulo="Curso com aulas", descricao="desc")


@pytest.mark.django_db
class TestProfessorPerfil:
    def test_exige_perfil_de_professor(self, client, aluno_user):
        client.force_login(aluno_user)
        response = client.get(reverse("api-professor-perfil"))
        assert response.status_code == 403

    def test_devolve_o_proprio_perfil(self, client, professor_user, professor):
        client.force_login(professor_user)
        response = client.get(reverse("api-professor-perfil"))
        assert response.status_code == 200
        assert response.json()["nome_publico"] == professor.nome_publico

    def test_patch_atualiza_bio_e_area(self, client, professor_user, professor):
        client.force_login(professor_user)
        response = _patch_json(client, "api-professor-perfil", None, {"bio": "Nova bio", "area": "Física"})
        assert response.status_code == 200
        professor.refresh_from_db()
        assert professor.bio == "Nova bio"
        assert professor.area == "Física"


@pytest.mark.django_db
class TestProfessorApagarConta:
    def test_exige_perfil_de_professor(self, client, aluno_user):
        client.force_login(aluno_user)
        response = client.post(reverse("api-professor-apagar-conta"))
        assert response.status_code == 403

    def test_apaga_a_conta_e_termina_sessao(self, client, professor_user, professor):
        client.force_login(professor_user)
        response = client.post(reverse("api-professor-apagar-conta"))
        assert response.status_code == 200
        assert not User.objects.filter(id=professor_user.id).exists()
        assert not response.wsgi_request.user.is_authenticated


@pytest.mark.django_db
class TestProfessorCursosListagem:
    def test_lista_so_os_proprios_cursos(self, client, professor_user, professor):
        from apps.accounts.models import User as U

        outro_user = U.objects.create_user(username="outroprof4", password="SenhaForte123!", is_teacher=True)
        outro_professor = Professor.objects.create(user=outro_user, nome_publico="Outro", area="Arte")
        Curso.objects.create(professor=professor, titulo="Meu curso", descricao="d")
        Curso.objects.create(professor=outro_professor, titulo="Curso de outro", descricao="d")

        client.force_login(professor_user)
        response = client.get(reverse("api-professor-cursos"))
        assert response.status_code == 200
        titulos = {c["titulo"] for c in response.json()}
        assert titulos == {"Meu curso"}

    def test_criar_curso_sem_videos_e_rejeitado(self, client, professor_user, professor):
        client.force_login(professor_user)
        response = client.post(reverse("api-professor-cursos"), data={"titulo": "X", "descricao": "d"})
        assert response.status_code == 400


@pytest.mark.django_db
class TestProfessorCursoDetail:
    def test_outro_professor_nao_acede(self, client, curso):
        from apps.accounts.models import User as U

        outro_user = U.objects.create_user(username="outroprof5", password="SenhaForte123!", is_teacher=True)
        Professor.objects.create(user=outro_user, nome_publico="Outro", area="Arte")
        client.force_login(outro_user)
        response = client.get(reverse("api-professor-curso-detail", args=[curso.id]))
        assert response.status_code == 404

    def test_dono_ve_edita_e_apaga(self, client, professor_user, curso):
        client.force_login(professor_user)

        r_get = client.get(reverse("api-professor-curso-detail", args=[curso.id]))
        assert r_get.status_code == 200

        r_patch = _patch_json(client, "api-professor-curso-detail", [curso.id], {"titulo": "Novo título"})
        assert r_patch.status_code == 200
        curso.refresh_from_db()
        assert curso.titulo == "Novo título"

        r_delete = client.delete(reverse("api-professor-curso-detail", args=[curso.id]))
        assert r_delete.status_code == 204
        assert not Curso.objects.filter(id=curso.id).exists()


@pytest.mark.django_db
class TestProfessorCursoVideoDelete:
    def test_apaga_video_do_curso(self, client, professor_user, professor, curso):
        video = Video.objects.create(professor=professor, curso=curso, titulo="Aula 1", ativo=True)
        client.force_login(professor_user)
        response = client.delete(reverse("api-professor-curso-video-delete", args=[curso.id, video.id]))
        assert response.status_code == 204
        assert not Video.objects.filter(id=video.id).exists()

    def test_outro_professor_nao_pode_apagar(self, client, professor, curso):
        from apps.accounts.models import User as U

        video = Video.objects.create(professor=professor, curso=curso, titulo="Aula 1", ativo=True)
        outro_user = U.objects.create_user(username="outroprof6", password="SenhaForte123!", is_teacher=True)
        Professor.objects.create(user=outro_user, nome_publico="Outro", area="Arte")
        client.force_login(outro_user)
        response = client.delete(reverse("api-professor-curso-video-delete", args=[curso.id, video.id]))
        assert response.status_code == 404
        assert Video.objects.filter(id=video.id).exists()


@pytest.mark.django_db
class TestProfessorVideosListagem:
    def test_lista_so_videos_avulsos_do_proprio_professor(self, client, professor_user, professor, curso):
        Video.objects.create(professor=professor, titulo="Avulso", ativo=True)
        Video.objects.create(professor=professor, titulo="Da aula", curso=curso, ativo=True)
        client.force_login(professor_user)

        response = client.get(reverse("api-professor-videos"))
        titulos = {v["titulo"] for v in response.json()}
        assert titulos == {"Avulso"}

    def test_criar_video_sem_arquivo_nem_link_e_rejeitado(self, client, professor_user, professor):
        client.force_login(professor_user)
        response = client.post(reverse("api-professor-videos"), data={"titulo": "X"}, content_type="application/json")
        assert response.status_code == 400

    def test_criar_video_com_link_externo(self, client, professor_user, professor):
        client.force_login(professor_user)
        response = _post_json(client, "api-professor-videos", {
            "titulo": "Vídeo do YouTube", "url_externa": "https://youtube.com/watch?v=abc",
        })
        assert response.status_code == 201
        assert Video.objects.filter(professor=professor, titulo="Vídeo do YouTube").exists()


@pytest.mark.django_db
class TestProfessorVideoDetail:
    def test_outro_professor_nao_acede(self, client, professor):
        from apps.accounts.models import User as U

        video = Video.objects.create(professor=professor, titulo="Avulso", ativo=True, arquivo=_video_file())
        outro_user = U.objects.create_user(username="outroprof7", password="SenhaForte123!", is_teacher=True)
        Professor.objects.create(user=outro_user, nome_publico="Outro", area="Arte")
        client.force_login(outro_user)
        response = client.get(reverse("api-professor-video-detail", args=[video.id]))
        assert response.status_code == 404

    def test_dono_ve_edita_e_apaga(self, client, professor_user, professor):
        video = Video.objects.create(professor=professor, titulo="Avulso", ativo=True, arquivo=_video_file())
        client.force_login(professor_user)

        r_get = client.get(reverse("api-professor-video-detail", args=[video.id]))
        assert r_get.status_code == 200

        r_patch = _patch_json(client, "api-professor-video-detail", [video.id], {"titulo": "Título novo"})
        assert r_patch.status_code == 200
        video.refresh_from_db()
        assert video.titulo == "Título novo"

        r_delete = client.delete(reverse("api-professor-video-detail", args=[video.id]))
        assert r_delete.status_code == 204
        assert not Video.objects.filter(id=video.id).exists()


@pytest.mark.django_db
class TestProfessorVideosReordenar:
    def test_reordena_apenas_os_proprios_videos_avulsos(self, client, professor_user, professor, curso):
        v1 = Video.objects.create(professor=professor, titulo="A", ativo=True, ordem=0)
        v2 = Video.objects.create(professor=professor, titulo="B", ativo=True, ordem=1)
        v_de_curso = Video.objects.create(professor=professor, titulo="C", curso=curso, ativo=True, ordem=0)
        client.force_login(professor_user)

        response = _post_json(client, "api-professor-videos-reordenar", {"ordem": [v2.id, v1.id, v_de_curso.id]})
        assert response.status_code == 200
        v1.refresh_from_db()
        v2.refresh_from_db()
        v_de_curso.refresh_from_db()
        assert v2.ordem == 0
        assert v1.ordem == 1
        # Vídeo de curso não está no âmbito desta listagem (curso__isnull=True) — não é tocado.
        assert v_de_curso.ordem == 0


@pytest.mark.django_db
class TestProfessorToggleSeguir:
    def test_seguir_e_deixar_de_seguir(self, client, aluno_user, professor):
        client.force_login(aluno_user)
        r1 = client.post(reverse("api-professor-seguir", args=[professor.id]))
        assert r1.status_code == 200
        assert r1.json() == {"seguindo": True, "seguidores": 1}

        r2 = client.post(reverse("api-professor-seguir", args=[professor.id]))
        assert r2.json() == {"seguindo": False, "seguidores": 0}

    def test_professor_inexistente_404(self, client, aluno_user):
        client.force_login(aluno_user)
        response = client.post(reverse("api-professor-seguir", args=[999999]))
        assert response.status_code == 404
