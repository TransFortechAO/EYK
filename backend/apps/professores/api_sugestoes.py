"""Professores para seguir (coluna lateral do Início), como as sugestões das redes sociais."""
from django.db.models import Count, Q
from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.moderacao.servicos import ids_bloqueados

from .models import Professor

SUGESTOES = 3


def _iniciais(nome: str) -> str:
    partes = (nome or 'P').split()
    return (partes[0][0] + partes[-1][0]).upper() if len(partes) >= 2 else nome[:2].upper()


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def professores_sugeridos(request):
    """Os mais seguidos que ainda não segues; nunca tu próprio nem quem está bloqueado."""
    professores = (
        Professor.objects.filter(ativo=True, user__is_active=True, user__banido=False)
        .exclude(user=request.user)
        .exclude(seguidores__utilizador=request.user)
        .exclude(user_id__in=ids_bloqueados(request.user))
        .select_related('user')
        .annotate(
            n_seguidores=Count('seguidores', distinct=True),
            n_cursos=Count('curso', filter=Q(curso__ativo=True, curso__oculto=False), distinct=True),
        )
        .order_by('-n_seguidores', '-n_cursos', 'id')[:SUGESTOES]
    )
    return Response([
        {
            'professorId': p.id,
            'userId': p.user_id,
            'nome': p.nome_publico or p.user.get_display_name(),
            'iniciais': _iniciais(p.nome_publico or p.user.get_display_name()),
            'foto': p.foto.url if p.foto else None,
            'area': p.area,
            'seguidores': p.n_seguidores,
            'cursos': p.n_cursos,
        }
        for p in professores
    ])
