"""Verificações automáticas antes de publicar texto (posts, comentários,
avaliações, biografias): limites de frequência, texto repetido, links em
contas novas e palavras proibidas.

Uso nas views:

    try:
        termos = verificar_publicacao(request.user, conteudo, 'comentario')
    except ConteudoRecusado as erro:
        return Response({'detail': erro.mensagem}, status=erro.status)
    comentario = Comentario.objects.create(...)
    sinalizar_se_necessario('comentario', comentario, termos)
"""
import hashlib
import re
import unicodedata
from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone

from apps.accounts.rate_limit import excedeu_limite

CACHE_PALAVRAS = 'eyk:moderacao:palavras'

# (máximo, janela em segundos) por tipo de publicação — contas novas têm metade.
LIMITES = {
    'post': (5, 10 * 60),
    'comentario': (20, 10 * 60),
    'avaliacao': (10, 60 * 60),
}
JANELA_REPETIDO_SEGUNDOS = 10 * 60

URL_RE = re.compile(r'(https?://|www\.)\S+|\b[\w-]+\.(com|net|org|ao|pt|br|io|me|ly|xyz|info)\b', re.IGNORECASE)
# Substituições comuns para fugir ao filtro ("m3rd@" → "merda").
LEET = str.maketrans({'0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's'})


class ConteudoRecusado(Exception):
    def __init__(self, mensagem: str, status: int = 400):
        super().__init__(mensagem)
        self.mensagem = mensagem
        self.status = status


def normalizar(texto: str) -> str:
    """Minúsculas, sem acentos e sem truques de leetspeak."""
    sem_acentos = ''.join(
        c for c in unicodedata.normalize('NFKD', texto or '') if not unicodedata.combining(c)
    )
    return sem_acentos.lower().translate(LEET)


def _palavras():
    palavras = cache.get(CACHE_PALAVRAS)
    if palavras is None:
        from .models import PalavraProibida
        palavras = [(normalizar(p.termo), p.acao) for p in PalavraProibida.objects.all()]
        cache.set(CACHE_PALAVRAS, palavras, 5 * 60)
    return palavras


def limpar_cache_palavras():
    cache.delete(CACHE_PALAVRAS)


def termos_proibidos(texto: str) -> list[tuple[str, str]]:
    """[(termo, acao)] encontrados no texto, como palavras inteiras."""
    normalizado = normalizar(texto)
    encontrados = []
    for termo, acao in _palavras():
        if termo and re.search(rf'(?<!\w){re.escape(termo)}(?!\w)', normalizado):
            encontrados.append((termo, acao))
    return encontrados


def conta_nova(user) -> bool:
    from apps.plataforma.servicos import configuracao

    if not user.email_verificado:
        return True
    dias = configuracao().dias_conta_nova
    return bool(user.date_joined and user.date_joined > timezone.now() - timedelta(days=dias))


def verificar_publicacao(user, texto: str, tipo: str) -> list[str]:
    """Lança ConteudoRecusado se o texto não pode ser publicado. Devolve os
    termos "a sinalizar" encontrados (o texto publica-se, mas vai para a fila
    de moderação — ver `sinalizar_se_necessario`). `tipo`: 'post',
    'comentario', 'avaliacao' ou 'bio' (só o filtro de palavras)."""
    if user.is_staff:
        return []

    nova = conta_nova(user)

    if tipo in LIMITES:
        maximo, janela = LIMITES[tipo]
        if nova:
            maximo = max(1, maximo // 2)
        if excedeu_limite(f'publicar:{tipo}:{user.pk}', maximo, janela):
            raise ConteudoRecusado('Estás a publicar demasiado depressa. Espera um pouco e tenta de novo.', 429)

    if tipo != 'bio' and nova and URL_RE.search(texto or ''):
        raise ConteudoRecusado(
            'Contas novas (ou sem o email confirmado) ainda não podem publicar links. '
            'Confirma o teu email e tenta de novo daqui a alguns dias.'
        )

    encontrados = termos_proibidos(texto)
    if any(acao == 'bloquear' for _, acao in encontrados):
        raise ConteudoRecusado(
            'O teu texto contém linguagem que não é permitida pelas regras da comunidade. Reformula e tenta de novo.'
        )

    if tipo in LIMITES:
        # Mesmo texto, pela mesma pessoa, em pouco tempo = spam (ou duplo clique).
        assinatura = hashlib.sha256(f'{user.pk}:{tipo}:{normalizar(texto).strip()}'.encode()).hexdigest()[:32]
        if not cache.add(f'eyk:repetido:{assinatura}', 1, JANELA_REPETIDO_SEGUNDOS):
            raise ConteudoRecusado('Já publicaste exatamente este texto há pouco.')

    return [termo for termo, acao in encontrados if acao == 'sinalizar']


def sinalizar_se_necessario(tipo_conteudo: str, objeto, termos: list[str]):
    """Se o filtro encontrou termos "a sinalizar", cria uma denúncia do
    sistema para um administrador ver."""
    if not termos:
        return
    from .servicos import criar_denuncia_do_sistema
    criar_denuncia_do_sistema(tipo_conteudo, objeto, f'Termos detetados: {", ".join(termos)}')
