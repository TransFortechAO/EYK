"""Limite de frequência simples (janela fixa) sobre a cache do Django.

Em produção com vários processos/servidores, a cache tem de ser partilhada
(Redis — ver CACHE_URL em config/settings/prod.py); com a LocMemCache por
omissão, cada processo conta à parte.
"""
from django.conf import settings
from django.core.cache import cache


def excedeu_limite(chave: str, maximo: int, janela_segundos: int) -> bool:
    """Regista uma tentativa em `chave` e devolve True se, dentro da janela
    atual, já foram feitas mais de `maximo` tentativas (esta incluída)."""
    chave = f'eyk:limite:{chave}'
    # `add` só cria a chave se não existir — é o início de uma nova janela.
    if cache.add(chave, 1, timeout=janela_segundos):
        return maximo < 1
    try:
        tentativas = cache.incr(chave)
    except ValueError:
        # A chave expirou entre o `add` e o `incr`: começa nova janela.
        cache.set(chave, 1, timeout=janela_segundos)
        tentativas = 1
    return tentativas > maximo


def ip_do_pedido(request) -> str:
    """IP do cliente. Por omissão só confia em REMOTE_ADDR (X-Forwarded-For
    pode ser forjado). Atrás de um proxy (nginx), ativar
    CONFIAR_X_FORWARDED_FOR: usa-se o ÚLTIMO IP da lista, o que o próprio
    proxy acrescentou (`proxy_add_x_forwarded_for`)."""
    if getattr(settings, 'CONFIAR_X_FORWARDED_FOR', False):
        encaminhado = request.META.get('HTTP_X_FORWARDED_FOR', '')
        ips = [ip.strip() for ip in encaminhado.split(',') if ip.strip()]
        if ips:
            return ips[-1]
    return request.META.get('REMOTE_ADDR') or 'desconhecido'
