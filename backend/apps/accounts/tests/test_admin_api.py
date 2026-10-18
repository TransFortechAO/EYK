import json

import pytest
from django.urls import reverse

from apps.accounts.models import User
from apps.professores.models import Professor


def _post_json(client, url_name, data, args=None):
    return client.post(
        reverse(url_name, args=args) if args else reverse(url_name),
        data=json.dumps(data),
        content_type="application/json",
    )


@pytest.fixture
def staff_user(db):
    return User.objects.create_user(username="admin1", password="SenhaForte123!", is_staff=True)


@pytest.mark.django_db
class TestApiListarProfessores:
    def test_exige_staff(self, client, aluno_user):
        client.force_login(aluno_user)
        response = client.get(reverse("accounts:api-admin-listar-professores"))
        assert response.status_code == 403

    def test_nao_autenticado_401(self, client):
        response = client.get(reverse("accounts:api-admin-listar-professores"))
        assert response.status_code == 401

    def test_staff_lista_professores(self, client, staff_user, professor, professor_user):
        client.force_login(staff_user)
        response = client.get(reverse("accounts:api-admin-listar-professores"))
        assert response.status_code == 200
        body = response.json()
        assert body["ok"] is True
        assert len(body["professores"]) == 1
        assert body["professores"][0]["nome_publico"] == professor.nome_publico


@pytest.mark.django_db
class TestApiRegistarProfessor:
    def test_exige_staff(self, client, aluno_user):
        client.force_login(aluno_user)
        response = _post_json(client, "accounts:api-admin-registar-professor", {})
        assert response.status_code == 403

    def test_cria_professor_com_dados_validos(self, client, staff_user):
        client.force_login(staff_user)
        response = _post_json(client, "accounts:api-admin-registar-professor", {
            "username": "profnovo",
            "email": "profnovo@exemplo.com",
            "password": "senha123",
            "nome_publico": "Prof. Novo",
            "area": "Matemática",
        })
        assert response.status_code == 201
        body = response.json()
        assert body["ok"] is True
        user = User.objects.get(username="profnovo")
        assert user.is_teacher is True
        assert user.perfil_completo is False
        assert Professor.objects.filter(user=user, nome_publico="Prof. Novo").exists()

    def test_rejeita_username_duplicado(self, client, staff_user, professor_user):
        client.force_login(staff_user)
        response = _post_json(client, "accounts:api-admin-registar-professor", {
            "username": professor_user.username,
            "email": "outro@exemplo.com",
            "password": "senha123",
            "nome_publico": "X",
            "area": "Y",
        })
        assert response.status_code == 400
        assert "username" in response.json()["errors"]

    def test_rejeita_campos_em_falta(self, client, staff_user):
        client.force_login(staff_user)
        response = _post_json(client, "accounts:api-admin-registar-professor", {})
        assert response.status_code == 400
        errors = response.json()["errors"]
        assert "username" in errors and "email" in errors and "nome_publico" in errors
        # A senha e a área são opcionais: não são erros quando faltam.
        assert "password" not in errors and "area" not in errors

    def test_area_e_senha_opcionais_gera_senha_e_envia_email(self, client, staff_user):
        from django.core import mail

        client.force_login(staff_user)
        response = _post_json(client, "accounts:api-admin-registar-professor", {
            "username": "profsemarea",
            "email": "profsemarea@exemplo.com",
            "nome_publico": "Prof. Sem Área",
        })
        assert response.status_code == 201
        body = response.json()
        assert body["email_enviado"] is True
        assert "senha_temporaria" not in body  # só volta quando o email falha
        assert body["professor"]["area"] == ""

        user = User.objects.get(username="profsemarea")
        assert user.deve_alterar_senha is True
        assert Professor.objects.get(user=user).area == ""

        assert len(mail.outbox) == 1
        email = mail.outbox[0]
        assert email.to == ["profsemarea@exemplo.com"]
        assert "profsemarea" in email.body
        assert "Parabéns" in email.body
        # A senha enviada por email é a que a conta realmente tem.
        senha = next(
            linha.split(":", 1)[1].strip()
            for linha in email.body.splitlines()
            if "Senha temporária:" in linha
        )
        assert user.check_password(senha)

    def test_senha_indicada_pelo_admin_e_usada(self, client, staff_user):
        client.force_login(staff_user)
        response = _post_json(client, "accounts:api-admin-registar-professor", {
            "username": "profcomsenha", "email": "pcs@exemplo.com",
            "nome_publico": "Prof. Com Senha", "password": "temporaria1",
        })
        assert response.status_code == 201
        assert User.objects.get(username="profcomsenha").check_password("temporaria1")

    def test_falha_no_email_devolve_senha_ao_admin(self, client, staff_user, settings):
        settings.EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
        settings.EMAIL_HOST = "localhost"
        settings.EMAIL_PORT = 1  # ligação recusada
        settings.EMAIL_TIMEOUT = 1
        client.force_login(staff_user)
        response = _post_json(client, "accounts:api-admin-registar-professor", {
            "username": "proffalha", "email": "pf@exemplo.com", "nome_publico": "Prof. Falha",
        })
        assert response.status_code == 201  # a conta fica criada
        body = response.json()
        assert body["email_enviado"] is False
        assert User.objects.get(username="proffalha").check_password(body["senha_temporaria"])


