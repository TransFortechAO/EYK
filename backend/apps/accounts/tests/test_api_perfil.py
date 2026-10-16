import json
import time

import pytest
from django.urls import reverse
from django_otp.oath import TOTP
from django_otp.plugins.otp_totp.models import TOTPDevice

from apps.accounts.models import User


def _post_json(client, url_name, data):
    return client.post(reverse(url_name), data=json.dumps(data), content_type="application/json")


def _codigo_totp_valido(device: TOTPDevice) -> str:
    totp = TOTP(device.bin_key, device.step, device.t0, device.digits, device.drift)
    totp.time = time.time()
    return str(totp.token()).zfill(device.digits)


@pytest.mark.django_db
class TestPerfilCompletar:
    def test_exige_autenticacao(self, client):
        response = client.post(reverse("accounts:api-perfil-completar"))
        assert response.status_code == 401

    def test_marca_perfil_como_completo(self, client, aluno_user):
        aluno_user.perfil_completo = False
        aluno_user.save(update_fields=["perfil_completo"])
        client.force_login(aluno_user)

        response = client.post(reverse("accounts:api-perfil-completar"))
        assert response.status_code == 200
        body = response.json()
        assert body["ok"] is True
        assert body["user"]["perfilCompleto"] is True
        aluno_user.refresh_from_db()
        assert aluno_user.perfil_completo is True


@pytest.mark.django_db
class TestPreferenciasAtualizar:
    def test_exige_autenticacao(self, client):
        response = _post_json(client, "accounts:api-preferencias-atualizar", {"tema_preferido": "escuro"})
        assert response.status_code == 401

    def test_atualiza_tema_e_notificacoes(self, client, aluno_user):
        client.force_login(aluno_user)
        response = _post_json(client, "accounts:api-preferencias-atualizar", {
            "tema_preferido": "escuro",
            "notif_email_comunidade": False,
        })
        assert response.status_code == 200
        body = response.json()["user"]
        assert body["temaPreferido"] == "escuro"
        assert body["notifEmailComunidade"] is False
        aluno_user.refresh_from_db()
        assert aluno_user.tema_preferido == "escuro"
        assert aluno_user.notif_email_comunidade is False

    def test_rejeita_tema_invalido(self, client, aluno_user):
        client.force_login(aluno_user)
        response = _post_json(client, "accounts:api-preferencias-atualizar", {"tema_preferido": "roxo"})
        assert response.status_code == 400

    def test_json_invalido_400(self, client, aluno_user):
        client.force_login(aluno_user)
        response = client.post(
            reverse("accounts:api-preferencias-atualizar"), data="{invalido", content_type="application/json",
        )
        assert response.status_code == 400


@pytest.mark.django_db
class TestAlterarSenha:
    def test_exige_autenticacao(self, client):
        response = _post_json(client, "accounts:api-alterar-senha", {"senha_atual": "x", "nova_senha": "y" * 10})
        assert response.status_code == 401

    def test_altera_senha_e_mantem_sessao(self, client, aluno_user):
        client.force_login(aluno_user)
        response = _post_json(client, "accounts:api-alterar-senha", {
            "senha_atual": "SenhaForte123!",
            "nova_senha": "OutraSenhaForte456!",
        })
        assert response.status_code == 200
        assert response.json()["ok"] is True
        assert response.wsgi_request.user.is_authenticated

        aluno_user.refresh_from_db()
        assert aluno_user.check_password("OutraSenhaForte456!")

    def test_rejeita_senha_atual_incorreta(self, client, aluno_user):
        client.force_login(aluno_user)
        response = _post_json(client, "accounts:api-alterar-senha", {
            "senha_atual": "errada",
            "nova_senha": "OutraSenhaForte456!",
        })
        assert response.status_code == 400
        aluno_user.refresh_from_db()
        assert aluno_user.check_password("SenhaForte123!")

    def test_rejeita_nova_senha_curta(self, client, aluno_user):
        client.force_login(aluno_user)
        response = _post_json(client, "accounts:api-alterar-senha", {
            "senha_atual": "SenhaForte123!",
            "nova_senha": "curta",
        })
        assert response.status_code == 400


