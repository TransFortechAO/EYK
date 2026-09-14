import os
import cv2
from django.core.files.base import ContentFile


def calcular_duracao_segundos(video):
    """Lê a duração real do ficheiro de vídeo já gravado em disco.

    Precisa de correr depois de o ficheiro ser guardado — o OpenCV lê pelo
    caminho no disco, não consegue abrir o upload ainda em memória. Vídeos
    sem ficheiro próprio (só link externo) ficam com duração 0: não há como
    sabê-la sem consultar a API do YouTube, e é preferível não mostrar nada
    a inventar um número.
    """
    if not video.arquivo:
        return 0
    try:
        cap = cv2.VideoCapture(video.arquivo.path)
        if not cap.isOpened():
            return 0
        fps = cap.get(cv2.CAP_PROP_FPS) or 0
        total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
        cap.release()
        return int(total_frames / fps) if fps > 0 else 0
    except Exception:
        return 0


def extrair_thumbnail_video(video, tempo_segundos: int = 1) -> bool:
    """Extrai uma frame do vídeo (por defeito ao segundo 1) e guarda-a
    como `thumbnail` do modelo `Video`. Devolve `True` se foi bem-sucedido,
    `False` caso contrário (ou se já existia thumbnail)."""
    if video.thumbnail or not video.arquivo:
        return False

    try:
        cap = cv2.VideoCapture(video.arquivo.path)
        if not cap.isOpened():
            return False

        fps = cap.get(cv2.CAP_PROP_FPS) or 0
        total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0

        if fps <= 0 or total_frames <= 0:
            cap.release()
            return False

        target_frame = int(tempo_segundos * fps)
        if target_frame >= total_frames:
            target_frame = max(0, int(total_frames * 0.1))

        cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
        ret, frame = cap.read()
        cap.release()

        if not ret or frame is None:
            return False

        success, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if not success:
            return False

        nome_ficheiro = f"video_{video.id or 'temp'}_thumb.jpg"
        video.thumbnail.save(nome_ficheiro, ContentFile(buffer.tobytes()), save=False)
        return True
    except Exception:
        return False


def atualizar_duracao(video):
    duracao = calcular_duracao_segundos(video)
    atualizar_campos = []

    if duracao and video.duracao_segundos != duracao:
        video.duracao_segundos = duracao
        atualizar_campos.append('duracao_segundos')

    gerou_thumb = extrair_thumbnail_video(video)
    if gerou_thumb:
        atualizar_campos.append('thumbnail')

    if atualizar_campos:
        video.save(update_fields=atualizar_campos)

    if gerou_thumb and video.curso_id:
        curso = video.curso
        if not curso.thumbnail:
            from apps.cursos.models import Curso
            curso.thumbnail.save(
                f"curso_{curso.id}_thumb.jpg",
                video.thumbnail.file,
                save=True,
            )
