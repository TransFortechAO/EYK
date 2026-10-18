"""Emails transacionais da conta: recuperação de palavra-passe e verificação
de email. Os links apontam sempre para páginas do frontend Next.js
(NEXT_PUBLIC_URL), não para templates HTML do Django."""
import logging
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core import signing
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from .models import User

logger = logging.getLogger(__name__)

VERIFICACAO_SALT = 'eyk.accounts.verificar-email'
VERIFICACAO_VALIDADE_SEGUNDOS = 3 * 24 * 60 * 60  # 3 dias


def _link_frontend(caminho: str, **params) -> str:
    return f'{settings.NEXT_PUBLIC_URL}{caminho}?{urlencode(params)}'


def _enviar(user: User, assunto: str, corpo: str) -> bool:
    """Envia o email sem nunca rebentar o pedido que o originou (registo,
    troca de email…): um SMTP em baixo fica registado no log e devolve False."""
    try:
        send_mail(assunto, corpo, settings.DEFAULT_FROM_EMAIL, [user.email])
        return True
    except Exception:
        logger.exception('Falha ao enviar email "%s" para o utilizador %s', assunto, user.pk)
        return False


# ── Recuperação de palavra-passe ─────────────────────────────────────────────

def enviar_email_recuperacao(user: User) -> bool:
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    link = _link_frontend('/recuperar-senha/confirmar', uid=uid, token=token)
    corpo = (
        f'Olá {user.get_display_name() or user.username},\n\n'
        'Recebemos um pedido para redefinir a palavra-passe da tua conta EYK.\n'
        f'Para escolheres uma nova, abre este link:\n\n{link}\n\n'
        'Se não foste tu, ignora este email — a tua palavra-passe continua igual.\n\n'
        'Equipa EYK'
    )
    return _enviar(user, 'EYK · Redefinir palavra-passe', corpo)


def utilizador_do_token_recuperacao(uid: str, token: str) -> User | None:
    """Devolve o utilizador se o par uid/token do link for válido (e ainda
    não usado — o token do Django invalida-se ao mudar a palavra-passe)."""
    try:
        user = User.objects.get(pk=force_str(urlsafe_base64_decode(uid)), is_active=True)
    except (User.DoesNotExist, ValueError, TypeError, OverflowError):
        return None
    if not default_token_generator.check_token(user, token):
        return None
    return user


# ── Verificação de email ─────────────────────────────────────────────────────

def gerar_token_verificacao(user: User) -> str:
    # O email vai dentro do token: se o utilizador o trocar entretanto, os
    # links antigos (enviados para o endereço anterior) deixam de funcionar.
    return signing.dumps({'u': user.pk, 'e': user.email.lower()}, salt=VERIFICACAO_SALT)


def utilizador_do_token_verificacao(token: str) -> User | None:
    try:
        dados = signing.loads(token, salt=VERIFICACAO_SALT, max_age=VERIFICACAO_VALIDADE_SEGUNDOS)
    except signing.BadSignature:  # inclui SignatureExpired
        return None
    user = User.objects.filter(pk=dados.get('u')).first()
    if not user or user.email.lower() != dados.get('e'):
        return None
    return user


def enviar_email_verificacao(user: User) -> bool:
    if not user.email:
        return False
    link = _link_frontend('/verificar-email', token=gerar_token_verificacao(user))
    corpo = (
        f'Olá {user.get_display_name() or user.username},\n\n'
        'Bem-vindo à EYK! Confirma o teu email abrindo este link:\n\n'
        f'{link}\n\n'
        'O link é válido durante 3 dias.\n\n'
        'Equipa EYK'
    )
    return _enviar(user, 'EYK · Confirma o teu email', corpo)


# ── Contas criadas por um administrador ──────────────────────────────────────

_ALFABETO_SENHA = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'  # sem 0/O, 1/l/I


def gerar_senha_temporaria(tamanho: int = 12) -> str:
    """Senha aleatória legível (sem caracteres ambíguos) com pelo menos uma
    minúscula, uma maiúscula e um algarismo."""
    import secrets

    while True:
        senha = ''.join(secrets.choice(_ALFABETO_SENHA) for _ in range(tamanho))
        if (any(c.islower() for c in senha) and any(c.isupper() for c in senha)
                and any(c.isdigit() for c in senha)):
            return senha


def enviar_email_boas_vindas_conta(user: User, senha_temporaria: str, papel: str) -> bool:
    """Felicita quem acabou de entrar na plataforma (professor ou administrador)
    e envia o utilizador e a senha temporária. O frontend obriga a trocar a
    senha no primeiro acesso, por isso a senha enviada deixa de valer logo."""
    nome = user.get_display_name() or user.username
    link = _link_frontend('/login')
    corpo = (
        f'Olá {nome},\n\n'
        f'Parabéns e bem-vindo(a) à EYK! A tua conta de {papel} foi criada.\n\n'
        'Os teus dados de acesso:\n'
        f'  Utilizador: {user.username}\n'
        f'  Senha temporária: {senha_temporaria}\n\n'
        f'Entra aqui: {link}\n\n'
        'No primeiro acesso vais ter de escolher uma senha nova, só tua. '
        'Não partilhes esta senha com ninguém.\n\n'
        'Se não esperavas este email, ignora-o.\n\n'
        'Equipa EYK'
    )
    return _enviar(user, 'EYK · Bem-vindo(a) à plataforma', corpo)


# ── Candidatura a professor ──────────────────────────────────────────────────

CANDIDATURA_SALT = 'eyk.professores.candidatura'
CANDIDATURA_VALIDADE_SEGUNDOS = 3 * 24 * 60 * 60  # 3 dias


def gerar_token_candidatura(candidatura) -> str:
    # O email vai dentro do token: se a candidatura mudar de email, os links
    # antigos deixam de valer.
    return signing.dumps({'c': candidatura.pk, 'e': candidatura.email.lower()}, salt=CANDIDATURA_SALT)


def candidatura_do_token(token: str):
    """Devolve a candidatura por concluir a que o token pertence, ou None se o
    token for inválido, tiver expirado ou a candidatura já tiver sido usada."""
    from apps.professores.models import CandidaturaProfessor

    try:
        dados = signing.loads(token, salt=CANDIDATURA_SALT, max_age=CANDIDATURA_VALIDADE_SEGUNDOS)
    except signing.BadSignature:  # inclui SignatureExpired
        return None
    candidatura = CandidaturaProfessor.objects.filter(pk=dados.get('c')).first()
    if (not candidatura or candidatura.concluida_em is not None
            or candidatura.email.lower() != dados.get('e')):
        return None
    return candidatura


def enviar_email_candidatura(candidatura) -> bool:
    """Email com o link para confirmar o endereço e escolher a palavra-passe."""
    link = _link_frontend('/ser-professor/concluir', token=gerar_token_candidatura(candidatura))
    corpo = (
        f'Olá {candidatura.nome},\n\n'
        'Recebemos o teu pedido para ser professor na EYK. Para criares a tua conta, '
        'confirma o teu email e escolhe a tua palavra-passe neste link:\n\n'
        f'{link}\n\n'
        'O link é válido durante 3 dias e só pode ser usado uma vez.\n\n'
        'Se não fizeste este pedido, ignora este email.\n\n'
        'Equipa EYK'
    )
    try:
        send_mail('EYK · Cria a tua conta de professor', corpo, settings.DEFAULT_FROM_EMAIL, [candidatura.email])
        return True
    except Exception:
        logger.exception('Falha ao enviar o email de candidatura %s', candidatura.pk)
        return False