@pytest.mark.django_db
class TestApiRegistarAdministrador:
    URL = "accounts:api-admin-registar-administrador"

    @pytest.fixture
    def superuser(self, db):
        return User.objects.create_superuser(username="root1", email="root@exemplo.com", password="SenhaForte123!")

    def test_nao_autenticado_401(self, client):
        assert _post_json(client, self.URL, {}).status_code == 401

    def test_aluno_e_professor_nao_podem(self, client, aluno_user):
        client.force_login(aluno_user)
        assert _post_json(client, self.URL, {}).status_code == 403

    def test_staff_sem_ser_superuser_nao_pode(self, client, staff_user):
        client.force_login(staff_user)
        response = _post_json(client, self.URL, {
            "username": "novoadmin", "email": "na@exemplo.com",
        })
        assert response.status_code == 403
        assert not User.objects.filter(username="novoadmin").exists()

    def test_superuser_cria_outro_superuser(self, client, superuser):
        from django.core import mail

        client.force_login(superuser)
        response = _post_json(client, self.URL, {
            "username": "novoadmin", "email": "na@exemplo.com", "nome": "Nova Admin",
        })
        assert response.status_code == 201
        body = response.json()
        assert body["ok"] is True and body["email_enviado"] is True

        novo = User.objects.get(username="novoadmin")
        assert novo.is_staff and novo.is_superuser
        assert novo.deve_alterar_senha is True
        assert novo.first_name == "Nova Admin"
        assert len(mail.outbox) == 1 and mail.outbox[0].to == ["na@exemplo.com"]

    def test_rejeita_username_e_email_duplicados(self, client, superuser):
        client.force_login(superuser)
        response = _post_json(client, self.URL, {"username": superuser.username, "email": superuser.email})
        assert response.status_code == 400
        errors = response.json()["errors"]
        assert "username" in errors and "email" in errors


@pytest.mark.django_db
class TestSenhaTemporaria:
    def test_alterar_senha_limpa_a_obrigacao_de_trocar(self, client):
        user = User.objects.create_user(
            username="temp1", email="t1@exemplo.com", password="Temporaria123", deve_alterar_senha=True,
        )
        client.force_login(user)
        me = client.get(reverse("accounts:auth-me")).json()["user"]
        assert me["deveAlterarSenha"] is True

        response = _post_json(client, "accounts:api-alterar-senha", {
            "senha_atual": "Temporaria123", "nova_senha": "MinhaSenhaNova456",
        })
        assert response.status_code == 200
        user.refresh_from_db()
        assert user.deve_alterar_senha is False
        assert user.check_password("MinhaSenhaNova456")

    def test_nova_senha_igual_a_atual_e_rejeitada(self, client):
        user = User.objects.create_user(
            username="temp2", password="Temporaria123", deve_alterar_senha=True,
        )
        client.force_login(user)
        response = _post_json(client, "accounts:api-alterar-senha", {
            "senha_atual": "Temporaria123", "nova_senha": "Temporaria123",
        })
        assert response.status_code == 400
        user.refresh_from_db()
        assert user.deve_alterar_senha is True

    def test_payload_expoe_is_superuser(self, client):
        root = User.objects.create_superuser(username="root2", email="r2@exemplo.com", password="SenhaForte123!")
        client.force_login(root)
        me = client.get(reverse("accounts:auth-me")).json()["user"]
        assert me["isSuperuser"] is True and me["deveAlterarSenha"] is False


