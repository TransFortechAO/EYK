from rest_framework import permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db.models import Count, Sum

from .models import Categoria, Curso
from .serializers import CourseSerializer, CategoriaSerializer, VideoSerializer
from apps.professores.models import ReacaoVideo, Video, VisualizacaoVideo

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

    videos_queryset = Video.objects.filter(ativo=True).select_related('professor')

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
        video = Video.objects.select_related('professor').get(pk=pk, ativo=True)
    except Video.DoesNotExist:
        return Response({'detail': 'Vídeo não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

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
