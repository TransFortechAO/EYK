"""Envia já o lembrete de ofensiva. Normalmente não é preciso: o agendador
(Celery beat) envia-o todos os dias à hora definida em
Administração → Plataforma.

    python manage.py lembrete_ofensiva
"""
from django.core.management.base import BaseCommand

from apps.gamificacao.lembretes import enviar_lembretes_ofensiva


class Command(BaseCommand):
    help = 'Envia o lembrete de ofensiva a quem ainda não teve atividade hoje.'

    def handle(self, *args, **options):
        total = enviar_lembretes_ofensiva()
        self.stdout.write(self.style.SUCCESS(f'{total} lembrete(s) enviado(s).'))
