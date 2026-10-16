import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from apps.professores.models import Video

SRT = b"""1
00:00:01,000 --> 00:00:04,000
Bom dia a todos

2
00:00:05,500 --> 00:00:08,000
Hoje vamos aprender
"""


@pytest.fixture
def video(db, professor):
    return Video.objects.create(professor=professor, titulo='Aula', ativo=True)


@pytest.mark.django_db
class TestLegendas:
    def test_srt_e_convertido_para_vtt(self, client, professor_user, aluno_user, video):
        client.force_login(professor_user)
        url = reverse('api-professor-video-legenda', args=[video.id])
        response = client.post(url, {'legenda': SimpleUploadedFile('aula.srt', SRT)})
        assert response.status_code == 200
        assert response.json()['tem_legenda'] is True

        client.force_login(aluno_user)
        assert client.get(reverse('video-detail', args=[video.id])).json()['tem_legenda'] is True
        legenda = client.get(reverse('video-legenda', args=[video.id]))
        assert legenda['Content-Type'].startswith('text/vtt')
        texto = legenda.content.decode()
        assert texto.startswith('WEBVTT')
        assert '00:00:01.000 --> 00:00:04.000' in texto

    def test_ficheiros_invalidos(self, client, professor_user, video):
        client.force_login(professor_user)
        url = reverse('api-professor-video-legenda', args=[video.id])
        assert client.post(url, {'legenda': SimpleUploadedFile('a.txt', b'x')}).status_code == 400
        assert client.post(url, {'legenda': SimpleUploadedFile('a.vtt', b'sem cabecalho')}).status_code == 400
        assert client.post(url, {'legenda': SimpleUploadedFile('a.vtt', b'WEBVTT\n\nnada')}).status_code == 400

    def test_so_o_dono_e_remover(self, client, professor_user, aluno_user, video):
        client.force_login(aluno_user)
        url = reverse('api-professor-video-legenda', args=[video.id])
        assert client.post(url, {'legenda': SimpleUploadedFile('a.srt', SRT)}).status_code == 403
        client.force_login(professor_user)
        client.post(url, {'legenda': SimpleUploadedFile('a.srt', SRT)})
        assert client.delete(url).json()['tem_legenda'] is False
        assert client.get(reverse('video-legenda', args=[video.id])).status_code == 404

    def test_video_oculto_sai_das_listagens(self, client, aluno_user, video):
        video.oculto = True
        video.save()
        client.force_login(aluno_user)
        assert client.get(reverse('video-list')).json() == []
        assert client.get(reverse('video-detail', args=[video.id])).status_code == 404
