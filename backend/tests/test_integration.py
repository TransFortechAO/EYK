"""Testes de integração que atravessam vários apps do backend Django."""

import json

import pytest
from django.urls import reverse

from apps.accounts.models import User
from apps.alunos.models import Aluno
from apps.feed.models import Post
from apps.gamificacao.models import Carteira


@pytest.mark.django_db
class TestJornadaDoAluno:
    def test_registo_cria_conta_e_perfil_de_aluno(self, client):
        response = client.post(
            reverse("accounts:auth-register-json"),
            data=json.dumps({
                "username": "mariaaluna",
                "email": "maria@exemplo.com",
                "password": "SenhaForte123!",
            }),
            content_type="application/json",
        )

        assert response.status_code == 200
        assert response.json()["ok"] is True

        user = User.objects.get(username="mariaaluna")
        assert user.is_student is True
        assert Aluno.objects.filter(profile=user).exists()
        assert response.wsgi_request.user.is_authenticated

    def test_publicar_no_feed_credita_moedas_na_carteira(self, client, aluno_user):
        client.force_login(aluno_user)

        response = client.post(
            "/api/comunidade/posts/",
            data={"conteudo": "O meu primeiro post!"},
            content_type="application/json",
        )

        assert response.status_code == 201
        assert Post.objects.filter(autor=aluno_user, conteudo="O meu primeiro post!").exists()
        carteira = Carteira.objects.get(utilizador=aluno_user)
        assert carteira.saldo == 2

    def test_registar_atividade_diaria_nao_duplica_bonus_no_mesmo_dia(self, aluno_user):
        from apps.gamificacao.models import Ofensiva
        from apps.gamificacao.services import registrar_atividade_diaria

        primeira = registrar_atividade_diaria(aluno_user)
        segunda = registrar_atividade_diaria(aluno_user)

        assert primeira is True
        assert segunda is False
        assert Ofensiva.objects.get(utilizador=aluno_user).dias_atual == 1
