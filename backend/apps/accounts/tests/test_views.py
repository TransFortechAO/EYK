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

    def test_register_com_email_duplicado_nao_cria_utilizador(self, client):
        # Precisa de ser único: é por este email que o login passou a poder
        # entrar (ver accounts:auth-login-json), não só pelo username.
        User.objects.create_user(username="existente", email="ocupado@exemplo.com", password="SenhaForte123!")

        response = _post_json(client, "accounts:auth-register-json", {
            "username": "outronome",
            "email": "ocupado@exemplo.com",
            "password": "SenhaForte123!",
        })

        assert response.status_code == 400
        assert not User.objects.filter(username="outronome").exists()


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

    def test_login_com_email_em_vez_de_username(self, client):
        User.objects.create_user(
            username="joana", email="joana@exemplo.com", password="SenhaForte123!",
        )
        response = _post_json(client, "accounts:auth-login-json", {
            "username": "joana@exemplo.com",
            "password": "SenhaForte123!",
        })

        assert response.status_code == 200
        body = response.json()
        assert body["ok"] is True
        assert body["user"]["username"] == "joana"

    def test_login_com_email_e_case_insensitive(self, client):
        User.objects.create_user(
            username="joana", email="Joana@Exemplo.com", password="SenhaForte123!",
        )
        response = _post_json(client, "accounts:auth-login-json", {
            "username": "joana@exemplo.com",
            "password": "SenhaForte123!",
        })
        assert response.status_code == 200
        assert response.json()["ok"] is True

    def test_login_com_email_inexistente_falha_normalmente(self, client):
        response = _post_json(client, "accounts:auth-login-json", {
            "username": "ninguem@exemplo.com",
            "password": "SenhaForte123!",
        })
        assert response.status_code == 401
        assert response.json()["ok"] is False

    def test_login_com_email_duplicado_nao_resolve_e_falha_em_seguranca(self, client):
        # Cenário defensivo: se por algum motivo existirem duas contas com o
        # mesmo email (não devia acontecer — ver UserRegisterForm.clean_email),
        # o login por email não escolhe uma à sorte; falha como inválido.
        User.objects.create_user(username="joana1", email="duplicado@exemplo.com", password="SenhaForte123!")
        User.objects.create_user(username="joana2", email="duplicado@exemplo.com", password="OutraSenha123!")

        response = _post_json(client, "accounts:auth-login-json", {
            "username": "duplicado@exemplo.com",
            "password": "SenhaForte123!",
        })
        assert response.status_code == 401


@pytest.mark.django_db
class TestAlterarEmail:
    def test_altera_email_com_senha_correta(self, client, aluno_user):
        aluno_user.email = "antigo@exemplo.com"
        aluno_user.save(update_fields=["email"])
        client.force_login(aluno_user)

        response = _post_json(client, "accounts:api-alterar-email", {
            "senha_atual": "SenhaForte123!",
            "novo_email": "novo@exemplo.com",
        })

        assert response.status_code == 200
        body = response.json()
        assert body["ok"] is True
        assert body["user"]["email"] == "novo@exemplo.com"
        aluno_user.refresh_from_db()
        assert aluno_user.email == "novo@exemplo.com"

    def test_rejeita_senha_incorreta(self, client, aluno_user):
        client.force_login(aluno_user)
        response = _post_json(client, "accounts:api-alterar-email", {
            "senha_atual": "senha-errada",
            "novo_email": "novo@exemplo.com",
        })
        assert response.status_code == 400
        assert response.json()["ok"] is False

    def test_rejeita_email_invalido(self, client, aluno_user):
        client.force_login(aluno_user)
        response = _post_json(client, "accounts:api-alterar-email", {
            "senha_atual": "SenhaForte123!",
            "novo_email": "nao-e-um-email",
        })
        assert response.status_code == 400

    def test_rejeita_email_ja_em_uso(self, client, aluno_user, professor_user):
        professor_user.email = "ocupado@exemplo.com"
        professor_user.save(update_fields=["email"])
        client.force_login(aluno_user)

        response = _post_json(client, "accounts:api-alterar-email", {
            "senha_atual": "SenhaForte123!",
            "novo_email": "ocupado@exemplo.com",
        })
        assert response.status_code == 400
        aluno_user.refresh_from_db()
        assert aluno_user.email != "ocupado@exemplo.com"

    def test_exige_autenticacao(self, client):
        response = _post_json(client, "accounts:api-alterar-email", {
            "senha_atual": "x",
            "novo_email": "novo@exemplo.com",
        })
        assert response.status_code == 401


@pytest.mark.django_db
class TestAuthCsrf:
    def test_devolve_token_e_define_cookie(self, client):
        response = client.get(reverse("accounts:auth-csrf"))
        assert response.status_code == 200
        assert response.json()["csrfToken"]
        assert "csrftoken" in response.cookies


@pytest.mark.django_db
class TestAuthLogoutJson:
    def test_termina_sessao_e_limpa_cookies(self, client, aluno_user):
        client.force_login(aluno_user)
        response = client.post(reverse("accounts:auth-logout-json"))
        assert response.status_code == 200
        assert response.json()["ok"] is True
        assert not response.wsgi_request.user.is_authenticated


