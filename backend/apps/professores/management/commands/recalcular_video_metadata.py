from django.core.management.base import BaseCommand

from apps.professores.models import Video
from apps.professores.video_processing import atualizar_duracao


class Command(BaseCommand):
    """Recalcula a duração e gera a capa automática (frame do vídeo) para os
    vídeos já existentes que ficaram sem esses dados — por exemplo, vídeos
    enviados antes do OpenCV estar instalado no servidor.

    Uso: python manage.py recalcular_video_metadata [--forcar]
    """

    help = 'Recalcula duração/capa automática dos vídeos existentes (requer OpenCV instalado).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--forcar',
            action='store_true',
            help='Recalcula mesmo os vídeos que já têm duração e/ou capa.',
        )

    def handle(self, *args, **options):
        forcar = options['forcar']

        videos = Video.objects.exclude(arquivo='').filter(arquivo__isnull=False)
        if not forcar:
            from django.db.models import Q
            videos = videos.filter(Q(duracao_segundos=0) | Q(thumbnail=''))

        total = videos.count()
        if total == 0:
            self.stdout.write(self.style.SUCCESS('Nada a fazer: todos os vídeos já têm duração e capa.'))
            return

        self.stdout.write(f'A processar {total} vídeo(s)…')
        atualizados = 0
        for video in videos.iterator():
            if forcar:
                video.duracao_segundos = 0
                video.thumbnail = None
            try:
                atualizar_duracao(video)
                atualizados += 1
            except Exception as exc:  # noqa: BLE001 — continua para os outros vídeos
                self.stderr.write(self.style.WARNING(f'Falhou o vídeo {video.id} ({video}): {exc}'))

        self.stdout.write(self.style.SUCCESS(f'Concluído: {atualizados}/{total} vídeo(s) atualizados.'))
