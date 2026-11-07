"""Pesquisa em toda a plataforma: cursos, vídeos e publicações (as pessoas vêm de
/accounts/api/pesquisar-utilizadores/). Respeita o que cada listagem já esconde."""
from django.db.models import Q
from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.feed.api_views import _contexto, _visiveis
from apps.feed.models import Post
from apps.feed.serializers import PostSerializer
from apps.professores.models import Video

from .serializers import CourseSerializer, VideoSerializer
from .views import cursos_visiveis

MAXIMO_POR_TIPO = 40


def _palavras(q: str) -> list[str]:
    return [p for p in q.split() if len(p) >= 2][:6]


def _todas(campos: list[str], palavras: list[str]) -> Q:
    """Cada palavra tem de aparecer em pelo menos um dos campos."""
    filtro = Q()
    for p in palavras:
        alguma = Q()
        for c in campos:
            alguma |= Q(**{f'{c}__icontains': p})
        filtro &= alguma
    return filtro


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def pesquisa(request):
    q = (request.query_params.get('q') or '').strip()
    palavras = _palavras(q)
    if not palavras:
        return Response({'q': q, 'cursos': [], 'videos': [], 'posts': []})
    pessoa = ['professor__user__first_name', 'professor__user__last_name', 'professor__user__username']

    cursos = cursos_visiveis(request.user).filter(
        _todas(['titulo', 'descricao', 'categoria__nome', *pessoa], palavras),
    ).distinct()[:MAXIMO_POR_TIPO]
    videos = (
        Video.objects.filter(ativo=True, oculto=False, curso__isnull=True)
        .filter(_todas(['titulo', 'descricao', *pessoa], palavras))
        .select_related('professor')
        .prefetch_related('reacoes', 'visualizacoes', 'recursos')
        .order_by('-criado_em')
        .distinct()[:MAXIMO_POR_TIPO]
    )
    posts = (
        _visiveis(Post.objects.select_related('autor'), request)
        .filter(_todas(['conteudo', 'autor__first_name', 'autor__last_name', 'autor__username'], palavras))
        .order_by('-criado_em')
        .distinct()[:MAXIMO_POR_TIPO]
    )
    contexto = {'request': request}
    return Response({
        'q': q,
        'cursos': CourseSerializer(cursos, many=True, context=contexto).data,
        'videos': VideoSerializer(videos, many=True, context=contexto).data,
        'posts': PostSerializer(posts, many=True, context=_contexto(request)).data,
    })
