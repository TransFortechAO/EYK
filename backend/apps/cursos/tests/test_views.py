import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse

from apps.cursos.models import Categoria, Curso, Inscricao, RecursoCurso
from apps.professores.models import ComentarioVideo, ReacaoVideo, Video, VisualizacaoVideo


@pytest.mark.django_db
class TestCursoVideoAssistido:
    def test_aula_assistida_fica_marcada_e_as_outras_nao(self, client, professor, categoria, aluno, aluno_user):
        curso = Curso.objects.create(professor=professor, titulo="Curso", descricao="d", categoria=categoria)
        v1 = Video.objects.create(professor=professor, curso=curso, titulo="Aula 1", ativo=True, ordem=0)
        v2 = Video.objects.create(professor=professor, curso=curso, titulo="Aula 2", ativo=True, ordem=1)
        VisualizacaoVideo.objects.create(video=v1, utilizador=aluno_user)

        client.force_login(aluno_user)
        response = client.get(reverse("cursos-detail", args=[curso.id]))
        assert response.status_code == 200
        videos_por_id = {v["id"]: v for v in response.json()["videos"]}
        assert videos_por_id[v1.id]["assistido"] is True
        assert videos_por_id[v2.id]["assistido"] is False

    def test_utilizador_sem_visualizacao_nao_aparece_como_tendo_assistido(
        self, client, professor, categoria, professor_user,
    ):
        curso = Curso.objects.create(professor=professor, titulo="Curso", descricao="d", categoria=categoria)
        Video.objects.create(professor=professor, curso=curso, titulo="Aula 1", ativo=True, ordem=0)

        client.force_login(professor_user)
        response = client.get(reverse("cursos-detail", args=[curso.id]))
        assert response.status_code == 200
        assert response.json()["videos"][0]["assistido"] is False


@pytest.fixture
def categoria(db):
    return Categoria.objects.create(nome="Matemática")


@pytest.fixture
def curso(db, professor, categoria):
    return Curso.objects.create(
        professor=professor, titulo="Álgebra Linear", descricao="Curso introdutório",
        categoria=categoria,
    )


def _pdf_file(nome="apostila.pdf", conteudo=b"%PDF-1.4 conteudo falso"):
    return SimpleUploadedFile(nome, conteudo, content_type="application/pdf")


@pytest.mark.django_db
class TestCursoRecursos:
    def test_professor_dono_cria_recurso(self, client, professor_user, curso):
        client.force_login(professor_user)
        response = client.post(
            reverse("curso-recursos", args=[curso.id]),
            data={"nome": "Apostila 1", "arquivo": _pdf_file()},
        )
        assert response.status_code == 201
        assert RecursoCurso.objects.filter(curso=curso, nome="Apostila 1").exists()
        recurso = RecursoCurso.objects.get(curso=curso)
        assert recurso.tamanho_bytes > 0

    def test_aluno_nao_pode_criar_recurso(self, client, aluno_user, curso):
        client.force_login(aluno_user)
        response = client.post(
            reverse("curso-recursos", args=[curso.id]),
            data={"nome": "Apostila 1", "arquivo": _pdf_file()},
        )
        assert response.status_code == 403
        assert not RecursoCurso.objects.filter(curso=curso).exists()

    def test_rejeita_ficheiro_nao_pdf(self, client, professor_user, curso):
        client.force_login(professor_user)
        ficheiro = SimpleUploadedFile("video.mp4", b"conteudo", content_type="video/mp4")
        response = client.post(
            reverse("curso-recursos", args=[curso.id]),
            data={"nome": "Vídeo disfarçado", "arquivo": ficheiro},
        )
        assert response.status_code == 400

    def test_professor_dono_lista_recursos(self, client, professor_user, curso):
        RecursoCurso.objects.create(curso=curso, nome="Apostila", arquivo=_pdf_file(), tamanho_bytes=10)
        client.force_login(professor_user)
        response = client.get(reverse("curso-recursos", args=[curso.id]))
        assert response.status_code == 200
        assert len(response.json()) == 1

    def test_qualquer_utilizador_autenticado_pode_listar_mesmo_sem_inscricao(self, client, aluno_user, curso):
        # Decisão de produto: qualquer utilizador autenticado pode ver e
        # descarregar os recursos de um curso, inscrito ou não.
        RecursoCurso.objects.create(curso=curso, nome="Apostila", arquivo=_pdf_file(), tamanho_bytes=10)
        client.force_login(aluno_user)
        response = client.get(reverse("curso-recursos", args=[curso.id]))
        assert response.status_code == 200
        assert len(response.json()) == 1

    def test_aluno_inscrito_pode_listar(self, client, aluno_user, aluno, curso):
        Inscricao.objects.create(aluno=aluno, curso=curso)
        RecursoCurso.objects.create(curso=curso, nome="Apostila", arquivo=_pdf_file(), tamanho_bytes=10)
        client.force_login(aluno_user)
        response = client.get(reverse("curso-recursos", args=[curso.id]))
        assert response.status_code == 200
        assert len(response.json()) == 1

    def test_professor_dono_apaga_recurso(self, client, professor_user, curso):
        recurso = RecursoCurso.objects.create(curso=curso, nome="Apostila", arquivo=_pdf_file(), tamanho_bytes=10)
        client.force_login(professor_user)
        response = client.delete(reverse("curso-recurso-delete", args=[curso.id, recurso.id]))
        assert response.status_code == 204
        assert not RecursoCurso.objects.filter(id=recurso.id).exists()

    def test_aluno_nao_pode_apagar_recurso(self, client, aluno_user, curso):
        recurso = RecursoCurso.objects.create(curso=curso, nome="Apostila", arquivo=_pdf_file(), tamanho_bytes=10)
        client.force_login(aluno_user)
        response = client.delete(reverse("curso-recurso-delete", args=[curso.id, recurso.id]))
        assert response.status_code == 403
        assert RecursoCurso.objects.filter(id=recurso.id).exists()