@pytest.mark.django_db
class TestApiListarUtilizadores:
    def test_exige_staff(self, client, aluno_user):
        client.force_login(aluno_user)
        response = client.get(reverse("accounts:api-admin-listar-utilizadores"))
        assert response.status_code == 403

    def test_lista_todos_por_omissao(self, client, staff_user, aluno_user, professor_user):
        client.force_login(staff_user)
        response = client.get(reverse("accounts:api-admin-listar-utilizadores"))
        assert response.status_code == 200
        usernames = {u["username"] for u in response.json()["users"]}
        assert aluno_user.username in usernames
        assert professor_user.username in usernames

    def test_filtra_por_tipo_professor(self, client, staff_user, aluno_user, professor_user):
        client.force_login(staff_user)
        response = client.get(reverse("accounts:api-admin-listar-utilizadores") + "?tipo=professor")
        usernames = {u["username"] for u in response.json()["users"]}
        assert professor_user.username in usernames
        assert aluno_user.username not in usernames

    def test_filtra_por_pesquisa_q(self, client, staff_user, aluno_user, professor_user):
        client.force_login(staff_user)
        response = client.get(reverse("accounts:api-admin-listar-utilizadores") + f"?q={aluno_user.username}")
        usernames = {u["username"] for u in response.json()["users"]}
        assert aluno_user.username in usernames
        assert professor_user.username not in usernames

    def test_devolve_saldo_real_da_carteira_nao_sempre_zero(self, client, staff_user, aluno_user):
        from apps.gamificacao.models import Carteira

        Carteira.objects.create(utilizador=aluno_user, saldo=123)
        client.force_login(staff_user)
        response = client.get(reverse("accounts:api-admin-listar-utilizadores"))
        utilizador = next(u for u in response.json()["users"] if u["username"] == aluno_user.username)
        # Bug corrigido: `getattr(u, 'coins', 0)` devolvia sempre 0 — `User`
        # nunca teve esse atributo; o saldo real vive em `Carteira`.
        assert utilizador["coins"] == 123


@pytest.mark.django_db
class TestApiToggleAtivoUsuario:
    def test_exige_staff(self, client, aluno_user):
        client.force_login(aluno_user)
        response = client.post(reverse("accounts:api-admin-toggle-ativo-usuario", args=[aluno_user.id]))
        assert response.status_code == 403

    def test_desativa_e_reativa_utilizador(self, client, staff_user, aluno_user):
        client.force_login(staff_user)
        response = client.post(reverse("accounts:api-admin-toggle-ativo-usuario", args=[aluno_user.id]))
        assert response.status_code == 200
        assert response.json()["is_active"] is False
        aluno_user.refresh_from_db()
        assert aluno_user.is_active is False

        response2 = client.post(reverse("accounts:api-admin-toggle-ativo-usuario", args=[aluno_user.id]))
        assert response2.json()["is_active"] is True

    def test_nao_pode_desativar_a_propria_conta(self, client, staff_user):
        client.force_login(staff_user)
        response = client.post(reverse("accounts:api-admin-toggle-ativo-usuario", args=[staff_user.id]))
        assert response.status_code == 400
        staff_user.refresh_from_db()
        assert staff_user.is_active is True

    def test_nao_pode_desativar_outro_staff(self, client, staff_user):
        outro_staff = User.objects.create_user(username="admin2", password="SenhaForte123!", is_staff=True)
        client.force_login(staff_user)
        response = client.post(reverse("accounts:api-admin-toggle-ativo-usuario", args=[outro_staff.id]))
        assert response.status_code == 400

    def test_utilizador_inexistente_404(self, client, staff_user):
        client.force_login(staff_user)
        response = client.post(reverse("accounts:api-admin-toggle-ativo-usuario", args=[999999]))
        assert response.status_code == 404


@pytest.mark.django_db
class TestApiApagarUsuario:
    def test_exige_staff(self, client, aluno_user):
        client.force_login(aluno_user)
        response = client.post(reverse("accounts:api-admin-apagar-usuario", args=[aluno_user.id]))
        assert response.status_code == 403

    def test_apaga_utilizador(self, client, staff_user, aluno_user):
        client.force_login(staff_user)
        response = client.post(reverse("accounts:api-admin-apagar-usuario", args=[aluno_user.id]))
        assert response.status_code == 200
        assert not User.objects.filter(id=aluno_user.id).exists()

    def test_nao_pode_apagar_a_propria_conta(self, client, staff_user):
        client.force_login(staff_user)
        response = client.post(reverse("accounts:api-admin-apagar-usuario", args=[staff_user.id]))
        assert response.status_code == 400
        assert User.objects.filter(id=staff_user.id).exists()

    def test_nao_pode_apagar_outro_staff(self, client, staff_user):
        outro_staff = User.objects.create_user(username="admin3", password="SenhaForte123!", is_staff=True)
        client.force_login(staff_user)
        response = client.post(reverse("accounts:api-admin-apagar-usuario", args=[outro_staff.id]))
        assert response.status_code == 400
        assert User.objects.filter(id=outro_staff.id).exists()
