import json

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from apps.accounts.models import User
from apps.alunos.models import Aluno


def _post_json(client, url_name, data):
    return client.post(reverse(url_name), data=json.dumps(data), content_type="application/json")


@pytest.mark.django_db
class TestAlunoPerfilGet:
    def test_exige_autenticacao(self, client):
        response = client.get(reverse("aluno:api-perfil-get"))
        assert response.status_code == 401
        assert response.json()["ok"] is False

    def test_devolve_perfil_e_cria_aluno_se_nao_existir(self, client):
        user = User.objects.create_user(username="semaluno", password="SenhaForte123!", is_student=True)
        # O signal já cria o Aluno ao criar um User is_student=True — apaga-o
        # para testar o `get_or_create` de segurança dentro da própria view.
        Aluno.objects.filter(profile=user).delete()
        client.force_login(user)

        response = client.get(reverse("aluno:api-perfil-get"))
        assert response.status_code == 200
        body = response.json()
        assert body["ok"] is True
        assert body["bio"] == ""
        assert body["foto"] is None
        assert body["tem2fa"] is False
        assert Aluno.objects.filter(profile=user).exists()


@pytest.mark.django_db
class TestAlunoPerfilAtualizar:
    def test_exige_autenticacao(self, client):
        response = client.post(reverse("aluno:api-perfil-atualizar"), data=json.dumps({"bio": "x"}), content_type="application/json")
        assert response.status_code == 401

    def test_atualiza_bio_via_json(self, client, aluno_user):
        client.force_login(aluno_user)
        response = _post_json(client, "aluno:api-perfil-atualizar", {"bio": "Adoro aprender LGP."})
        assert response.status_code == 200
        body = response.json()
        assert body["ok"] is True
        assert body["bio"] == "Adoro aprender LGP."
        aluno = Aluno.objects.get(profile=aluno_user)
        assert aluno.bio == "Adoro aprender LGP."

    def test_json_invalido_devolve_400(self, client, aluno_user):
        client.force_login(aluno_user)
        response = client.post(
            reverse("aluno:api-perfil-atualizar"), data="{invalido", content_type="application/json",
        )
        assert response.status_code == 400

    def test_atualiza_foto_via_multipart(self, client, aluno_user):
        client.force_login(aluno_user)
        foto = SimpleUploadedFile("foto.jpg", b"conteudo-imagem-falso", content_type="image/jpeg")
        response = client.post(
            reverse("aluno:api-perfil-atualizar"), data={"bio": "Nova bio", "foto": foto},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["bio"] == "Nova bio"
        assert body["foto"] is not None
        aluno = Aluno.objects.get(profile=aluno_user)
        assert aluno.foto.name


@pytest.mark.django_db
class TestAlunoApagarConta:
    def test_exige_autenticacao(self, client):
        response = client.post(reverse("aluno:api-apagar-conta"))
        assert response.status_code == 401

    def test_apaga_a_conta_e_termina_sessao(self, client, aluno_user):
        client.force_login(aluno_user)
        response = client.post(reverse("aluno:api-apagar-conta"))
        assert response.status_code == 200
        assert response.json()["ok"] is True
        assert not User.objects.filter(id=aluno_user.id).exists()
        assert not response.wsgi_request.user.is_authenticated