@pytest.mark.django_db
class TestCursoListPerformance:
    """Regressão do bug de N+1 na listagem pública de cursos (/api/cursos/):
    antes do prefetch_related em `CursoViewSet.get_queryset`, cada curso
    disparava queries extra para vídeos, gostos/visualizações por vídeo,
    inscrições e engajamento — tornando a listagem cada vez mais lenta à
    medida que a plataforma crescia."""

    def _criar_curso_com_dados(self, professor, categoria, aluno, titulo, n_videos):
        curso = Curso.objects.create(
            professor=professor, titulo=titulo, descricao="desc", categoria=categoria,
        )
        Inscricao.objects.create(aluno=aluno, curso=curso)
        for i in range(n_videos):
            video = Video.objects.create(
                professor=professor, curso=curso, titulo=f"{titulo} - aula {i + 1}", ativo=True,
            )
            ReacaoVideo.objects.create(video=video, utilizador=aluno.profile, tipo="like")
            VisualizacaoVideo.objects.create(video=video, utilizador=aluno.profile, count=3)
            ComentarioVideo.objects.create(video=video, autor=aluno.profile, conteudo="Ótima aula!")
        return curso

    def test_numero_de_queries_nao_cresce_com_o_numero_de_cursos_e_videos(
        self, client, professor, categoria, aluno, aluno_user,
    ):
        client.force_login(aluno_user)

        self._criar_curso_com_dados(professor, categoria, aluno, "Curso A", n_videos=1)
        with CaptureQueriesContext(connection) as ctx:
            resposta_1 = client.get(reverse("cursos-list"))
        queries_para_1_curso = len(ctx.captured_queries)

        for i in range(4):
            self._criar_curso_com_dados(professor, categoria, aluno, f"Curso extra {i}", n_videos=3)
        with CaptureQueriesContext(connection) as ctx:
            resposta_5 = client.get(reverse("cursos-list"))
        queries_para_5_cursos = len(ctx.captured_queries)

        assert resposta_1.status_code == 200
        assert resposta_5.status_code == 200
        assert len(resposta_5.json()) == 5

        # Pequena tolerância para não ser frágil a mudanças inócuas, mas
        # continua a apanhar claramente um N+1 que volte a aparecer.
        assert queries_para_5_cursos <= queries_para_1_curso + 2, (
            f"{queries_para_1_curso} queries para 1 curso (1 vídeo) vs. "
            f"{queries_para_5_cursos} para 5 cursos (até 3 vídeos cada) — "
            "o nº de queries está a crescer com os dados: parece ter voltado o N+1."
        )
