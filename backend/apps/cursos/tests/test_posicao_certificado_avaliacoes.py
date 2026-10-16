import json
import uuid

import pytest
from django.urls import reverse

from apps.cursos.models import AvaliacaoCurso, Curso, Inscricao
from apps.professores.models import PosicaoVisualizacao, Video


def _json(client, method, url, data=None):
    return getattr(client, method)(url, data=json.dumps(data or {}), content_type="application/json")


@pytest.fixture
def curso(db, professor):
    return Curso.objects.create(professor=professor, titulo="Curso de LGA", descricao="d")


@pytest.fixture
def aula(db, professor, curso):
    return Video.objects.create(professor=professor, curso=curso, titulo="Aula 1", ativo=True, duracao_segundos=600)


@pytest.mark.django_db
class TestVideoPosicao:
    def test_exige_autenticacao(self, client, aula):
        assert client.get(reverse("video-posicao", args=[aula.id])).status_code == 403

    def test_sem_posicao_devolve_zero(self, client, aluno_user, aula):
        client.force_login(aluno_user)
        response = client.get(reverse("video-posicao", args=[aula.id]))
        assert response.status_code == 200
        assert response.json() == {"segundos": 0}

    def test_guarda_e_atualiza_posicao(self, client, aluno_user, aula):
        client.force_login(aluno_user)
        url = reverse("video-posicao", args=[aula.id])
        assert _json(client, "put", url, {"segundos": 125.7}).json() == {"segundos": 125}
        assert _json(client, "put", url, {"segundos": 300}).json() == {"segundos": 300}
        assert PosicaoVisualizacao.objects.filter(video=aula, utilizador=aluno_user).count() == 1
        assert client.get(url).json() == {"segundos": 300}

    def test_perto_do_fim_recomeca_do_inicio(self, client, aluno_user, aula):
        client.force_login(aluno_user)
        url = reverse("video-posicao", args=[aula.id])
        assert _json(client, "put", url, {"segundos": 595}).json() == {"segundos": 0}

    def test_valor_invalido(self, client, aluno_user, aula):
        client.force_login(aluno_user)
        response = _json(client, "put", reverse("video-posicao", args=[aula.id]), {"segundos": "abc"})
        assert response.status_code == 400

    def test_posicao_e_por_utilizador(self, client, aluno_user, professor_user, aula):
        PosicaoVisualizacao.objects.create(video=aula, utilizador=professor_user, segundos=200)
        client.force_login(aluno_user)
        assert client.get(reverse("video-posicao", args=[aula.id])).json() == {"segundos": 0}

    def test_curso_inclui_posicao_de_cada_aula(self, client, aluno_user, curso, aula):
        PosicaoVisualizacao.objects.create(video=aula, utilizador=aluno_user, segundos=42)
        client.force_login(aluno_user)
        body = client.get(f"/api/cursos/{curso.id}/").json()
        assert body["videos"][0]["posicao_segundos"] == 42
        assert body["videos"][0]["posicao_atualizada_em"] is not None


@pytest.mark.django_db
class TestCertificado:
    def test_nao_disponivel_antes_de_concluir(self, client, aluno_user, aluno, curso):
        Inscricao.objects.create(aluno=aluno, curso=curso)
        client.force_login(aluno_user)
        response = client.get(reverse("curso-certificado", args=[curso.id]))
        assert response.status_code == 403

    def test_exige_email_verificado(self, client, aluno_user, aluno, curso):
        Inscricao.objects.create(aluno=aluno, curso=curso, concluido=True)
        client.force_login(aluno_user)
        response = client.get(reverse("curso-certificado", args=[curso.id]))
        assert response.status_code == 403
        assert response.json()["codigo"] == "email_nao_verificado"

    def test_descarrega_pdf_quando_concluido(self, client, aluno_user, aluno, curso):
        aluno_user.email_verificado = True
        aluno_user.save()
        inscricao = Inscricao.objects.create(aluno=aluno, curso=curso, concluido=True)
        client.force_login(aluno_user)
        response = client.get(reverse("curso-certificado", args=[curso.id]))
        assert response.status_code == 200
        assert response["Content-Type"] == "application/pdf"
        assert response.content.startswith(b"%PDF")
        inscricao.refresh_from_db()
        assert inscricao.concluido_em is not None  # data fixada no 1.º download

    def test_curso_indica_certificado_disponivel(self, client, aluno_user, aluno, curso):
        Inscricao.objects.create(aluno=aluno, curso=curso, concluido=True)
        client.force_login(aluno_user)
        assert client.get(f"/api/cursos/{curso.id}/").json()["certificado_disponivel"] is True

    def test_verificacao_publica(self, client, aluno_user, aluno, curso):
        aluno_user.first_name, aluno_user.last_name = "ana", "silva"
        aluno_user.save()
        inscricao = Inscricao.objects.create(aluno=aluno, curso=curso, concluido=True)
        response = client.get(reverse("certificado-verificar", args=[inscricao.codigo_certificado]))
        assert response.status_code == 200
        body = response.json()
        assert body["valido"] is True
        assert body["aluno"] == "Ana Silva"
        assert body["curso"] == "Curso de LGA"
        assert "email" not in body and "username" not in body

    def test_verificacao_de_curso_nao_concluido_ou_codigo_inexistente(self, client, aluno, curso):
        inscricao = Inscricao.objects.create(aluno=aluno, curso=curso)
        assert client.get(reverse("certificado-verificar", args=[inscricao.codigo_certificado])).status_code == 404
        assert client.get(reverse("certificado-verificar", args=[uuid.uuid4()])).status_code == 404

    def test_conclusao_regista_data(self, client, aluno_user, aluno, curso, aula):
        Inscricao.objects.create(aluno=aluno, curso=curso)
        client.force_login(aluno_user)
        client.post(reverse("video-registar-view", args=[aula.id]))
        inscricao = Inscricao.objects.get(aluno=aluno, curso=curso)
        assert inscricao.concluido is True
        assert inscricao.concluido_em is not None