@pytest.mark.django_db
class TestAuthMe:
    def test_guest_devolve_authenticated_false(self, client):
        response = client.get(reverse("accounts:auth-me"))
        assert response.status_code == 200
        body = response.json()
        assert body["ok"] is True
        assert body["authenticated"] is False
        assert body["user"] is None

    def test_devolve_saldo_e_streak_reais_da_carteira_e_ofensiva(self, client, aluno_user):
        from apps.gamificacao.models import Carteira, Ofensiva

        Carteira.objects.create(utilizador=aluno_user, saldo=777, xp=10)
        Ofensiva.objects.create(utilizador=aluno_user, dias_atual=3)
        client.force_login(aluno_user)

        response = client.get(reverse("accounts:auth-me"))
        assert response.status_code == 200
        body = response.json()["user"]
        # Bug corrigido: isto devolvia sempre 2380/9, fixos, nunca o saldo
        # real do utilizador (ver nota em accounts/views.py:auth_me).
        assert body["coins"] == 777
        assert body["streak"] == 3

    def test_sem_carteira_nem_ofensiva_devolve_zero_em_vez_de_valor_fixo(self, client, aluno_user):
        client.force_login(aluno_user)
        response = client.get(reverse("accounts:auth-me"))
        body = response.json()["user"]
        assert body["coins"] == 0
        assert body["streak"] == 0


@pytest.mark.django_db
class TestPerfilPublico:
    def test_exige_autenticacao(self, client, aluno_user):
        response = client.get(reverse("accounts:perfil-publico", args=[aluno_user.id]))
        assert response.status_code == 401

    def test_perfil_de_aluno_nao_expoe_dados_confidenciais(self, client, aluno_user, professor_user):
        client.force_login(professor_user)
        response = client.get(reverse("accounts:perfil-publico", args=[aluno_user.id]))
        assert response.status_code == 200
        perfil = response.json()["perfil"]
        assert perfil["isTeacher"] is False
        assert "email" not in perfil
        assert "username" not in perfil
        assert perfil["souEu"] is False

    def test_perfil_de_professor_inclui_dados_publicos_do_professor(self, client, professor_user, professor, aluno_user):
        client.force_login(aluno_user)
        response = client.get(reverse("accounts:perfil-publico", args=[professor_user.id]))
        assert response.status_code == 200
        perfil = response.json()["perfil"]
        assert perfil["isTeacher"] is True
        assert perfil["nomePublico"] == professor.nome_publico
        assert perfil["professorId"] == professor.id

    def test_utilizador_inexistente_404(self, client, aluno_user):
        client.force_login(aluno_user)
        response = client.get(reverse("accounts:perfil-publico", args=[999999]))
        assert response.status_code == 404


@pytest.mark.django_db
class TestPesquisarUtilizadores:
    def test_exige_autenticacao(self, client):
        response = client.get(reverse("accounts:pesquisar-utilizadores") + "?q=jo")
        assert response.status_code == 401

    def test_pesquisa_curta_devolve_lista_vazia(self, client, aluno_user):
        client.force_login(aluno_user)
        response = client.get(reverse("accounts:pesquisar-utilizadores") + "?q=j")
        assert response.status_code == 200
        assert response.json()["utilizadores"] == []

    def test_pesquisa_encontra_por_username_e_exclui_o_proprio(self, client, aluno_user, professor_user):
        client.force_login(aluno_user)
        response = client.get(reverse("accounts:pesquisar-utilizadores") + f"?q={professor_user.username[:4]}")
        assert response.status_code == 200
        utilizadores = response.json()["utilizadores"]
        ids = [u["id"] for u in utilizadores]
        assert professor_user.id in ids
        assert aluno_user.id not in ids

    def test_utilizador_inativo_nao_aparece(self, client, aluno_user):
        from apps.accounts.models import User

        User.objects.create_user(username="inativo123", password="SenhaForte123!", is_active=False)
        client.force_login(aluno_user)
        response = client.get(reverse("accounts:pesquisar-utilizadores") + "?q=inativo")
        assert response.json()["utilizadores"] == []

    def test_administrador_nunca_aparece_na_pesquisa(self, client, aluno_user):
        from apps.accounts.models import User

        User.objects.create_user(username="adminsecreto", password="SenhaForte123!", is_staff=True)
        client.force_login(aluno_user)
        response = client.get(reverse("accounts:pesquisar-utilizadores") + "?q=adminsecreto")
        assert response.json()["utilizadores"] == []

    def test_superuser_nunca_aparece_na_pesquisa(self, client, aluno_user):
        from apps.accounts.models import User

        User.objects.create_superuser(username="superadmin", password="SenhaForte123!", email="s@s.com")
        client.force_login(aluno_user)
        response = client.get(reverse("accounts:pesquisar-utilizadores") + "?q=superadmin")
        assert response.json()["utilizadores"] == []
