import datetime
import logging
import secrets

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from apps.accounts.emails import _link_frontend

from .models import ConviteInstituicao

logger = logging.getLogger(__name__)

VALIDADE_CONVITE_DIAS = 14
# Sem letras e números que se confundem (0/O, 1/I), para se poder ditar o código.
ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
TAMANHO_CODIGO = 12


def gerar_codigo() -> str:
    while True:
        codigo = ''.join(secrets.choice(ALFABETO_CODIGO) for _ in range(TAMANHO_CODIGO))
        if not ConviteInstituicao.objects.filter(codigo=codigo).exists():
            return codigo


def link_do_convite(convite: ConviteInstituicao) -> str:
    return _link_frontend('/instituicao/aderir', codigo=convite.codigo)


def criar_convite_responsavel(instituicao, criado_por) -> ConviteInstituicao:
    """Novo convite de administrador; os pendentes deixam de valer."""
    instituicao.convites.filter(estado=ConviteInstituicao.PENDENTE).update(estado=ConviteInstituicao.CANCELADO)
    return ConviteInstituicao.objects.create(
        instituicao=instituicao,
        codigo=gerar_codigo(),
        email=instituicao.responsavel_email,
        papel='administrador',
        criado_por=criado_por,
        expira_em=timezone.now() + datetime.timedelta(days=VALIDADE_CONVITE_DIAS),
    )


def _email_sai_mesmo() -> bool:
    """Em desenvolvimento os emails só aparecem no terminal do Django."""
    return 'console' not in settings.EMAIL_BACKEND


def enviar_convite_responsavel(convite: ConviteInstituicao) -> bool:
    """Envia o email sem rebentar o pedido: se falhar, a equipa fica com o link para o
    passar à mão. Devolve True só se o email saiu para a caixa de correio."""
    instituicao = convite.instituicao
    corpo = (
        f'Olá {instituicao.responsavel_nome},\n\n'
        f'A {instituicao.nome} já tem um espaço na EYK — Ekola Ya Kelela, e foste indicado(a) como '
        'responsável. Com este convite ficas administrador(a) da instituição.\n\n'
        f'Aceita aqui: {link_do_convite(convite)}\n\n'
        f'Se ainda não tens conta, cria-a com este email ({convite.email}): o convite só funciona com ele.\n'
        f'O convite é válido durante {VALIDADE_CONVITE_DIAS} dias e é pessoal; não o reencaminhes.\n\n'
        'Se não esperavas este email, podes ignorá-lo.\n\n'
        'Equipa EYK'
    )
    try:
        send_mail(
            f'EYK · Convite para administrar {instituicao.nome}', corpo, settings.DEFAULT_FROM_EMAIL, [convite.email],
        )
    except Exception:
        logger.exception('Falha ao enviar o convite %s', convite.pk)
        return False
    convite.email_enviado_em = timezone.now()
    convite.save(update_fields=['email_enviado_em'])
    return _email_sai_mesmo()
