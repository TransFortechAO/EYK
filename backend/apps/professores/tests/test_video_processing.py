"""Testes do processamento de vídeo (apps.professores.video_processing).

Usam um pequeno ficheiro de vídeo REAL gerado com o próprio OpenCV (não um
mock) para exercitar o caminho feliz tal como acontece em produção — já
apanhou, no passado, um bug em que o `cv2` nem estava instalado e o servidor
rebentava ao arrancar (ver nota em `_cv2()`).
"""
import os
import tempfile

import cv2
import numpy as np
import pytest
from django.core.files import File
from django.core.files.base import ContentFile

from apps.cursos.models import Curso
from apps.professores import video_processing
from apps.professores.models import Video
from apps.professores.video_processing import (
    atualizar_duracao,
    calcular_duracao_segundos,
    extrair_thumbnail_video,
)


def _gerar_ficheiro_video(duracao_segundos=3, fps=10, tamanho=(64, 64)) -> str:
    """Gera um pequeno .avi real em disco (MJPG — o codec que funciona de
    forma fiável no OpenCV headless deste ambiente)."""
    caminho = tempfile.mktemp(suffix=".avi")
    fourcc = cv2.VideoWriter_fourcc(*"MJPG")
    writer = cv2.VideoWriter(caminho, fourcc, fps, tamanho)
    for i in range(duracao_segundos * fps):
        frame = np.full((tamanho[1], tamanho[0], 3), i % 255, dtype=np.uint8)
        writer.write(frame)
    writer.release()
    return caminho


@pytest.fixture
def video_com_arquivo_real(db, professor):
    caminho = _gerar_ficheiro_video(duracao_segundos=3, fps=10)
    video = Video.objects.create(professor=professor, titulo="Vídeo real", ativo=True)
    with open(caminho, "rb") as f:
        video.arquivo.save("teste.avi", File(f), save=True)
    os.remove(caminho)

    yield video

    if video.arquivo:
        video.arquivo.delete(save=False)
    if video.thumbnail:
        video.thumbnail.delete(save=False)


@pytest.fixture
def video_com_arquivo_corrompido(db, professor):
    video = Video.objects.create(professor=professor, titulo="Vídeo corrompido", ativo=True)
    video.arquivo.save("corrompido.avi", ContentFile(b"isto nao e um video valido"), save=True)
    yield video
    if video.arquivo:
        video.arquivo.delete(save=False)


@pytest.mark.django_db
class TestCalcularDuracaoSegundos:
    def test_sem_arquivo_devolve_zero(self, professor):
        video = Video.objects.create(professor=professor, titulo="Sem ficheiro", url_externa="https://youtu.be/x")
        assert calcular_duracao_segundos(video) == 0

    def test_video_real_devolve_duracao_correta(self, video_com_arquivo_real):
        # 3 segundos a 10 fps = 30 frames → duração ≈ 3s.
        assert calcular_duracao_segundos(video_com_arquivo_real) == 3

    def test_ficheiro_corrompido_devolve_zero_sem_rebentar(self, video_com_arquivo_corrompido):
        assert calcular_duracao_segundos(video_com_arquivo_corrompido) == 0

    def test_sem_opencv_instalado_devolve_zero(self, video_com_arquivo_real, monkeypatch):
        # Simula o ambiente sem OpenCV instalado (ver _cv2()) — a app tem de
        # degradar graciosamente, não rebentar.
        monkeypatch.setattr(video_processing, "_cv2", lambda: None)
        assert calcular_duracao_segundos(video_com_arquivo_real) == 0


@pytest.mark.django_db
class TestExtrairThumbnailVideo:
    def test_sem_arquivo_devolve_false(self, professor):
        video = Video.objects.create(professor=professor, titulo="Sem ficheiro")
        assert extrair_thumbnail_video(video) is False

    def test_video_real_gera_thumbnail(self, video_com_arquivo_real):
        assert extrair_thumbnail_video(video_com_arquivo_real) is True
        assert video_com_arquivo_real.thumbnail
        assert video_com_arquivo_real.thumbnail.name.endswith(".jpg")

    def test_nao_substitui_thumbnail_ja_existente(self, video_com_arquivo_real):
        video_com_arquivo_real.thumbnail.save("existente.jpg", ContentFile(b"jpg falso"), save=True)
        nome_original = video_com_arquivo_real.thumbnail.name
        assert extrair_thumbnail_video(video_com_arquivo_real) is False
        assert video_com_arquivo_real.thumbnail.name == nome_original

    def test_ficheiro_corrompido_devolve_false_sem_rebentar(self, video_com_arquivo_corrompido):
        assert extrair_thumbnail_video(video_com_arquivo_corrompido) is False

    def test_sem_opencv_instalado_devolve_false(self, video_com_arquivo_real, monkeypatch):
        monkeypatch.setattr(video_processing, "_cv2", lambda: None)
        assert extrair_thumbnail_video(video_com_arquivo_real) is False


@pytest.mark.django_db
class TestAtualizarDuracao:
    def test_atualiza_duracao_e_thumbnail_e_grava(self, video_com_arquivo_real):
        assert video_com_arquivo_real.duracao_segundos == 0
        atualizar_duracao(video_com_arquivo_real)

        video_com_arquivo_real.refresh_from_db()
        assert video_com_arquivo_real.duracao_segundos == 3
        assert video_com_arquivo_real.thumbnail

    def test_video_de_curso_propaga_thumbnail_para_curso_sem_capa(self, video_com_arquivo_real, professor):
        curso = Curso.objects.create(professor=professor, titulo="C", descricao="d")
        video_com_arquivo_real.curso = curso
        video_com_arquivo_real.save(update_fields=["curso"])

        atualizar_duracao(video_com_arquivo_real)

        curso.refresh_from_db()
        assert curso.thumbnail
        curso.thumbnail.delete(save=False)

    def test_nao_sobrescreve_capa_do_curso_se_ja_tiver_uma(self, video_com_arquivo_real, professor):
        curso = Curso.objects.create(professor=professor, titulo="C", descricao="d")
        curso.thumbnail.save("capa_do_professor.jpg", ContentFile(b"capa escolhida"), save=True)
        nome_original = curso.thumbnail.name
        video_com_arquivo_real.curso = curso
        video_com_arquivo_real.save(update_fields=["curso"])

        atualizar_duracao(video_com_arquivo_real)

        curso.refresh_from_db()
        assert curso.thumbnail.name == nome_original
        curso.thumbnail.delete(save=False)

    def test_sem_mudancas_nao_grava_campos(self, professor, monkeypatch):
        # Vídeo sem ficheiro: nada a calcular, `save` não deve ser chamado.
        video = Video.objects.create(professor=professor, titulo="Sem ficheiro", url_externa="https://youtu.be/x")
        chamadas = []
        monkeypatch.setattr(Video, "save", lambda self, *a, **k: chamadas.append((a, k)))
        atualizar_duracao(video)
        assert chamadas == []
