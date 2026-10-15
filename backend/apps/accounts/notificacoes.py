"""Notificações na app + email, respeitando as preferências do utilizador
(Configurações → Notificações).

Categorias de email (cada uma com o seu interruptor em `User`):
- 'novidades'   → notif_email_novidades   (anúncios, lançamentos de quem segues)
- 'comunidade'  → notif_email_comunidade  (comentários e respostas ao que publicaste)
- 'gamificacao' → notif_email_gamificacao (conquistas, lembretes de ofensiva)
- None          → email obrigatório (segurança/moderação), sem interruptor

Os emails só vão para contas com o email confirmado — nunca para endereços
que ninguém provou serem seus.
"""
import logging

from django.conf import settings
from django.core.cache import cache
from django.core.mail import EmailMessage, get_connection

from .models import Notificacao, User

logger = logging.getLogger(__name__)

CAMPO_PREFERENCIA = {
    'novidades': 'notif_email_novidades',
    'comunidade': 'notif_email_comunidade',
    'gamificacao': 'notif_email_gamificacao',
}

# Anti-inundação: no máximo um email de comunidade por pessoa a cada 10 min
# (um post com 30 comentários seguidos não pode gerar 30 emails).
INTERVALO_EMAIL_COMUNIDADE_SEGUNDOS = 10 * 60


def _rodape(categoria: str | None) -> str:
    if categoria is None:
        return '\n\nEquipa EYK'
    return (
        '\n\nEquipa EYK\n\n'
        f'Não queres receber estes emails? Desliga-os em {settings.NEXT_PUBLIC_URL}/configuracoes?tab=notificacoes'
    )


def pode_receber_email(user: User, categoria: str | None) -> bool:
    if not user.email or not user.email_verificado or not user.is_active:
        return False
    if categoria is None:
        return True
    return bool(getattr(user, CAMPO_PREFERENCIA[categoria], False))


def construir_email(user: User, assunto: str, corpo: str, categoria: str | None, link: str = '') -> EmailMessage:
    texto = f'Olá {user.get_display_name() or user.username},\n\n{corpo}'
    if link:
        texto += f'\n\n{settings.NEXT_PUBLIC_URL}{link}'
    texto += _rodape(categoria)
    return EmailMessage(f'EYK · {assunto}', texto, settings.DEFAULT_FROM_EMAIL, [user.email])


def enviar_email(user: User, assunto: str, corpo: str, categoria: str | None = None, link: str = '') -> bool:
    """Envia um email (se as preferências o permitirem). Nunca lança: uma
    falha de SMTP não pode rebentar a ação que originou a notificação."""
    if not pode_receber_email(user, categoria):
        return False
    if categoria == 'comunidade':
        # `add` só grava se a chave não existir — é o "ainda não enviei".
        if not cache.add(f'eyk:email-comunidade:{user.pk}', 1, INTERVALO_EMAIL_COMUNIDADE_SEGUNDOS):
            return False
    try:
        construir_email(user, assunto, corpo, categoria, link).send()
        return True
    except Exception:
        logger.exception('Falha ao enviar email "%s" para o utilizador %s', assunto, user.pk)
        return False


def notificar(
    user: User,
    tipo: str,
    mensagem: str,
    *,
    link: str = '',
    categoria_email: str | None = None,
    assunto_email: str | None = None,
    enviar_por_email: bool = True,
) -> Notificacao:
    """Cria a notificação na app e, se `assunto_email` for dado, envia também
    o email (sujeito às preferências da `categoria_email`)."""
    notificacao = Notificacao.objects.create(utilizador=user, tipo=tipo, mensagem=mensagem, link=link)
    if enviar_por_email and assunto_email:
        enviar_email(user, assunto_email, mensagem, categoria_email, link)
    return notificacao


def enviar_em_massa(utilizadores, assunto: str, corpo: str, categoria: str, link: str = '') -> int:
    """Email para muitos utilizadores numa só ligação SMTP. Devolve quantos
    foram enviados."""
    mensagens = [
        construir_email(u, assunto, corpo, categoria, link)
        for u in utilizadores
        if pode_receber_email(u, categoria)
    ]
    if not mensagens:
        return 0
    try:
        with get_connection() as ligacao:
            return ligacao.send_messages(mensagens) or 0
    except Exception:
        logger.exception('Falha no envio em massa "%s"', assunto)
        return 0
