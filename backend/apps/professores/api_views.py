from django.contrib.auth import logout
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.cursos.models import Curso, Inscricao

from .models import Professor, ReacaoVideo, Seguidor, Video
from .serializers import (
    ProfessorCursoSerializer,
    ProfessorSerializer,
    ProfessorVideoSerializer,
    ReacaoVideoSerializer,
)


def _get_professor(request):
    return Professor.objects.filter(user=request.user).first()


def _professor_required_response():
    return Response({'detail': 'Perfil de professor não encontrado.'}, status=status.HTTP_403_FORBIDDEN)


# ── PERFIL ───────────────────────────────────────────────────────────────────

@api_view(['GET', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def professor_perfil(request):
    professor = _get_professor(request)
    if not professor:
        return _professor_required_response()

    if request.method == 'PATCH':
        serializer = ProfessorSerializer(professor, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    serializer = ProfessorSerializer(professor, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def professor_apagar_conta(request):
    professor = _get_professor(request)
    if not professor:
        return _professor_required_response()

    user = request.user
    logout(request)
    user.delete()
    return Response({'ok': True})


# ── CURSOS ───────────────────────────────────────────────────────────────────

def _criar_videos_curso(professor, curso, arquivos, ordem_inicial=0):
    for indice, arquivo in enumerate(arquivos):
        Video.objects.create(
            professor=professor,
            curso=curso,
            titulo=f'{curso.titulo} — vídeo {ordem_inicial + indice + 1}',
            arquivo=arquivo,
            ativo=True,
            ordem=ordem_inicial + indice,
        )


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def professor_cursos(request):
    professor = _get_professor(request)
    if not professor:
        return _professor_required_response()

    if request.method == 'POST':
        arquivos = request.FILES.getlist('videos')
        if not arquivos:
            return Response(
                {'detail': 'Envia pelo menos um vídeo para criar o curso.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ProfessorCursoSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            curso = serializer.save(professor=professor)
            _criar_videos_curso(professor, curso, arquivos)

        curso.refresh_from_db()
        return Response(
            ProfessorCursoSerializer(curso, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    cursos = Curso.objects.filter(professor=professor).order_by('-criado_em')
    serializer = ProfessorCursoSerializer(cursos, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def professor_curso_detail(request, curso_id):
    professor = _get_professor(request)
    if not professor:
        return _professor_required_response()

    curso = get_object_or_404(Curso, id=curso_id, professor=professor)

    if request.method == 'DELETE':
        curso.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    if request.method == 'PATCH':
        serializer = ProfessorCursoSerializer(curso, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            curso = serializer.save()
            arquivos = request.FILES.getlist('videos')
            if arquivos:
                ordem_inicial = curso.videos.count()
                _criar_videos_curso(professor, curso, arquivos, ordem_inicial)

        curso.refresh_from_db()
        return Response(ProfessorCursoSerializer(curso, context={'request': request}).data)

    serializer = ProfessorCursoSerializer(curso, context={'request': request})
    return Response(serializer.data)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def professor_curso_video_delete(request, curso_id, video_id):
    professor = _get_professor(request)
    if not professor:
        return _professor_required_response()

    curso = get_object_or_404(Curso, id=curso_id, professor=professor)
    video = get_object_or_404(Video, id=video_id, curso=curso)
    video.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def professor_curso_engajamento(request, curso_id):
    professor = _get_professor(request)
    if not professor:
        return _professor_required_response()

    curso = get_object_or_404(Curso, id=curso_id, professor=professor)
    inscricoes = Inscricao.objects.filter(curso=curso).select_related('aluno__profile').order_by('-inscrito_em')
    total_inscritos = inscricoes.count()
    total_concluidos = inscricoes.filter(concluido=True).count()
    taxa_conclusao = round((total_concluidos / total_inscritos * 100), 1) if total_inscritos > 0 else 0

    return Response({
        'curso': ProfessorCursoSerializer(curso, context={'request': request}).data,
        'totalInscritos': total_inscritos,
        'totalVisualizacoes': curso.total_visualizacoes(),
        'totalConcluidos': total_concluidos,
        'taxaConclusao': taxa_conclusao,
        'inscricoes': [
            {
                'id': i.id,
                'aluno': i.aluno.profile.username,
                'inscritoEm': i.inscrito_em.isoformat(),
                'concluido': i.concluido,
            }
            for i in inscricoes
        ],
    })


# ── VÍDEOS ───────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def professor_videos(request):
    professor = _get_professor(request)
    if not professor:
        return _professor_required_response()

    if request.method == 'POST':
        serializer = ProfessorVideoSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(professor=professor)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    videos = Video.objects.filter(professor=professor, curso__isnull=True)
    serializer = ProfessorVideoSerializer(videos, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def professor_video_detail(request, video_id):
    professor = _get_professor(request)
    if not professor:
        return _professor_required_response()

    video = get_object_or_404(Video, id=video_id, professor=professor)

    if request.method == 'DELETE':
        video.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    if request.method == 'PATCH':
        serializer = ProfessorVideoSerializer(video, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    serializer = ProfessorVideoSerializer(video, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def professor_video_engajamento(request, video_id):
    professor = _get_professor(request)
    if not professor:
        return _professor_required_response()

    video = get_object_or_404(Video, id=video_id, professor=professor)
    reacoes = ReacaoVideo.objects.filter(video=video).select_related('utilizador')

    return Response({
        'video': ProfessorVideoSerializer(video, context={'request': request}).data,
        'totalLikes': video.total_likes(),
        'totalDislikes': reacoes.filter(tipo='dislike').count(),
        'totalVisualizacoes': video.total_visualizacoes(),
        'reacoes': ReacaoVideoSerializer(reacoes, many=True).data,
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def professor_videos_reordenar(request):
    professor = _get_professor(request)
    if not professor:
        return _professor_required_response()

    ids = request.data.get('ordem', [])
    videos_por_id = {v.id: v for v in Video.objects.filter(professor=professor, curso__isnull=True, id__in=ids)}
    for posicao, video_id in enumerate(ids):
        video = videos_por_id.get(int(video_id))
        if video:
            video.ordem = posicao
            video.save(update_fields=['ordem'])

    return Response({'ok': True})


# ── SEGUIR ───────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def professor_toggle_seguir(request, professor_id):
    professor = get_object_or_404(Professor, id=professor_id)
    seguidor, created = Seguidor.objects.get_or_create(utilizador=request.user, professor=professor)
    seguindo = True
    if not created:
        seguidor.delete()
        seguindo = False

    return Response({'seguindo': seguindo, 'seguidores': professor.seguidores.count()})
