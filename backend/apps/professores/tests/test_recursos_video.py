"""Recursos (PDF) juntos a um vídeo avulso aparecem no detalhe público do vídeo."""
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test.client import BOUNDARY, MULTIPART_CONTENT, encode_multipart
from django.urls import reverse

from apps.professores.models import Video


@pytest.mark.django_db
def test_recurso_juntado_ao_editar_aparece_no_video(client, professor_user, professor, aluno_user, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    video = Video.objects.create(professor=professor, titulo="Alfabeto", url_externa="https://youtube.com/watch?v=a", ativo=True)
    client.force_login(professor_user)
    pdf = SimpleUploadedFile("ficha.pdf", b"%PDF-1.4 ficha", content_type="application/pdf")
    r = client.generic(
        "PATCH",
        reverse("api-professor-video-detail", args=[video.id]),
        encode_multipart(BOUNDARY, {"titulo": "Alfabeto", "url_externa": "https://youtube.com/watch?v=a", "recursos": pdf}),
        content_type=MULTIPART_CONTENT,
    )
    assert r.status_code == 200, r.content

    client.force_login(aluno_user)
    detalhe = client.get(reverse("video-detail", args=[video.id])).json()
    assert [rec["nome"] for rec in detalhe["recursos"]] == ["ficha.pdf"]
    assert detalhe["recursos"][0]["arquivo_url"]
