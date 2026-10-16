import json
import re
from urllib.parse import parse_qs, urlparse

import pytest
from django.core import mail
from django.urls import reverse

from apps.accounts.emails import gerar_token_verificacao
from apps.accounts.models import User
from apps.accounts.views import REENVIO_VERIFICACAO_SESSION_KEY


def _post(client, url_name, data=None):
    return client.post(reverse(url_name), data=json.dumps(data or {}), content_type="application/json")


def _params_do_link(corpo: str) -> dict:
    link = re.search(r"https?://\S+", corpo).group(0)
    return {k: v[0] for k, v in parse_qs(urlparse(link).query).items()}


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="maria", email="maria@example.com", password="SenhaAntiga123!", is_student=True,
    )


@pytest.mark.django_db
class TestRecuperacaoPassword:
    def test_email_inexistente_responde_ok_sem_enviar(self, client):
        response = _post(client, "accounts:auth-password-reset", {"email": "ninguem@example.com"})
        assert response.status_code == 200
        assert response.json() == {"ok": True}
        assert len(mail.outbox) == 0

    def test_limite_por_email(self, client, user):
        for _ in range(3):
            assert _post(client, "accounts:auth-password-reset", {"email": "maria@example.com"}).status_code == 200
        response = _post(client, "accounts:auth-password-reset", {"email": "MARIA@example.com"})
        assert response.status_code == 429
        assert len(mail.outbox) == 3

    def test_limite_por_email_inexistente_tambem_conta(self, client):
        # Senão, a diferença 200/429 revelava que emails têm conta.
        for _ in range(3):
            _post(client, "accounts:auth-password-reset", {"email": "ninguem@example.com"})
        assert _post(client, "accounts:auth-password-reset", {"email": "ninguem@example.com"}).status_code == 429

    def test_limite_por_ip(self, client):
        for i in range(5):
            assert _post(client, "accounts:auth-password-reset", {"email": f"x{i}@example.com"}).status_code == 200
        assert _post(client, "accounts:auth-password-reset", {"email": "outro@example.com"}).status_code == 429

    def test_limite_por_ip_respeita_proxy_quando_configurado(self, client, settings):
        settings.CONFIAR_X_FORWARDED_FOR = True
        for i in range(5):
            response = client.post(
                reverse("accounts:auth-password-reset"), data=json.dumps({"email": f"y{i}@example.com"}),
                content_type="application/json", HTTP_X_FORWARDED_FOR=f"1.1.1.1, 10.0.0.{i}",
            )
            assert response.status_code == 200  # cada pedido vem de um cliente diferente

    def test_email_vazio(self, client):
        assert _post(client, "accounts:auth-password-reset", {"email": ""}).status_code == 400

    def test_fluxo_completo(self, client, user):
        response = _post(client, "accounts:auth-password-reset", {"email": "MARIA@example.com"})
        assert response.status_code == 200
        assert len(mail.outbox) == 1
        corpo = mail.outbox[0].body
        assert "/recuperar-senha/confirmar?" in corpo
        params = _params_do_link(corpo)

        assert _post(client, "accounts:auth-password-reset-validar", params).json()["ok"] is True

        response = _post(
            client, "accounts:auth-password-reset-confirmar", {**params, "password": "NovaSenha456!"},
        )
        assert response.status_code == 200
        user.refresh_from_db()
        assert user.check_password("NovaSenha456!")
        assert user.email_verificado is True

        # O token deixa de servir depois de usado (a password mudou).
        response = _post(client, "accounts:auth-password-reset-confirmar", {**params, "password": "Outra789!"})
        assert response.status_code == 400

    def test_token_invalido(self, client, user):
        response = _post(
            client, "accounts:auth-password-reset-confirmar", {"uid": "xx", "token": "yy", "password": "Nova123!"},
        )
        assert response.status_code == 400
        assert _post(client, "accounts:auth-password-reset-validar", {"uid": "xx", "token": "yy"}).status_code == 400


