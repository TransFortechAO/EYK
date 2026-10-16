from celery import shared_task
from django.utils import timezone

from .models import Ofensiva


@shared_task
def resetar_ofensivas_quebradas():
    """Zera a ofensiva de quem não teve actividade desde ontem."""
    ontem = timezone.localdate() - timezone.timedelta(days=1)
    atualizadas = Ofensiva.objects.filter(dias_atual__gt=0).exclude(ultima_atividade__gte=ontem).update(dias_atual=0)
    return f'{atualizadas} ofensivas resetadas'
