"""Lembrete diário de ofensiva (streak): avisa quem tem uma ofensiva de 3+
dias e ainda não teve atividade hoje — antes de a perder à meia-noite.

Enviado pelo agendador (`apps.plataforma.tasks.ciclo_agendador`) à hora
definida em Administração → Plataforma, ou à mão com
`python manage.py lembrete_ofensiva`."""
from django.utils import timezone

from apps.accounts.notificacoes import notificar

from .models import Ofensiva

DIAS_MINIMOS = 3


def enviar_lembretes_ofensiva() -> int:
    """Devolve quantos lembretes foram enviados."""
    ontem = timezone.localdate() - timezone.timedelta(days=1)
    ofensivas = Ofensiva.objects.filter(
        ultima_atividade=ontem, dias_atual__gte=DIAS_MINIMOS,
        utilizador__is_active=True, utilizador__banido=False,
    ).select_related('utilizador')

    total = 0
    for ofensiva in ofensivas.iterator(chunk_size=500):
        notificar(
            ofensiva.utilizador, 'conquista',
            f'A tua ofensiva de {ofensiva.dias_atual} dias acaba hoje! Entra na EYK e vê uma aula para a manteres.',
            link='/inicio', categoria_email='gamificacao',
            assunto_email=f'Não percas a tua ofensiva de {ofensiva.dias_atual} dias',
        )
        total += 1
    return total
