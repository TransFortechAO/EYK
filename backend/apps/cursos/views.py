from django.contrib.auth import get_user_model
from django.db.models import Count, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Categoria, Curso
from .serializers import CategoriaSerializer, ComentarioVideoSerializer, CourseSerializer, VideoSerializer
from apps.professores.models import ComentarioVideo, ReacaoComentarioVideo, ReacaoVideo, Video, VisualizacaoVideo

User = get_user_model()


class CursoViewSet(viewsets.ModelViewSet):
    """Listagem pública de cursos (só leitura). A criação/edição/remoção dos
    próprios cursos é feita pelo professor através de /api/professor/cursos/,
    que valida a posse do curso."""
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'head', 'options']

    def get_queryset(self):
        return Curso.objects.filter(ativo=True).select_related('professor', 'categoria')


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def usuario_atual(request):
    user = request.user
    data = {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'is_staff': user.is_staff,
        'is_teacher': user.is_teacher,
        'is_student': user.is_student,
        'perfil_completo': user.perfil_completo,
        'tema_preferido': user.tema_preferido,
    }
    return Response(data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def categoria_list(request):
    categorias = list(Categoria.objects.all().values('id', 'nome'))
    resultado = [{'id': None, 'nome': 'Todos'}] + categorias
    return Response(resultado)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def video_list(request):
    tab = request.query_params.get('tab', 'recent')

    videos_queryset = Video.objects.filter(ativo=True, curso__isnull=True).select_related('professor')

    if tab == 'recent':
        videos_queryset = videos_queryset.order_by('-criado_em')
    elif tab == 'popular':
        videos_queryset = videos_queryset.annotate(
            viz_sum=Sum('visualizacoes__count')
        ).order_by('-viz_sum', '-criado_em')
    elif tab == 'short':
        videos_queryset = videos_queryset.order_by('-criado_em')
    else:
        videos_queryset = videos_queryset.order_by('-criado_em')

    serializer = VideoSerializer(videos_queryset, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def video_detail(request, pk):
    try:
        video = Video.objects.select_related('professor').get(pk=pk, ativo=True, curso__isnull=True)
    except Video.DoesNotExist:
        return Response({'detail': 'Vídeo não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    VisualizacaoVideo.objects.get_or_create(video=video, utilizador=request.user)

    serializer = VideoSerializer(video, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def video_react(request, pk):
    try:
        video = Video.objects.get(pk=pk, ativo=True)
    except Video.DoesNotExist:
        return Response({'detail': 'Vídeo não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    tipo = request.data.get('tipo', 'like')
    reacao, created = ReacaoVideo.objects.get_or_create(
        video=video, utilizador=request.user, defaults={'tipo': tipo}
    )
    if not created:
        if reacao.tipo == tipo:
            reacao.delete()
        else:
            reacao.tipo = tipo
            reacao.save()

    VisualizacaoVideo.objects.get_or_create(video=video, utilizador=request.user)

    return Response({
        'likes': video.total_likes(),
        'dislikes': ReacaoVideo.objects.filter(video=video, tipo='dislike').count(),
    })


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def video_comentarios(request, pk):
    """Comentários de um vídeo (avulso ou aula de curso). O dono do vídeo
    (o professor que o publicou) não pode comentar no próprio conteúdo."""
    try:
        video = Video.objects.select_related('professor__user').get(pk=pk, ativo=True)
    except Video.DoesNotExist:
        return Response({'detail': 'Vídeo não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'POST':
        if video.professor.user_id == request.user.id:
            return Response(
                {'detail': 'Não podes comentar no teu próprio vídeo.'}, status=status.HTTP_403_FORBIDDEN,
            )

        conteudo = (request.data.get('conteudo') or '').strip()
        if not conteudo:
            return Response({'detail': 'Escreve um comentário.'}, status=status.HTTP_400_BAD_REQUEST)

        parent = None
        parent_id = request.data.get('parent')
        if parent_id:
            parent = ComentarioVideo.objects.filter(id=parent_id, video=video).first()
            if not parent:
                return Response({'detail': 'Comentário original não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
            if parent.parent_id is not None:
                # Achata respostas-a-respostas para um só nível de conversa.
                parent = parent.parent

        comentario = ComentarioVideo.objects.create(
            video=video, autor=request.user, conteudo=conteudo, parent=parent,
        )
        serializer = ComentarioVideoSerializer(comentario, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    comentarios = (
        ComentarioVideo.objects.filter(video=video, parent__isnull=True)
        .select_related('autor')
        .order_by('-criado_em')
    )
    serializer = ComentarioVideoSerializer(comentarios, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['PATCH', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def video_comentario_detail(request, pk, comentario_id):
    try:
        video = Video.objects.select_related('professor__user').get(pk=pk, ativo=True)
    except Video.DoesNotExist:
        return Response({'detail': 'Vídeo não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    comentario = get_object_or_404(ComentarioVideo, id=comentario_id, video=video)

    if request.method == 'DELETE':
        e_autor = comentario.autor_id == request.user.id
        e_dono_video = video.professor.user_id == request.user.id
        if not (e_autor or e_dono_video):
            return Response(
                {'detail': 'Sem permissão para apagar este comentário.'}, status=status.HTTP_403_FORBIDDEN,
            )
        comentario.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    if comentario.autor_id != request.user.id:
        return Response(
            {'detail': 'Sem permissão para editar este comentário.'}, status=status.HTTP_403_FORBIDDEN,
        )

    conteudo = (request.data.get('conteudo') or '').strip()
    if not conteudo:
        return Response({'detail': 'Escreve um comentário.'}, status=status.HTTP_400_BAD_REQUEST)

    comentario.conteudo = conteudo
    comentario.editado_em = timezone.now()
    comentario.save(update_fields=['conteudo', 'editado_em'])
    serializer = ComentarioVideoSerializer(comentario, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def video_comentario_reagir(request, pk, comentario_id):
    video = get_object_or_404(Video, pk=pk, ativo=True)
    comentario = get_object_or_404(ComentarioVideo, id=comentario_id, video=video)

    reacao, created = ReacaoComentarioVideo.objects.get_or_create(
        comentario=comentario, utilizador=request.user,
    )
    if not created:
        reacao.delete()
        liked = False
    else:
        liked = True

    return Response({'liked': liked, 'totalLikes': comentario.total_likes()})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def curso_inscrever(request, pk):
    """Auto-inscreve o aluno autenticado no curso e regista uma visualização
    (substitui a antiga view HTML `feed.assistir_curso`, que fazia o mesmo)."""
    try:
        curso = Curso.objects.get(pk=pk, ativo=True)
    except Curso.DoesNotExist:
        return Response({'detail': 'Curso não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    from apps.alunos.models import Aluno
    from .models import EngajamentoCurso, Inscricao

    try:
        aluno = Aluno.objects.get(profile=request.user)
    except Aluno.DoesNotExist:
        return Response({'detail': 'Apenas alunos podem inscrever-se em cursos.'}, status=status.HTTP_403_FORBIDDEN)

    inscricao, _ = Inscricao.objects.get_or_create(aluno=aluno, curso=curso)
    eng, _ = EngajamentoCurso.objects.get_or_create(curso=curso, aluno=aluno)
    eng.visualizacoes += 1
    eng.save(update_fields=['visualizacoes'])

    return Response({'ok': True, 'concluido': inscricao.concluido})
