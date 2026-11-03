"""Limites de upload separados: vídeo avulso e vídeo de uma aula de curso."""
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from apps.plataforma.servicos import configuracao, limpar_cache_configuracao

DOIS_MB = b"0" * (2 * 1024 * 1024)


def _video(nome="aula.mp4"):
    return SimpleUploadedFile(nome, DOIS_MB, content_type="video/mp4")


@pytest.fixture
def limites(db):
    def definir(video_mb, aula_mb):
        config = configuracao()
        config.limite_video_mb = video_mb
        config.limite_aula_mb = aula_mb
        config.save()
        limpar_cache_configuracao()
    yield definir
    limpar_cache_configuracao()


@pytest.mark.django_db
class TestLimitesUpload:
    def test_aula_de_curso_usa_o_limite_das_aulas(self, client, professor_user, professor, limites):
        limites(video_mb=500, aula_mb=1)
        client.force_login(professor_user)
        r = client.post(reverse("api-professor-cursos"), data={"titulo": "C", "descricao": "d", "videos": [_video()]})
        assert r.status_code == 400
        assert "aula" in r.json()["detail"]

    def test_video_avulso_usa_o_limite_dos_videos(self, client, professor_user, professor, limites):
        limites(video_mb=1, aula_mb=500)
        client.force_login(professor_user)
        r = client.post(reverse("api-professor-videos"), data={"titulo": "V", "arquivo": _video("v.mp4")})
        assert r.status_code == 400
        assert "vídeo" in r.json()["detail"]
