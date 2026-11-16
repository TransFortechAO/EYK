"""Regras de segurança dos professores (Fase 3): autorização para menores."""
from .models import AutorizacaoMenores


def autorizado_para_menores(professor) -> bool:
    return AutorizacaoMenores.objects.filter(professor=professor, estado=AutorizacaoMenores.AUTORIZADA).exists()


def quer_para_criancas(request) -> bool:
    valor = request.data.get('para_criancas')
    return str(valor).lower() in ('true', '1', 'on')


def despublicar_para_criancas(professor) -> int:
    """Sem autorização, os conteúdos para crianças deixam de estar publicados (ficam guardados)."""
    from apps.cursos.models import Curso

    from .models import Video

    n = Curso.objects.filter(professor=professor, para_criancas=True, ativo=True).update(ativo=False)
    return n + Video.objects.filter(professor=professor, para_criancas=True, ativo=True).update(ativo=False)
