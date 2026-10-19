import json

import pytest
from django.urls import reverse

from apps.alunos.models import Aluno
from apps.cursos.models import Categoria, Curso, EngajamentoCurso, Inscricao
from apps.professores.models import ComentarioVideo, ReacaoVideo, Video, VisualizacaoVideo


def _post_json(client, url_name, args, data=None):
    return client.post(
        reverse(url_name, args=args), data=json.dumps(data or {}), content_type="application/json",
    )


def _patch_json(client, url_name, args, data):
    return client.patch(reverse(url_name, args=args), data=json.dumps(data), content_type="application/json")


@pytest.fixture
def video(db, professor):
    return Video.objects.create(professor=professor, titulo="Vídeo Avulso", ativo=True)


@pytest.mark.django_db
class TestUsuarioAtual:
    def test_exige_autenticacao(self, client):
        response = client.get(reverse("usuario-atual"))
        assert response.status_code == 403

    def test_devolve_dados_do_utilizador(self, client, aluno_user):
        client.force_login(aluno_user)
        response = client.get(reverse("usuario-atual"))
        assert response.status_code == 200
        body = response.json()
        assert body["username"] == aluno_user.username
        assert body["is_student"] is True
        assert body["is_teacher"] is False


@pytest.mark.django_db
class TestCategoriaList:
    def test_inclui_opcao_todos_primeiro(self, client, aluno_user):
        Categoria.objects.create(nome="Matemática")
        client.force_login(aluno_user)
        response = client.get(reverse("categoria-list"))
        assert response.status_code == 200
        body = response.json()
        assert body[0] == {"id": None, "nome": "Todos"}
        assert any(c["nome"] == "Matemática" for c in body[1:])


@pytest.mark.django_db
class TestVideoListDetail:
    def test_video_list_exclui_videos_de_curso(self, client, aluno_user, professor):
        curso = Curso.objects.create(professor=professor, titulo="C", descricao="d")
        Video.objects.create(professor=professor, titulo="Avulso", ativo=True)
        Video.objects.create(professor=professor, titulo="Da aula", curso=curso, ativo=True)
        client.force_login(aluno_user)

        response = client.get(reverse("video-list"))
        assert response.status_code == 200
        titulos = {v["titulo"] for v in response.json()}
        assert "Avulso" in titulos
        assert "Da aula" not in titulos

    def test_video_list_exclui_inativos(self, client, aluno_user, professor):
        Video.objects.create(professor=professor, titulo="Inativo", ativo=False)
        client.force_login(aluno_user)
        response = client.get(reverse("video-list"))
        assert all(v["titulo"] != "Inativo" for v in response.json())

    def test_video_list_tab_popular_ordena_por_visualizacoes(self, client, aluno_user, professor_user, professor):
        pouco_visto = Video.objects.create(professor=professor, titulo="Pouco visto", ativo=True)
        muito_visto = Video.objects.create(professor=professor, titulo="Muito visto", ativo=True)
        VisualizacaoVideo.objects.create(video=pouco_visto, utilizador=professor_user, count=1)
        VisualizacaoVideo.objects.create(video=muito_visto, utilizador=professor_user, count=50)
        client.force_login(aluno_user)

        response = client.get(reverse("video-list") + "?tab=popular")
        titulos = [v["titulo"] for v in response.json()]
        assert titulos.index("Muito visto") < titulos.index("Pouco visto")

    def test_video_detail_devolve_404_para_video_de_curso(self, client, aluno_user, professor):
        curso = Curso.objects.create(professor=professor, titulo="C", descricao="d")
        v = Video.objects.create(professor=professor, titulo="Da aula", curso=curso, ativo=True)
        client.force_login(aluno_user)
        response = client.get(reverse("video-detail", args=[v.id]))
        assert response.status_code == 404

    def test_video_detail_devolve_dados_do_video_avulso(self, client, aluno_user, video):
        client.force_login(aluno_user)
        response = client.get(reverse("video-detail", args=[video.id]))
        assert response.status_code == 200
        assert response.json()["titulo"] == video.titulo


@pytest.mark.django_db
class TestVideoReact:
    def test_exige_autenticacao(self, client, video):
        response = client.post(reverse("video-react", args=[video.id]))
        assert response.status_code == 403

    def test_gostar_depois_degostar_remove_reacao(self, client, aluno_user, video):
        client.force_login(aluno_user)
        r1 = _post_json(client, "video-react", [video.id], {"tipo": "like"})
        assert r1.status_code == 200
        assert r1.json() == {"likes": 1, "dislikes": 0}

        r2 = _post_json(client, "video-react", [video.id], {"tipo": "like"})
        assert r2.json() == {"likes": 0, "dislikes": 0}
        assert not ReacaoVideo.objects.filter(video=video, utilizador=aluno_user).exists()

    def test_trocar_de_like_para_dislike(self, client, aluno_user, video):
        client.force_login(aluno_user)
        _post_json(client, "video-react", [video.id], {"tipo": "like"})
        response = _post_json(client, "video-react", [video.id], {"tipo": "dislike"})
        assert response.json() == {"likes": 0, "dislikes": 1}

    def test_video_inexistente_404(self, client, aluno_user):
        client.force_login(aluno_user)
        response = client.post(reverse("video-react", args=[999999]))
        assert response.status_code == 404


