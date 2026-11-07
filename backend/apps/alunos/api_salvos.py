"""Salvos: cursos, vídeos e publicações que a pessoa guardou para ver depois."""
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.cursos.serializers import CourseSerializer, VideoSerializer
from apps.cursos.views import cursos_visiveis
from apps.feed.api_views import _contexto, _visiveis
from apps.feed.models import Post
from apps.feed.serializers import PostSerializer
from apps.professores.models import Video

from .models import Salvo


def _videos_visiveis():
    return (
        Video.objects.filter(ativo=True, oculto=False, curso__isnull=True)
        .select_related('professor')
        .prefetch_related('reacoes', 'visualizacoes', 'recursos')
    )


def _posts_visiveis(request):
    return _visiveis(Post.objects.select_related('autor'), request)


def _por_ordem(consulta, ids: list[int]) -> list:
    """Pela ordem em que foram guardados; o que deixou de estar visível não aparece."""
    objetos = {o.pk: o for o in consulta.filter(pk__in=ids)}
    return [objetos[i] for i in ids if i in objetos]


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def salvos(request):
    meus = Salvo.objects.filter(utilizador=request.user)
    if request.method == 'GET':
        ids = {
            campo: [v for v in meus.values_list(f'{campo}_id', flat=True) if v]
            for campo in ('curso', 'video', 'post')
        }
        contexto = {'request': request}
        return Response({
            'cursos': CourseSerializer(_por_ordem(cursos_visiveis(request.user), ids['curso']), many=True, context=contexto).data,
            'videos': VideoSerializer(_por_ordem(_videos_visiveis(), ids['video']), many=True, context=contexto).data,
            'posts': PostSerializer(_por_ordem(_posts_visiveis(request), ids['post']), many=True, context=_contexto(request)).data,
        })

    tipo = request.data.get('tipo')
    origens = {
        'curso': lambda: cursos_visiveis(request.user),
        'video': _videos_visiveis,
        'post': lambda: _posts_visiveis(request),
    }
    if tipo not in origens:
        return Response({'detail': 'Tipo inválido.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        alvo = origens[tipo]().filter(pk=int(request.data.get('id'))).first()
    except (TypeError, ValueError):
        alvo = None
    if not alvo:
        return Response({'detail': 'Já não está disponível.'}, status=status.HTTP_404_NOT_FOUND)
    salvo, criado = Salvo.objects.get_or_create(utilizador=request.user, **{tipo: alvo})
    if not criado:
        salvo.delete()
    return Response({'salvo': criado})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def salvos_ids(request):
    """Só as chaves, para os botões saberem o que já está guardado."""
    chaves = []
    for curso, video, post in Salvo.objects.filter(utilizador=request.user).values_list('curso_id', 'video_id', 'post_id'):
        if curso:
            chaves.append(f'curso:{curso}')
        elif video:
            chaves.append(f'video:{video}')
        elif post:
            chaves.append(f'post:{post}')
    return Response({'ids': chaves})