@pytest.mark.django_db
class TestVerificacaoEmail:
    def test_registo_envia_email_e_conta_fica_por_verificar(self, client):
        response = _post(
            client, "accounts:auth-register-json",
            {"username": "novo", "email": "novo@example.com", "password": "SenhaForte123!"},
        )
        assert response.status_code == 200
        assert response.json()["user"]["emailVerificado"] is False
        assert len(mail.outbox) == 1
        assert "/verificar-email?" in mail.outbox[0].body

        token = _params_do_link(mail.outbox[0].body)["token"]
        response = _post(client, "accounts:auth-verificar-email", {"token": token})
        assert response.status_code == 200
        assert User.objects.get(username="novo").email_verificado is True

    def test_token_invalido(self, client):
        assert _post(client, "accounts:auth-verificar-email", {"token": "lixo"}).status_code == 400

    def test_token_de_email_antigo_deixa_de_valer(self, client, user):
        token = gerar_token_verificacao(user)
        user.email = "outro@example.com"
        user.save()
        assert _post(client, "accounts:auth-verificar-email", {"token": token}).status_code == 400

    def test_reenviar_exige_sessao(self, client):
        assert _post(client, "accounts:auth-reenviar-verificacao").status_code == 401

    def test_reenviar_com_limite_de_frequencia(self, client, user):
        client.force_login(user)
        assert _post(client, "accounts:auth-reenviar-verificacao").status_code == 200
        assert len(mail.outbox) == 1
        assert _post(client, "accounts:auth-reenviar-verificacao").status_code == 429

        session = client.session
        session[REENVIO_VERIFICACAO_SESSION_KEY] = 0
        session.save()
        assert _post(client, "accounts:auth-reenviar-verificacao").status_code == 200

    def test_reenviar_quando_ja_verificado(self, client, user):
        user.email_verificado = True
        user.save()
        client.force_login(user)
        assert _post(client, "accounts:auth-reenviar-verificacao").json() == {"ok": True, "jaVerificado": True}
        assert len(mail.outbox) == 0

    def test_alterar_email_obriga_a_nova_verificacao(self, client, user):
        user.email_verificado = True
        user.save()
        client.force_login(user)
        response = _post(
            client, "accounts:api-alterar-email",
            {"senha_atual": "SenhaAntiga123!", "novo_email": "novo@example.com"},
        )
        assert response.status_code == 200
        user.refresh_from_db()
        assert user.email_verificado is False
        assert mail.outbox[-1].to == ["novo@example.com"]


@pytest.mark.django_db
class TestMetricasAdmin:
    def test_exige_staff(self, client, user):
        assert client.get(reverse("accounts:api-admin-metricas")).status_code == 401
        client.force_login(user)
        assert client.get(reverse("accounts:api-admin-metricas")).status_code == 403

    def test_staff_ve_metricas(self, client, user, professor):
        from apps.cursos.models import Curso, Inscricao
        from apps.professores.models import Video, VisualizacaoVideo

        staff = User.objects.create_user(username="admin", password="x", is_staff=True)
        curso = Curso.objects.create(professor=professor, titulo="C1", descricao="d")
        video = Video.objects.create(professor=professor, curso=curso, titulo="V1", ativo=True)
        Inscricao.objects.create(aluno=user.aluno, curso=curso, concluido=True)
        VisualizacaoVideo.objects.create(video=video, utilizador=user, count=3)

        client.force_login(staff)
        body = client.get(reverse("accounts:api-admin-metricas")).json()
        assert body["ok"] is True
        assert body["totais"]["utilizadores"] == 2  # aluno + professor, sem o staff
        assert body["totais"]["inscricoes"] == 1
        assert body["totais"]["taxaConclusao"] == 100
        assert body["ativos"]["semana"] >= 1
        assert len(body["crescimento"]["utilizadores"]) == 12
        assert sum(p["n"] for p in body["crescimento"]["utilizadores"]) == 2
        assert len(body["coortes"]) == 8
        assert body["topCursos"][0]["titulo"] == "C1"
        assert body["topVideos"][0]["views"] == 3
