"""Tarefas em segundo plano (Celery) e o agendador.

O Celery beat chama `ciclo_agendador` de 5 em 5 minutos (ver
`CELERY_BEAT_SCHEDULE` em config/settings/base.py). É o ciclo que decide,
com o que os admins definiram em Administração → Plataforma, o que corre:
o lembrete de ofensiva à hora marcada e os anúncios agendados.

Cada tarefa "reserva" o trabalho com um `UPDATE … WHERE` atómico antes de
o fazer — se o beat correr duas vezes, ou houver dois workers, nada é
enviado em duplicado."""
import logging

from celery import shared_task
from django.db.models import Q
from django.utils import timezone

from apps.accounts.models import Notificacao, User
from apps.accounts.notificacoes import enviar_em_massa

from .models import Anuncio, ConfiguracaoPlataforma

logger = logging.getLogger(__name__)

LOTE_ANUNCIO = 500


@shared_task
def ciclo_agendador():
    agora = timezone.now()
    ConfiguracaoPlataforma.objects.get_or_create(pk=1)
    ConfiguracaoPlataforma.objects.filter(pk=1).update(agendador_ultimo_ciclo=agora)

    # Anúncios cuja hora chegou.
    for anuncio_id in Anuncio.objects.filter(estado='agendado', agendado_para__lte=agora).values_list('id', flat=True):
        if Anuncio.objects.filter(pk=anuncio_id, estado='agendado').update(estado='pendente'):
            enviar_anuncio.delay(anuncio_id)

    # Lembrete de ofensiva: uma vez por dia, a partir da hora definida (se o
    # worker esteve parado à hora certa, envia assim que voltar — no mesmo dia).
    config = ConfiguracaoPlataforma.objects.get(pk=1)
    local = timezone.localtime(agora)
    if config.lembrete_ofensiva_ativo and local.time() >= config.lembrete_ofensiva_hora:
        if _reservar_lembrete_de_hoje(local.date()):
            enviar_lembrete_ofensiva.delay()


def _reservar_lembrete_de_hoje(hoje) -> bool:
    return bool(
        ConfiguracaoPlataforma.objects.filter(pk=1)
        .filter(Q(lembrete_ofensiva_ultimo_dia__isnull=True) | Q(lembrete_ofensiva_ultimo_dia__lt=hoje))
        .update(lembrete_ofensiva_ultimo_dia=hoje)
    )


@shared_task
def enviar_lembrete_ofensiva():
    from apps.gamificacao.lembretes import enviar_lembretes_ofensiva

    total = enviar_lembretes_ofensiva()
    ConfiguracaoPlataforma.objects.filter(pk=1).update(
        lembrete_ofensiva_ultimo_envio=timezone.now(), lembrete_ofensiva_ultimo_total=total,
    )
    return f'{total} lembrete(s) de ofensiva enviado(s)'


def enviar_lembrete_agora() -> None:
    """"Enviar agora" no painel: conta como o envio de hoje (o agendado já
    não volta a sair hoje, para ninguém receber dois)."""
    ConfiguracaoPlataforma.objects.get_or_create(pk=1)
    ConfiguracaoPlataforma.objects.filter(pk=1).update(lembrete_ofensiva_ultimo_dia=timezone.localdate())
    enviar_lembrete_ofensiva.delay()


@shared_task
def enviar_anuncio(anuncio_id: int):
    """Notificação a todos os utilizadores ativos e, se pedido, email a quem
    tem "Novidades da plataforma" ligado — aos lotes, para não carregar
    milhares de utilizadores em memória de uma vez."""
    if not Anuncio.objects.filter(pk=anuncio_id, estado='pendente').update(estado='a_enviar'):
        return 'Anúncio já enviado ou cancelado'
    anuncio = Anuncio.objects.get(pk=anuncio_id)
    texto = f'{anuncio.titulo}\n{anuncio.mensagem}'
    destinatarios = User.objects.filter(is_active=True, banido=False).order_by('pk')

    try:
        lote = []
        for user in destinatarios.iterator(chunk_size=LOTE_ANUNCIO):
            lote.append(user)
            if len(lote) == LOTE_ANUNCIO:
                _enviar_lote(anuncio, lote, texto)
                lote = []
        if lote:
            _enviar_lote(anuncio, lote, texto)
    except Exception:
        logger.exception('Falha no envio do anúncio %s', anuncio_id)
        Anuncio.objects.filter(pk=anuncio_id).update(estado='falhou')
        raise

    Anuncio.objects.filter(pk=anuncio_id).update(estado='enviado', enviado_em=timezone.now())
    return f'Anúncio {anuncio_id} enviado'


def _enviar_lote(anuncio: Anuncio, utilizadores: list, texto: str):
    Notificacao.objects.bulk_create(
        [Notificacao(utilizador=u, tipo='novidade', mensagem=texto, link=anuncio.link) for u in utilizadores],
    )
    emails = 0
    if anuncio.enviar_email:
        emails = enviar_em_massa(utilizadores, anuncio.titulo, anuncio.mensagem, 'novidades', anuncio.link)
    # Os totais vão subindo enquanto envia — o painel mostra o progresso.
    anuncio.total_destinatarios += len(utilizadores)
    anuncio.total_emails += emails
    Anuncio.objects.filter(pk=anuncio.pk).update(
        total_destinatarios=anuncio.total_destinatarios, total_emails=anuncio.total_emails,
    )
