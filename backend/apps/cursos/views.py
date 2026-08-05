from rest_framework import permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db.models import Count, Sum

from .models import Categoria, Curso
from .serializers import CourseSerializer, CategoriaSerializer, VideoSerializer
from apps.professores.models import Professor, Video

User = get_user_model()


class CursoViewSet(viewsets.ModelViewSet):
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Curso.objects.filter(ativo=True).select_related('professor', 'categoria')

    def perform_create(self, serializer):
        professor = Professor.objects.get(user=self.request.user)
        serializer.save(professor=professor)


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
