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
        assert "username" in errors and "email" in errors and "password" in errors


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
