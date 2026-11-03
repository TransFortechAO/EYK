"""Gestos de LGA em vídeo: só os validados aparecem na plataforma; só a equipa os gere."""
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from apps.accounts.models import User
from apps.plataforma.models import GestoLGA


@pytest.fixture
def staff(db):
    return User.objects.create_user(username="equipa", password="SenhaForte123!", is_staff=True)


def _video(nome="ola.webm"):
    return SimpleUploadedFile(nome, b"webm falso", content_type="video/webm")


@pytest.mark.django_db
class TestGestos:
    def test_equipa_carrega_e_so_os_validados_aparecem(self, client, staff, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path
        client.force_login(staff)
        r = client.post(reverse("plataforma-admin-gestos"), data={"palavra": "Olá", "video": _video()})
        assert r.status_code == 201
        assert r.json()["validado"] is False
        assert client.get(reverse("plataforma-gestos")).json() == {}

        gesto_id = r.json()["id"]
        client.patch(
            reverse("plataforma-admin-gesto", args=[gesto_id]),
            data={"validado": True, "validado_por": "Associação de surdos"},
            content_type="application/json",
        )
        publicos = client.get(reverse("plataforma-gestos")).json()
        assert list(publicos) == ["Olá"]

    def test_so_aceita_video(self, client, staff):
        client.force_login(staff)
        foto = SimpleUploadedFile("x.png", b"png", content_type="image/png")
        assert client.post(reverse("plataforma-admin-gestos"), data={"palavra": "Olá", "video": foto}).status_code == 400

    def test_aluno_nao_gere_gestos(self, client, aluno_user):
        client.force_login(aluno_user)
        assert client.post(reverse("plataforma-admin-gestos"), data={"palavra": "Olá", "video": _video()}).status_code == 403
        assert not GestoLGA.objects.exists()
