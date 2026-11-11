"""Trabalho agendado da área das escolas (ver CELERY_BEAT_SCHEDULE em config/settings/base.py)."""
import datetime

from celery import shared_task
from django.utils import timezone

from .models import Evento, Instituicao, RespostaVideo
from .views_comunicacao import avisar_pessoas, destinatarios

ANTECEDENCIA = {'1d': datetime.timedelta(days=1), '1h': datetime.timedelta(hours=1)}


def enviar_lembretes_eventos(agora=None) -> int:
    """Avisa os destinatários dos eventos que estão a chegar; cada lembrete sai uma só vez."""
    agora = agora or timezone.now()
    enviados = 0
    eventos = Evento.objects.select_related('instituicao').filter(
        cancelado=False, inicio__gt=agora, inicio__lte=agora + ANTECEDENCIA['1d'],
        instituicao__estado=Instituicao.ATIVA,
    )
    for ev in eventos:
        for lembrete in ev.lembretes:
            if lembrete in ev.lembretes_enviados or ev.inicio - ANTECEDENCIA[lembrete] > agora:
                continue
            ev.lembretes_enviados = [*ev.lembretes_enviados, lembrete]
            ev.save(update_fields=['lembretes_enviados'])
            quando = 'amanhã' if lembrete == '1d' else 'daqui a pouco'
            avisar_pessoas(
                ev.instituicao, destinatarios(ev), f'Lembrete: {ev.titulo}', f'«{ev.titulo}» é {quando}.',
                '/instituicao/agenda',
            )
            enviados += 1
    return enviados


def apagar_respostas_expiradas(agora=None) -> int:
    """As respostas em vídeo das crianças só ficam até ao fim do ano letivo."""
    agora = agora or timezone.now()
    apagadas = 0
    for r in RespostaVideo.objects.select_related('video', 'feedback_video').filter(apagar_em__lte=agora):
        anexos = [a for a in (r.video, r.feedback_video) if a]
        # O ficheiro primeiro: se o bucket falhar, o registo fica e a próxima volta tenta de novo.
        for anexo in anexos:
            anexo.ficheiro.delete(save=False)
        r.delete()
        for anexo in anexos:
            anexo.delete()
        apagadas += 1
    return apagadas


@shared_task
def tarefas_escolas() -> dict:
    return {'lembretes': enviar_lembretes_eventos(), 'respostas_apagadas': apagar_respostas_expiradas()}
