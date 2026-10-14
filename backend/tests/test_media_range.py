import os

import pytest
from django.conf import settings
from django.test import RequestFactory

from config.views import media_com_range


def _get(path, **headers):
    request = RequestFactory().get(f'/media/{path}', **headers)
    return media_com_range(request, path, document_root=settings.MEDIA_ROOT)


@pytest.fixture
def ficheiro_media():
    pasta = os.path.join(settings.MEDIA_ROOT, 'videos')
    os.makedirs(pasta, exist_ok=True)
    caminho = os.path.join(pasta, 'range-teste.mp4')
    with open(caminho, 'wb') as f:
        f.write(bytes(range(256)) * 4)  # 1024 bytes
    yield 'videos/range-teste.mp4'
    os.remove(caminho)


def test_sem_range_devolve_ficheiro_inteiro(ficheiro_media):
    response = _get(ficheiro_media)
    assert response.status_code == 200
    assert response['Accept-Ranges'] == 'bytes'
    assert b''.join(response.streaming_content) == bytes(range(256)) * 4


def test_range_devolve_206_com_a_parte_pedida(ficheiro_media):
    response = _get(ficheiro_media, HTTP_RANGE='bytes=10-19')
    assert response.status_code == 206
    assert response['Content-Range'] == 'bytes 10-19/1024'
    assert response.content == bytes(range(10, 20))


def test_range_aberto_e_sufixo(ficheiro_media):
    response = _get(ficheiro_media, HTTP_RANGE='bytes=1000-')
    assert response['Content-Range'] == 'bytes 1000-1023/1024'
    response = _get(ficheiro_media, HTTP_RANGE='bytes=-4')
    assert response['Content-Range'] == 'bytes 1020-1023/1024'


def test_range_fora_do_ficheiro(ficheiro_media):
    response = _get(ficheiro_media, HTTP_RANGE='bytes=5000-')
    assert response.status_code == 416
