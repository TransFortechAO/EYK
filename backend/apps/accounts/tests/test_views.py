import pytest
from django.urls import reverse

from apps.accounts.models import User
from apps.alunos.models import Aluno


@pytest.mark.django_db
class TestRegisterView:
    def test_register_cria_aluno_e_inicia_sessao(self, client):
        response = client.post(reverse("accounts:register"), {
            "username": "novoaluno",
            "email": "novo@exemplo.com",
            "password1": "SenhaForte123!",
            "password2": "SenhaForte123!",
        })

        user = User.objects.get(username="novoaluno")
        assert user.is_student is True
        assert Aluno.objects.filter(profile=user).exists()
        assert response.status_code == 302
        assert response.url == reverse("accounts:completar-perfil-aluno")

    def test_register_com_passwords_diferentes_nao_cria_utilizador(self, client):
        response = client.post(reverse("accounts:register"), {
            "username": "novoaluno",
            "email": "novo@exemplo.com",
            "password1": "SenhaForte123!",
            "password2": "OutraSenha456!",
        })

        assert response.status_code == 200
        assert not User.objects.filter(username="novoaluno").exists()


@pytest.mark.django_db
class TestLoginView:
    def test_pagina_de_login_responde_200(self, client):
        response = client.get(reverse("accounts:login"))
        assert response.status_code == 200

    def test_login_valido_redireciona_para_o_frontend(self, client, settings):
        User.objects.create_user(
            username="joana", password="SenhaForte123!", perfil_completo=True,
        )
        response = client.post(reverse("accounts:login"), {
            "username": "joana",
            "password": "SenhaForte123!",
        })
        assert response.status_code == 302
        assert response.url == settings.NEXT_PUBLIC_URL.rstrip("/") + "/"

    def test_login_invalido_nao_autentica(self, client):
        User.objects.create_user(username="joana", password="SenhaForte123!")
        response = client.post(reverse("accounts:login"), {
            "username": "joana",
            "password": "senha-errada",
        })
        assert response.status_code == 200
        assert not response.wsgi_request.user.is_authenticated