@pytest.mark.django_db
class TestFluxo2FA:
    def test_status_inicialmente_inativo(self, client, aluno_user):
        client.force_login(aluno_user)
        response = client.get(reverse("accounts:api-2fa-status"))
        assert response.status_code == 200
        assert response.json()["ativo"] is False

    def test_iniciar_exige_autenticacao(self, client):
        response = client.post(reverse("accounts:api-2fa-iniciar"))
        assert response.status_code == 401

    def test_fluxo_completo_iniciar_confirmar_e_desativar(self, client, aluno_user):
        client.force_login(aluno_user)

        r_iniciar = client.post(reverse("accounts:api-2fa-iniciar"))
        assert r_iniciar.status_code == 200
        body = r_iniciar.json()
        assert body["ok"] is True
        assert body["qrBase64"]
        assert body["secret"]

        device = TOTPDevice.objects.get(user=aluno_user, confirmed=False)
        codigo = _codigo_totp_valido(device)

        r_confirmar = _post_json(client, "accounts:api-2fa-confirmar", {"codigo": codigo})
        assert r_confirmar.status_code == 200
        body_confirmar = r_confirmar.json()
        assert body_confirmar["ok"] is True
        assert len(body_confirmar["codigosBackup"]) == 10

        # Agora está ativo.
        r_status = client.get(reverse("accounts:api-2fa-status"))
        assert r_status.json()["ativo"] is True

        # Desativar remove tudo.
        r_desativar = client.post(reverse("accounts:api-2fa-desativar-json"))
        assert r_desativar.status_code == 200
        assert not TOTPDevice.objects.filter(user=aluno_user).exists()
        r_status2 = client.get(reverse("accounts:api-2fa-status"))
        assert r_status2.json()["ativo"] is False

    def test_confirmar_com_codigo_invalido(self, client, aluno_user):
        client.force_login(aluno_user)
        client.post(reverse("accounts:api-2fa-iniciar"))
        response = _post_json(client, "accounts:api-2fa-confirmar", {"codigo": "000000"})
        assert response.status_code == 400

    def test_confirmar_sem_configuracao_pendente(self, client, aluno_user):
        client.force_login(aluno_user)
        response = _post_json(client, "accounts:api-2fa-confirmar", {"codigo": "123456"})
        assert response.status_code == 400

    def test_iniciar_quando_ja_ativo_e_rejeitado(self, client, aluno_user):
        client.force_login(aluno_user)
        device = TOTPDevice.objects.create(user=aluno_user, confirmed=True, name="default")
        response = client.post(reverse("accounts:api-2fa-iniciar"))
        assert response.status_code == 400


@pytest.mark.django_db
class TestAuthVerificar2FAJson:
    def test_sem_sessao_pendente_falha(self, client):
        response = _post_json(client, "accounts:auth-verificar-2fa-json", {"codigo": "123456"})
        assert response.status_code == 400

    def test_completa_login_com_codigo_valido(self, client, aluno_user):
        device = TOTPDevice.objects.create(user=aluno_user, confirmed=True, name="default")

        # Simula o 1º passo: login válido mas pendente de 2FA (ver auth_login_json).
        from apps.accounts.views import PRE_2FA_SESSION_KEY

        session = client.session
        session[PRE_2FA_SESSION_KEY] = aluno_user.id
        session.save()

        codigo = _codigo_totp_valido(device)
        response = _post_json(client, "accounts:auth-verificar-2fa-json", {"codigo": codigo})
        assert response.status_code == 200
        body = response.json()
        assert body["ok"] is True
        assert body["user"]["username"] == aluno_user.username
        assert response.wsgi_request.user.is_authenticated

    def test_codigo_invalido_nao_autentica(self, client, aluno_user):
        TOTPDevice.objects.create(user=aluno_user, confirmed=True, name="default")
        from apps.accounts.views import PRE_2FA_SESSION_KEY

        session = client.session
        session[PRE_2FA_SESSION_KEY] = aluno_user.id
        session.save()

        response = _post_json(client, "accounts:auth-verificar-2fa-json", {"codigo": "000000"})
        assert response.status_code == 400
        assert not response.wsgi_request.user.is_authenticated