@pytest.mark.django_db
class TestVideoRegistarView:
    def test_exige_autenticacao(self, client, video):
        response = client.post(reverse("video-registar-view", args=[video.id]))
        assert response.status_code == 403

    def test_dono_do_video_nao_conta_como_view(self, client, professor_user, video):
        client.force_login(professor_user)
        response = client.post(reverse("video-registar-view", args=[video.id]))
        assert response.status_code == 200
        assert response.json() == {"novaView": False, "cursoConcluido": False}
        assert not VisualizacaoVideo.objects.filter(video=video, utilizador=professor_user).exists()

    def test_primeira_e_segunda_visualizacao(self, client, aluno_user, video):
        client.force_login(aluno_user)
        r1 = client.post(reverse("video-registar-view", args=[video.id]))
        assert r1.json()["novaView"] is True
        view = VisualizacaoVideo.objects.get(video=video, utilizador=aluno_user)
        assert view.count == 1

        r2 = client.post(reverse("video-registar-view", args=[video.id]))
        assert r2.json()["novaView"] is False
        view.refresh_from_db()
        assert view.count == 2

    def test_ultima_aula_vista_conclui_o_curso(self, client, aluno_user, aluno, professor):
        curso = Curso.objects.create(professor=professor, titulo="C", descricao="d")
        v1 = Video.objects.create(professor=professor, titulo="Aula 1", curso=curso, ativo=True)
        Inscricao.objects.create(aluno=aluno, curso=curso)
        client.force_login(aluno_user)

        response = client.post(reverse("video-registar-view", args=[v1.id]))
        assert response.json()["cursoConcluido"] is True
        inscricao = Inscricao.objects.get(aluno=aluno, curso=curso)
        assert inscricao.concluido is True

    def test_video_inexistente_404(self, client, aluno_user):
        client.force_login(aluno_user)
        response = client.post(reverse("video-registar-view", args=[999999]))
        assert response.status_code == 404


@pytest.mark.django_db
class TestVideoComentarios:
    def test_lista_e_cria_comentario(self, client, aluno_user, video):
        client.force_login(aluno_user)
        r_vazio = client.get(reverse("video-comentario-list", args=[video.id]))
        assert r_vazio.json() == []

        r_criar = _post_json(client, "video-comentario-list", [video.id], {"conteudo": "Boa aula!"})
        assert r_criar.status_code == 201
        assert ComentarioVideo.objects.filter(video=video, autor=aluno_user).exists()

    def test_comentario_vazio_e_rejeitado(self, client, aluno_user, video):
        client.force_login(aluno_user)
        response = _post_json(client, "video-comentario-list", [video.id], {"conteudo": "   "})
        assert response.status_code == 400

    def test_responder_a_comentario_fica_aninhado(self, client, aluno_user, professor_user, video):
        comentario = ComentarioVideo.objects.create(video=video, autor=professor_user, conteudo="Olá")
        client.force_login(aluno_user)
        r = _post_json(client, "video-comentario-list", [video.id], {"conteudo": "Resposta", "parent": comentario.id})
        assert r.status_code == 201
        assert ComentarioVideo.objects.get(id=r.json()["id"]).parent_id == comentario.id

    def test_video_inexistente_404(self, client, aluno_user):
        client.force_login(aluno_user)
        response = client.get(reverse("video-comentario-list", args=[999999]))
        assert response.status_code == 404


