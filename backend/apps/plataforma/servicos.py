from django.core.cache import cache

from .models import ConfiguracaoPlataforma

CACHE_KEY = 'eyk:plataforma:configuracao'
CACHE_SEGUNDOS = 60


def configuracao() -> ConfiguracaoPlataforma:
    """A configuração global (criada com os valores por omissão na primeira
    vez). Fica em cache um minuto — lida em quase todos os uploads/posts."""
    config = cache.get(CACHE_KEY)
    if config is None:
        config, _ = ConfiguracaoPlataforma.objects.get_or_create(pk=1)
        cache.set(CACHE_KEY, config, CACHE_SEGUNDOS)
    return config


def limpar_cache_configuracao():
    cache.delete(CACHE_KEY)


def limite_video_bytes() -> int:
    return configuracao().limite_video_mb * 1024 * 1024


def limite_pdf_bytes() -> int:
    return configuracao().limite_pdf_mb * 1024 * 1024
