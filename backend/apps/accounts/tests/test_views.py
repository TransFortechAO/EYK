import json

import pytest
from django.urls import reverse

from apps.accounts.models import User
from apps.alunos.models import Aluno


def _post_json(client, url_name, data):
    return client.post(
        reverse(url_name),
        data=json.dumps(data),
        content_type="application/json",
    )


@pytest.mark.django_db
class TestAuthRegisterJson:
    def test_register_cria_aluno_e_inicia_sessao(self, client):
        response = _post_json(client, "accounts:auth-register-json", {
            "username": "novoaluno",
            "email": "novo@exemplo.com",
            "password": "SenhaForte123!",
        })

        assert response.status_code == 200
        body = response.json()
        assert body["ok"] is True
        assert body["user"]["username"] == "novoaluno"

        user = User.objects.get(username="novoaluno")
        assert user.is_student is True
        assert Aluno.objects.filter(profile=user).exists()
        assert response.wsgi_request.user.is_authenticated

    def test_register_com_username_duplicado_nao_cria_utilizador(self, client, aluno_user):
        response = _post_json(client, "accounts:auth-register-json", {
            "username": aluno_user.username,
            "email": "outro@exemplo.com",
            "password": "SenhaForte123!",
        })

        assert response.status_code == 400
        assert response.json()["ok"] is False
        assert User.objects.filter(username=aluno_user.username).count() == 1


@pytest.mark.django_db
class TestAuthLoginJson:
    def test_login_valido_devolve_utilizador_e_inicia_sessao(self, client):
        User.objects.create_user(
            username="joana", password="SenhaForte123!", perfil_completo=True,
        )
        response = _post_json(client, "accounts:auth-login-json", {
            "username": "joana",
            "password": "SenhaForte123!",
        })

        assert response.status_code == 200
        body = response.json()
        assert body["ok"] is True
        assert body["user"]["username"] == "joana"
        assert response.wsgi_request.user.is_authenticated

    def test_login_invalido_nao_autentica(self, client):
        User.objects.create_user(username="joana", password="SenhaForte123!")
        response = _post_json(client, "accounts:auth-login-json", {
            "username": "joana",
            "password": "senha-errada",
        })

        assert response.status_code == 401
        assert response.json()["ok"] is False
        assert not response.wsgi_request.user.is_authenticated