@pytest.mark.django_db
class TestVideoComentarioDetail:
    def test_autor_edita_o_proprio_comentario(self, client, aluno_user, video):
        comentario = ComentarioVideo.objects.create(video=video, autor=aluno_user, conteudo="Original")
        client.force_login(aluno_user)
        response = _patch_json(client, "video-comentario-detail", [video.id, comentario.id], {"conteudo": "Editado"})
        assert response.status_code == 200
        comentario.refresh_from_db()
        assert comentario.conteudo == "Editado"
        assert comentario.editado_em is not None

    def test_outro_aluno_nao_pode_editar(self, client, aluno_user, professor_user, video):
        comentario = ComentarioVideo.objects.create(video=video, autor=professor_user, conteudo="Original")
        client.force_login(aluno_user)
        response = _patch_json(client, "video-comentario-detail", [video.id, comentario.id], {"conteudo": "Hackeado"})
        assert response.status_code == 403

    def test_dono_do_video_nao_pode_apagar_comentario_de_outro(self, client, aluno_user, professor_user, video):
        comentario = ComentarioVideo.objects.create(video=video, autor=aluno_user, conteudo="x")
        client.force_login(professor_user)
        response = client.delete(reverse("video-comentario-detail", args=[video.id, comentario.id]))
        assert response.status_code == 403
        assert ComentarioVideo.objects.filter(id=comentario.id).exists()

    def test_super_administrador_pode_apagar_comentario_de_video(self, client, aluno_user, video):
        from apps.accounts.models import User

        root = User.objects.create_superuser(username="rootv", email="rootv@exemplo.com", password="SenhaForte123!")
        comentario = ComentarioVideo.objects.create(video=video, autor=aluno_user, conteudo="x")
        client.force_login(root)
        response = client.delete(reverse("video-comentario-detail", args=[video.id, comentario.id]))
        assert response.status_code == 204
        assert not ComentarioVideo.objects.filter(id=comentario.id).exists()

    def test_autor_apaga_o_proprio_comentario_de_video(self, client, aluno_user, video):
        comentario = ComentarioVideo.objects.create(video=video, autor=aluno_user, conteudo="x")
        client.force_login(aluno_user)
        response = client.delete(reverse("video-comentario-detail", args=[video.id, comentario.id]))
        assert response.status_code == 204

    def test_terceiro_sem_relacao_nao_pode_apagar(self, client, video, professor_user):
        from apps.accounts.models import User

        comentario = ComentarioVideo.objects.create(video=video, autor=professor_user, conteudo="x")
        terceiro = User.objects.create_user(username="terceirov", password="SenhaForte123!")
        client.force_login(terceiro)
        response = client.delete(reverse("video-comentario-detail", args=[video.id, comentario.id]))
        assert response.status_code == 403


@pytest.mark.django_db
class TestVideoComentarioReagir:
    def test_reagir_e_reagir_de_novo_remove(self, client, aluno_user, professor_user, video):
        comentario = ComentarioVideo.objects.create(video=video, autor=professor_user, conteudo="x")
        client.force_login(aluno_user)

        r1 = client.post(reverse("video-comentario-reagir", args=[video.id, comentario.id]))
        assert r1.json() == {"liked": True, "totalLikes": 1}
        r2 = client.post(reverse("video-comentario-reagir", args=[video.id, comentario.id]))
        assert r2.json() == {"liked": False, "totalLikes": 0}


@pytest.mark.django_db
class TestCursoInscrever:
    def test_exige_autenticacao(self, client, professor):
        curso = Curso.objects.create(professor=professor, titulo="C", descricao="d")
        response = client.post(reverse("curso-inscrever", args=[curso.id]))
        assert response.status_code == 403

    def test_aluno_inscreve_se_e_regista_engajamento(self, client, aluno_user, aluno, professor):
        curso = Curso.objects.create(professor=professor, titulo="C", descricao="d")
        client.force_login(aluno_user)

        response = client.post(reverse("curso-inscrever", args=[curso.id]))
        assert response.status_code == 200
        assert response.json() == {"ok": True, "concluido": False}
        assert Inscricao.objects.filter(aluno=aluno, curso=curso).exists()
        eng = EngajamentoCurso.objects.get(curso=curso, aluno=aluno)
        assert eng.visualizacoes == 1

        # Reinscrever (ex: reabrir o curso) incrementa visualizações sem duplicar a inscrição.
        client.post(reverse("curso-inscrever", args=[curso.id]))
        assert Inscricao.objects.filter(aluno=aluno, curso=curso).count() == 1
        eng.refresh_from_db()
        assert eng.visualizacoes == 2

    def test_professor_nao_pode_inscrever_se(self, client, professor_user, professor):
        curso = Curso.objects.create(professor=professor, titulo="C", descricao="d")
        client.force_login(professor_user)
        response = client.post(reverse("curso-inscrever", args=[curso.id]))
        assert response.status_code == 403

    def test_curso_inexistente_404(self, client, aluno_user):
        client.force_login(aluno_user)
        response = client.post(reverse("curso-inscrever", args=[999999]))
        assert response.status_code == 404


@pytest.mark.django_db
class TestCursoViewSetListagemPublica:
    def test_exclui_cursos_inativos(self, client, aluno_user, professor):
        Curso.objects.create(professor=professor, titulo="Inativo", descricao="d", ativo=False)
        Curso.objects.create(professor=professor, titulo="Ativo", descricao="d", ativo=True)
        client.force_login(aluno_user)

        response = client.get(reverse("cursos-list"))
        titulos = {c["titulo"] for c in response.json()}
        assert "Ativo" in titulos
        assert "Inativo" not in titulos

    def test_curso_inativo_404_no_detail(self, client, aluno_user, professor):
        curso = Curso.objects.create(professor=professor, titulo="Inativo", descricao="d", ativo=False)
        client.force_login(aluno_user)
        response = client.get(reverse("cursos-detail", args=[curso.id]))
        assert response.status_code == 404

    def test_exige_autenticacao(self, client):
        response = client.get(reverse("cursos-list"))
        assert response.status_code == 403
