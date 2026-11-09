"""O Início centrado na aprendizagem: o que a pessoa está a aprender e o que lhe recomendamos."""
from django.db.models import Max
from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.alunos.models import Aluno
from apps.professores.models import PosicaoVisualizacao, Seguidor, Video, VisualizacaoVideo

from .models import Inscricao
from .serializers import CourseSerializer, VideoSerializer
from .views import cursos_visiveis

EM_ANDAMENTO = 3
VIDEOS_A_MEIO = 2
RECOMENDADOS = 8


def _url(campo) -> str | None:
    try:
        return campo.url if campo else None
    except ValueError:
        return None


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def continuar_aprender(request):
    """Cursos em andamento (com a percentagem real de aulas vistas e a última aula) e
    vídeos deixados a meio."""
    user = request.user
    aluno = Aluno.objects.filter(profile=user).first()
    cursos = []
    if aluno:
        inscricoes = Inscricao.objects.filter(
            aluno=aluno, concluido=False, curso__ativo=True, curso__oculto=False,
        ).select_related('curso', 'curso__categoria')
        for ins in inscricoes:
            curso = ins.curso
            aulas = list(Video.objects.filter(curso=curso, ativo=True, oculto=False).order_by('ordem', 'criado_em'))
            if not aulas:
                continue
            ids = [a.id for a in aulas]
            vistas = set(VisualizacaoVideo.objects.filter(utilizador=user, video_id__in=ids).values_list('video_id', flat=True))
            posicao = PosicaoVisualizacao.objects.filter(utilizador=user, video_id__in=ids).order_by('-atualizado_em').first()
            ultima_vista = VisualizacaoVideo.objects.filter(utilizador=user, video_id__in=ids).aggregate(t=Max('ultima_visualizacao'))['t']
            momentos = [m for m in (posicao.atualizado_em if posicao else None, ultima_vista, ins.inscrito_em) if m]
            # A última aula mexida; sem nenhuma, a primeira por ver.
            if posicao:
                aula, segundos = next(a for a in aulas if a.id == posicao.video_id), posicao.segundos
            else:
                aula, segundos = next((a for a in aulas if a.id not in vistas), aulas[0]), 0
            cursos.append({
                'cursoId': curso.id,
                'titulo': curso.titulo,
                'categoria': curso.categoria.nome if curso.categoria else None,
                'thumbnail': _url(curso.thumbnail),
                'progresso': round(len(vistas) / len(aulas) * 100),
                'aulasVistas': len(vistas),
                'totalAulas': len(aulas),
                'ultimaAula': {'id': aula.id, 'titulo': aula.titulo, 'segundos': segundos, 'duracao': aula.duracao_segundos},
                '_quando': max(momentos),
            })
        cursos.sort(key=lambda c: c['_quando'], reverse=True)
        cursos = cursos[:EM_ANDAMENTO]
        for c in cursos:
            c.pop('_quando')

    videos = []
    posicoes = PosicaoVisualizacao.objects.filter(
        utilizador=user, video__curso__isnull=True, video__ativo=True, video__oculto=False, segundos__gte=10,
    ).select_related('video').order_by('-atualizado_em')[:10]
    for p in posicoes:
        duracao = p.video.duracao_segundos
        if duracao and p.segundos >= duracao * 0.9:
            continue
        videos.append({
            'videoId': p.video_id, 'titulo': p.video.titulo, 'thumbnail': _url(p.video.thumbnail),
            'segundos': p.segundos, 'duracao': duracao,
        })
        if len(videos) == VIDEOS_A_MEIO:
            break
    return Response({'cursos': cursos, 'videos': videos})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def recomendados(request):
    """Cursos e vídeos pelo que a pessoa já aprende (categorias) e por quem segue; sem
    histórico, os mais procurados. Cada sugestão diz porquê."""
    user = request.user
    aluno = Aluno.objects.filter(profile=user).first()
    inscritos = set(Inscricao.objects.filter(aluno=aluno).values_list('curso_id', flat=True)) if aluno else set()
    vistos = set(VisualizacaoVideo.objects.filter(utilizador=user).values_list('video_id', flat=True))
    categorias = set(
        Inscricao.objects.filter(aluno=aluno, curso__categoria__isnull=False).values_list('curso__categoria__nome', flat=True)
    ) if aluno else set()
    categorias |= set(
        Video.objects.filter(id__in=vistos, curso__categoria__isnull=False).values_list('curso__categoria__nome', flat=True)
    )
    seguidos = set(Seguidor.objects.filter(utilizador=user).values_list('professor_id', flat=True))

    def motivo_e_pontos(categoria, professor_id, professor_nome, popularidade):
        pontos, motivo = min(popularidade, 50) / 50, 'Popular na EYK'
        if professor_id in seguidos:
            pontos, motivo = pontos + 2, f'Porque segues {professor_nome}'
        if categoria and categoria in categorias:
            pontos, motivo = pontos + 3, f'Porque aprendes {categoria}'
        return pontos, motivo

    candidatos = [c for c in cursos_visiveis(user).exclude(professor__user=user)[:200] if c.id not in inscritos]
    cursos = []
    for c in candidatos:
        pontos, motivo = motivo_e_pontos(
            c.categoria.nome if c.categoria else None, c.professor_id, c.professor.nome_publico, c.total_inscritos(),
        )
        cursos.append((pontos, c, motivo))
    cursos.sort(key=lambda x: (-x[0], -x[1].id))

    videos_q = (
        Video.objects.filter(ativo=True, oculto=False, curso__isnull=True)
        .exclude(id__in=vistos).exclude(professor__user=user)
        .select_related('professor').prefetch_related('reacoes', 'visualizacoes', 'recursos')[:200]
    )
    videos = []
    for v in videos_q:
        pontos, motivo = motivo_e_pontos(None, v.professor_id, v.professor.nome_publico, v.total_visualizacoes())
        videos.append((pontos, v, motivo))
    videos.sort(key=lambda x: (-x[0], -x[1].id))

    contexto = {'request': request}
    return Response({
        'cursos': [
            {**CourseSerializer(c, context=contexto).data, 'motivo': m} for _, c, m in cursos[:RECOMENDADOS]
        ],
        'videos': [
            {**VideoSerializer(v, context=contexto).data, 'motivo': m} for _, v, m in videos[:RECOMENDADOS]
        ],
    })
