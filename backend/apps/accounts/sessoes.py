"""Sessões ativas (ver/terminar noutros dispositivos), alerta de login num
dispositivo novo, e o middleware que expulsa contas suspensas/banidas."""
import re
import secrets
import time
from importlib import import_module

from django.conf import settings
from django.contrib.auth import logout, user_logged_in, user_logged_out
from django.dispatch import receiver
from django.utils import timezone

from .models import DispositivoConhecido, SessaoAtiva
from .rate_limit import ip_do_pedido

COOKIE_DISPOSITIVO = 'eyk_dispositivo'
COOKIE_DISPOSITIVO_MAX_AGE = 2 * 365 * 24 * 60 * 60
# A "última atividade" de uma sessão só é atualizada de x em x minutos — não
# vale a pena uma escrita na base de dados em cada pedido.
INTERVALO_ATIVIDADE_SEGUNDOS = 5 * 60
SESSION_KEY_ATIVIDADE = '_eyk_atividade'


def _session_store():
    return import_module(settings.SESSION_ENGINE).SessionStore


def descrever_dispositivo(user_agent: str) -> str:
    """"Chrome em Android", "Safari em iPhone"… a partir do User-Agent."""
    ua = user_agent or ''
    if re.search(r'iPhone', ua):
        sistema = 'iPhone'
    elif re.search(r'iPad', ua):
        sistema = 'iPad'
    elif re.search(r'Android', ua):
        sistema = 'Android'
    elif re.search(r'Windows', ua):
        sistema = 'Windows'
    elif re.search(r'Mac OS X|Macintosh', ua):
        sistema = 'Mac'
    elif re.search(r'Linux', ua):
        sistema = 'Linux'
    else:
        sistema = ''

    if re.search(r'Edg/', ua):
        browser = 'Edge'
    elif re.search(r'OPR/|Opera', ua):
        browser = 'Opera'
    elif re.search(r'SamsungBrowser', ua):
        browser = 'Samsung Internet'
    elif re.search(r'Firefox/|FxiOS', ua):
        browser = 'Firefox'
    elif re.search(r'Chrome/|CriOS', ua):
        browser = 'Chrome'
    elif re.search(r'Safari/', ua):
        browser = 'Safari'
    else:
        browser = 'Browser'

    return f'{browser} em {sistema}' if sistema else browser


def _registar_sessao(request, user):
    chave = request.session.session_key
    if not chave:
        request.session.save()
        chave = request.session.session_key
    SessaoAtiva.objects.update_or_create(
        session_key=chave,
        defaults={
            'utilizador': user,
            'dispositivo': descrever_dispositivo(request.META.get('HTTP_USER_AGENT', ''))[:120],
            'ip': _ip_valido(ip_do_pedido(request)),
            'ultima_atividade': timezone.now(),
        },
    )
    request.session[SESSION_KEY_ATIVIDADE] = time.time()


def _ip_valido(ip: str):
    import ipaddress
    try:
        ipaddress.ip_address(ip)
        return ip
    except ValueError:
        return None


@receiver(user_logged_in)
def _ao_entrar(sender, request, user, **kwargs):
    if request is not None and hasattr(request, 'session'):
        _registar_sessao(request, user)


@receiver(user_logged_out)
def _ao_sair(sender, request, user, **kwargs):
    if request is not None and getattr(request, 'session', None) is not None and request.session.session_key:
        SessaoAtiva.objects.filter(session_key=request.session.session_key).delete()


def sessoes_do_utilizador(user) -> list[SessaoAtiva]:
    """Sessões ainda válidas (as expiradas/terminadas são limpas aqui)."""
    store = _session_store()
    validas = []
    for sessao in SessaoAtiva.objects.filter(utilizador=user):
        # `load()` devolve {} se a sessão não existe ou já expirou (`exists()`
        # só vê se a linha existe, mesmo expirada).
        dados = store(session_key=sessao.session_key).load()
        if dados.get('_auth_user_id') == str(user.pk):
            validas.append(sessao)
        else:
            sessao.delete()
    return validas


def terminar_sessao(sessao: SessaoAtiva):
    _session_store()(session_key=sessao.session_key).delete()
    sessao.delete()


def terminar_sessoes(user, exceto_chave: str | None = None) -> int:
    total = 0
    for sessao in SessaoAtiva.objects.filter(utilizador=user):
        if sessao.session_key == exceto_chave:
            continue
        terminar_sessao(sessao)
        total += 1
    return total


# ── Dispositivo novo ─────────────────────────────────────────────────────────

def registar_dispositivo(request, response, user):
    """Chamado depois de cada login. Marca o browser com um cookie de longa
    duração; se o utilizador já tinha dispositivos conhecidos e este não é
    um deles, envia um alerta de segurança por email."""
    from .notificacoes import enviar_email

    identificador = request.COOKIES.get(COOKIE_DISPOSITIVO) or ''
    if not re.fullmatch(r'[A-Za-z0-9_-]{20,64}', identificador):
        identificador = secrets.token_urlsafe(24)

    descricao = descrever_dispositivo(request.META.get('HTTP_USER_AGENT', ''))[:120]
    tinha_dispositivos = DispositivoConhecido.objects.filter(utilizador=user).exists()
    _, novo = DispositivoConhecido.objects.update_or_create(
        utilizador=user, identificador=identificador, defaults={'descricao': descricao},
    )
    if novo and tinha_dispositivos:
        quando = timezone.localtime().strftime('%d/%m/%Y às %H:%M')
        ip = ip_do_pedido(request)
        enviar_email(
            user, 'Novo início de sessão na tua conta',
            f'Foi iniciada uma sessão na tua conta EYK num dispositivo novo:\n\n'
            f'  {descricao}\n  {quando}\n  IP: {ip}\n\n'
            'Se foste tu, não precisas de fazer nada.\n'
            'Se não foste tu, altera já a tua palavra-passe e termina as outras sessões em:',
            categoria=None, link='/configuracoes?tab=seguranca',
        )

    response.set_cookie(
        COOKIE_DISPOSITIVO, identificador, max_age=COOKIE_DISPOSITIVO_MAX_AGE,
        httponly=True, samesite='Lax', secure=settings.SESSION_COOKIE_SECURE,
    )


# ── Middleware ───────────────────────────────────────────────────────────────

class ContaMiddleware:
    """Depois do AuthenticationMiddleware:
    - termina a sessão de contas suspensas/banidas (o pedido segue como
      anónimo; ao tentar entrar, o login mostra o motivo);
    - mantém a "última atividade" das sessões ativas (de 5 em 5 minutos),
      registando também sessões anteriores a esta funcionalidade."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, 'user', None)
        if user is not None and user.is_authenticated:
            if user.esta_sancionado:
                logout(request)
            else:
                ultima = request.session.get(SESSION_KEY_ATIVIDADE) or 0
                if time.time() - ultima > INTERVALO_ATIVIDADE_SEGUNDOS:
                    _registar_sessao(request, user)
        return self.get_response(request)