@pytest.mark.django_db
class TestAvaliacoes:
    def test_nao_inscrito_nao_pode_avaliar(self, client, aluno_user, aluno, curso):
        client.force_login(aluno_user)
        url = reverse("curso-avaliacoes", args=[curso.id])
        assert client.get(url).json()["podeAvaliar"] is False
        assert _json(client, "post", url, {"estrelas": 5}).status_code == 403

    def test_professor_nao_avalia_o_proprio_curso(self, client, professor_user, curso):
        client.force_login(professor_user)
        response = _json(client, "post", reverse("curso-avaliacoes", args=[curso.id]), {"estrelas": 5})
        assert response.status_code == 403

    def test_inscrito_avalia_e_reavalia(self, client, aluno_user, aluno, curso):
        Inscricao.objects.create(aluno=aluno, curso=curso)
        client.force_login(aluno_user)
        url = reverse("curso-avaliacoes", args=[curso.id])

        response = _json(client, "post", url, {"estrelas": 4, "comentario": " Muito bom "})
        assert response.status_code == 201
        assert response.json()["avaliacao"]["comentario"] == "Muito bom"
        assert response.json()["resumo"]["media"] == 4.0

        response = _json(client, "post", url, {"estrelas": 2})
        assert response.status_code == 200
        assert AvaliacaoCurso.objects.filter(curso=curso).count() == 1

        body = client.get(url).json()
        assert body["minha"]["estrelas"] == 2
        assert body["resumo"]["distribuicao"]["2"] == 1
        assert body["avaliacoes"][0]["minha"] is True

    def test_estrelas_fora_do_intervalo(self, client, aluno_user, aluno, curso):
        Inscricao.objects.create(aluno=aluno, curso=curso)
        client.force_login(aluno_user)
        url = reverse("curso-avaliacoes", args=[curso.id])
        assert _json(client, "post", url, {"estrelas": 0}).status_code == 400
        assert _json(client, "post", url, {"estrelas": 6}).status_code == 400

    def test_apagar_avaliacao(self, client, aluno_user, aluno, curso):
        Inscricao.objects.create(aluno=aluno, curso=curso)
        AvaliacaoCurso.objects.create(curso=curso, aluno=aluno, estrelas=3)
        client.force_login(aluno_user)
        response = client.delete(reverse("curso-avaliacoes", args=[curso.id]))
        assert response.status_code == 200
        assert response.json()["resumo"]["total"] == 0

    def test_media_aparece_no_curso_e_no_engajamento(self, client, aluno_user, aluno, professor_user, curso):
        Inscricao.objects.create(aluno=aluno, curso=curso)
        AvaliacaoCurso.objects.create(curso=curso, aluno=aluno, estrelas=5, comentario="Top")
        client.force_login(aluno_user)
        body = client.get(f"/api/cursos/{curso.id}/").json()
        assert body["media_avaliacoes"] == 5.0
        assert body["total_avaliacoes"] == 1

        client.force_login(professor_user)
        eng = client.get(reverse("api-professor-curso-engajamento", args=[curso.id])).json()
        assert eng["mediaAvaliacoes"] == 5.0
        assert eng["avaliacoesRecentes"][0]["comentario"] == "Top"
