import cv2


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


def atualizar_duracao(video):
    duracao = calcular_duracao_segundos(video)
    if duracao and video.duracao_segundos != duracao:
        video.duracao_segundos = duracao
        video.save(update_fields=['duracao_segundos'])
