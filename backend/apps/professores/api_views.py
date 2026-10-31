from django.contrib.auth import logout
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.notificacoes import notificar
from apps.cursos.models import Curso, EngajamentoCurso, Inscricao, RecursoCurso
from apps.moderacao.filtro import ConteudoRecusado, verificar_publicacao
from apps.plataforma.servicos import configuracao, limite_pdf_bytes, limite_video_bytes

from .models import Professor, ReacaoVideo, RecursoVideo, Seguidor, Video
from .serializers import (
    ProfessorCursoSerializer,
    ProfessorSerializer,
    ProfessorVideoSerializer,
    ReacaoVideoSerializer,
)
from .video_processing import atualizar_duracao

TAMANHO_MAX_LEGENDA_BYTES = 1024 * 1024  # 1MB — uma legenda de 2h tem ~150KB

# Ao editar, o professor muda o texto, a capa e os recursos, mas não troca o vídeo
# (nem as aulas de um curso): quem já viu ou comentou continua a ver o mesmo vídeo.
MSG_NAO_TROCAR_VIDEO = 'Ao editar não é possível trocar o vídeo. Para outro vídeo, publica-o como novo.'
MSG_NAO_TROCAR_AULAS = (
    'Ao editar um curso não é possível trocar, acrescentar ou apagar aulas. '
    'Muda o título, a descrição, a capa ou os recursos.'
)
CAMPOS_CONTEUDO_VIDEO = ('titulo', 'descricao', 'thumbnail')
CAMPOS_CONTEUDO_CURSO = ('titulo', 'descricao', 'categoria_id', 'preco', 'duracao', 'thumbnail')


def _estado(obj, campos):
    return {c: str(getattr(obj, c) or '') for c in campos}


def _marcar_editado(obj, antes, campos, houve_ficheiros=False):
    """Marca "editado" só quando muda o conteúdo (não ao publicar ou esconder)."""
    if houve_ficheiros or _estado(obj, campos) != antes:
        obj.editado_em = timezone.now()
        obj.save(update_fields=['editado_em'])


def _get_professor(request):
    return Professor.objects.filter(user=request.user).first()


def _professor_required_response():
    return Response({'detail': 'Perfil de professor não encontrado.'}, status=status.HTTP_403_FORBIDDEN)


def _validar_arquivo_pdf(arquivo):
    """Devolve a mensagem de erro, ou None se o ficheiro for um PDF válido."""
    e_pdf = arquivo.content_type == 'application/pdf' or arquivo.name.lower().endswith('.pdf')
    if not e_pdf:
        return 'Apenas são aceites ficheiros PDF.'
    if arquivo.size > limite_pdf_bytes():
        return f'O ficheiro deve ter no máximo {configuracao().limite_pdf_mb}MB.'
    return None


def _validar_tamanho_video(arquivo):
    """Lança ValueError se o vídeo ultrapassar o limite definido pelos administradores."""
    if arquivo is not None and arquivo.size > limite_video_bytes():
        raise ValueError(f'Cada vídeo pode ter no máximo {configuracao().limite_video_mb}MB.')


def _notificar_seguidores(professor, mensagem: str, link: str):
    """Lançamento (curso/vídeo novo) → quem segue o professor. O email
    respeita o interruptor "Novidades da plataforma"."""
    for seguidor in professor.seguidores.select_related('utilizador'):
        notificar(
            seguidor.utilizador, 'lancamento', mensagem, link=link,
            categoria_email='novidades', assunto_email=f'Novidade de {professor.nome_publico}',
        )


def _criar_recursos(model_cls, fk_campo, fk_valor, arquivos):
    """Cria um RecursoCurso/RecursoVideo por ficheiro. Lança ValueError (com
    a mensagem já pronta a devolver ao cliente) se algum ficheiro for inválido
    — quem chama corre isto dentro de uma transação, para não deixar recursos
    a meio criados quando um ficheiro a meio da lista falha a validação."""
    criados = []
    for arquivo in arquivos:
        erro = _validar_arquivo_pdf(arquivo)
        if erro:
            raise ValueError(erro)
        criados.append(model_cls.objects.create(
            **{fk_campo: fk_valor},
            nome=arquivo.name,
            tipo='pdf',
            arquivo=arquivo,
            tamanho_bytes=arquivo.size,
        ))
    return criados


# ── PERFIL ───────────────────────────────────────────────────────────────────

@api_view(['GET', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def professor_perfil(request):
    professor = _get_professor(request)
    if not professor:
        return _professor_required_response()

    if request.method == 'PATCH':
        try:
            verificar_publicacao(
                request.user, f"{request.data.get('bio', '')} {request.data.get('nome_publico', '')}", 'bio',
            )
        except ConteudoRecusado as erro:
            return Response({'detail': erro.mensagem}, status=erro.status)
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
    for arquivo in arquivos:
        _validar_tamanho_video(arquivo)
    for indice, arquivo in enumerate(arquivos):
        video = Video.objects.create(
            professor=professor,
            curso=curso,
            titulo=f'{curso.titulo} — vídeo {ordem_inicial + indice + 1}',
            arquivo=arquivo,
            ativo=True,
            ordem=ordem_inicial + indice,
        )
        atualizar_duracao(video)


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
        try:
            with transaction.atomic():
                curso = serializer.save(professor=professor)
                _criar_videos_curso(professor, curso, arquivos)
                _criar_recursos(RecursoCurso, 'curso', curso, request.FILES.getlist('recursos'))
        except ValueError as erro:
            return Response({'detail': str(erro)}, status=status.HTTP_400_BAD_REQUEST)

        curso.refresh_from_db()
        if curso.ativo:
            _notificar_seguidores(professor, f'{professor.nome_publico} publicou um curso novo: "{curso.titulo}"', f'/cursos/{curso.id}')
        return Response(
            ProfessorCursoSerializer(curso, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    # prefetch evita uma query extra por curso (vídeos) e por campo calculado
    # (inscritos, visualizações, conclusão média) — ver nota de N+1 em cursos/views.py.
    # O 'recursos' dentro do Prefetch de 'videos' evita, por sua vez, uma query
    # extra por aula (ProfessorCursoVideoSerializer.get_recursos).
    videos_com_recursos = Video.objects.order_by('ordem', '-criado_em').prefetch_related('recursos')
    cursos = (
        Curso.objects.filter(professor=professor)
        .order_by('-criado_em')
        .prefetch_related(
            Prefetch('videos', queryset=videos_com_recursos),
            'inscricoes', 'engajamentos', 'recursos',
        )
    )
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
        if request.FILES.getlist('videos'):
            return Response({'detail': MSG_NAO_TROCAR_AULAS}, status=status.HTTP_400_BAD_REQUEST)
        antes = _estado(curso, CAMPOS_CONTEUDO_CURSO)
        serializer = ProfessorCursoSerializer(curso, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        novos_recursos = request.FILES.getlist('recursos')
        try:
            with transaction.atomic():
                curso = serializer.save()
                if novos_recursos:
                    _criar_recursos(RecursoCurso, 'curso', curso, novos_recursos)
        except ValueError as erro:
            return Response({'detail': str(erro)}, status=status.HTTP_400_BAD_REQUEST)

        _marcar_editado(curso, antes, CAMPOS_CONTEUDO_CURSO, houve_ficheiros=bool(novos_recursos))
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
    get_object_or_404(Video, id=video_id, curso=curso)
    # As aulas de um curso não se trocam nem se apagam ao editar.
    return Response({'detail': MSG_NAO_TROCAR_AULAS}, status=status.HTTP_400_BAD_REQUEST)


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

    aulas = list(
        curso.videos.filter(ativo=True).order_by('ordem', 'criado_em')
        .prefetch_related('reacoes', 'visualizacoes', 'comentarios')
    )
    total_aulas = len(aulas)
    total_gostos = sum(v.total_likes() for v in aulas)
    total_comentarios = sum(len(v.comentarios.all()) for v in aulas)
    visualizadores_unicos = EngajamentoCurso.objects.filter(curso=curso).count()
    # `curso.total_visualizacoes()`: nº de vezes que alunos abriram o curso
    # (EngajamentoCurso, incrementado em `curso_inscrever`) — diferente da soma
    # de `VisualizacaoVideo` de cada aula (essa fica só no detalhe por aula,
    # em `aulas`, para não confundir duas métricas diferentes).
    media_visualizacoes_aula = round(curso.total_visualizacoes() / total_aulas, 1) if total_aulas > 0 else 0
    avaliacoes = list(curso.avaliacoes.select_related('aluno__profile').order_by('-atualizado_em'))
    media_avaliacoes = (
        round(sum(a.estrelas for a in avaliacoes) / len(avaliacoes), 1) if avaliacoes else None
    )

    return Response({
        'curso': ProfessorCursoSerializer(curso, context={'request': request}).data,
        'totalInscritos': total_inscritos,
        'totalVisualizacoes': curso.total_visualizacoes(),
        'totalConcluidos': total_concluidos,
        'taxaConclusao': taxa_conclusao,
        'totalAulas': total_aulas,
        'totalGostos': total_gostos,
        'totalComentarios': total_comentarios,
        'visualizadoresUnicos': visualizadores_unicos,
        'mediaVisualizacoesPorAula': media_visualizacoes_aula,
        'mediaAvaliacoes': media_avaliacoes,
        'totalAvaliacoes': len(avaliacoes),
        'avaliacoesRecentes': [
            {
                'id': a.id,
                'aluno': a.aluno.profile.get_display_name() or a.aluno.profile.username,
                'estrelas': a.estrelas,
                'comentario': a.comentario,
                'atualizadoEm': a.atualizado_em.isoformat(),
            }
            for a in avaliacoes[:10]
        ],
        # Engajamento de cada aula do curso individualmente — para o professor
        # ver qual aula está a ir melhor/pior, não só o agregado do curso.
        'aulas': [
            {
                'id': v.id,
                'titulo': v.titulo,
                'ordem': v.ordem,
                'duracaoSegundos': v.duracao_segundos,
                'totalVisualizacoes': v.total_visualizacoes(),
                'totalLikes': v.total_likes(),
                'totalComentarios': len(v.comentarios.all()),
            }
            for v in aulas
        ],
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
        try:
            _validar_tamanho_video(request.FILES.get('arquivo'))
            with transaction.atomic():
                video = serializer.save(professor=professor)
                _criar_recursos(RecursoVideo, 'video', video, request.FILES.getlist('recursos'))
        except ValueError as erro:
            return Response({'detail': str(erro)}, status=status.HTTP_400_BAD_REQUEST)
        atualizar_duracao(video)
        if video.ativo:
            _notificar_seguidores(professor, f'{professor.nome_publico} publicou um vídeo novo: "{video.titulo}"', f'/videos/{video.id}')
        return Response(
            ProfessorVideoSerializer(video, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    videos = (
        Video.objects.filter(professor=professor, curso__isnull=True)
        .prefetch_related('reacoes', 'visualizacoes', 'comentarios', 'recursos')
    )
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
        url_nova = request.data.get('url_externa')
        troca_link = url_nova is not None and (url_nova or '') != (video.url_externa or '')
        if request.FILES.get('arquivo') or troca_link:
            return Response({'detail': MSG_NAO_TROCAR_VIDEO}, status=status.HTTP_400_BAD_REQUEST)
        antes = _estado(video, CAMPOS_CONTEUDO_VIDEO)
        serializer = ProfessorVideoSerializer(video, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        novos_recursos = request.FILES.getlist('recursos')
        try:
            with transaction.atomic():
                video = serializer.save()
                if novos_recursos:
                    _criar_recursos(RecursoVideo, 'video', video, novos_recursos)
        except ValueError as erro:
            return Response({'detail': str(erro)}, status=status.HTTP_400_BAD_REQUEST)
        _marcar_editado(video, antes, CAMPOS_CONTEUDO_VIDEO, houve_ficheiros=bool(novos_recursos))
        return Response(ProfessorVideoSerializer(video, context={'request': request}).data)

    serializer = ProfessorVideoSerializer(video, context={'request': request})
    return Response(serializer.data)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def professor_video_recurso_delete(request, video_id, recurso_id):
    """Só o professor dono do vídeo pode apagar um recurso."""
    professor = _get_professor(request)
    if not professor:
        return _professor_required_response()

    video = get_object_or_404(Video, id=video_id, professor=professor)
    recurso = get_object_or_404(RecursoVideo, id=recurso_id, video=video)
    recurso.arquivo.delete(save=False)
    recurso.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def professor_video_engajamento(request, video_id):
    professor = _get_professor(request)
    if not professor:
        return _professor_required_response()

    video = get_object_or_404(Video, id=video_id, professor=professor)
    reacoes = ReacaoVideo.objects.filter(video=video).select_related('utilizador')
    total_likes = video.total_likes()
    total_dislikes = reacoes.filter(tipo='dislike').count()
    total_visualizadores = video.visualizacoes.count()

    # Se esta aula pertence a um curso, mostra também o engajamento das
    # OUTRAS aulas do mesmo curso — dá ao professor uma visão comparativa
    # sem ter de sair desta página para a do curso.
    outras_aulas_do_curso = []
    if video.curso_id:
        outras = (
            Video.objects.filter(curso_id=video.curso_id, ativo=True)
            .exclude(id=video.id)
            .order_by('ordem', 'criado_em')
            .prefetch_related('reacoes', 'visualizacoes', 'comentarios')
        )
        outras_aulas_do_curso = [
            {
                'id': v.id,
                'titulo': v.titulo,
                'ordem': v.ordem,
                'duracaoSegundos': v.duracao_segundos,
                'totalVisualizacoes': v.total_visualizacoes(),
                'totalLikes': v.total_likes(),
                'totalComentarios': len(v.comentarios.all()),
            }
            for v in outras
        ]

    return Response({
        'video': ProfessorVideoSerializer(video, context={'request': request}).data,
        'totalLikes': total_likes,
        'totalDislikes': total_dislikes,
        'totalVisualizacoes': video.total_visualizacoes(),
        'totalVisualizadoresUnicos': total_visualizadores,
        'totalComentarios': video.comentarios.count(),
        'taxaAprovacao': (
            round((total_likes / (total_likes + total_dislikes)) * 100) if (total_likes + total_dislikes) > 0 else None
        ),
        'cursoId': video.curso_id,
        'outrasAulasDoCurso': outras_aulas_do_curso,
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


def _srt_para_vtt(texto: str) -> str:
    """Converte SubRip (.srt) em WebVTT: cabeçalho + vírgula → ponto nos tempos."""
    import re
    texto = texto.replace('\r\n', '\n').replace('\r', '\n').strip()
    texto = re.sub(r'(\d{2}:\d{2}:\d{2}),(\d{3})', r'\1.\2', texto)
    return 'WEBVTT\n\n' + texto + '\n'


@api_view(['POST', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def professor_video_legenda(request, video_id):
    """Carrega (POST multipart `legenda`: .vtt ou .srt) ou remove (DELETE) as
    legendas de um vídeo do professor — avulso ou aula de um curso."""
    professor = _get_professor(request)
    if not professor:
        return _professor_required_response()
    video = get_object_or_404(Video, id=video_id, professor=professor)

    if request.method == 'DELETE':
        if video.legenda:
            video.legenda.delete(save=False)
        video.legenda = None
        video.save(update_fields=['legenda'])
        return Response({'ok': True, 'tem_legenda': False})

    arquivo = request.FILES.get('legenda')
    if not arquivo:
        return Response({'detail': 'Envia um ficheiro de legendas (.vtt ou .srt).'}, status=status.HTTP_400_BAD_REQUEST)
    nome = arquivo.name.lower()
    if not (nome.endswith('.vtt') or nome.endswith('.srt')):
        return Response({'detail': 'Só são aceites legendas .vtt ou .srt.'}, status=status.HTTP_400_BAD_REQUEST)
    if arquivo.size > TAMANHO_MAX_LEGENDA_BYTES:
        return Response({'detail': 'O ficheiro de legendas deve ter no máximo 1MB.'}, status=status.HTTP_400_BAD_REQUEST)

    bruto = arquivo.read()
    try:
        texto = bruto.decode('utf-8-sig')
    except UnicodeDecodeError:
        texto = bruto.decode('latin-1')  # .srt antigos gravados em Windows-1252/ISO-8859-1
    if nome.endswith('.srt'):
        texto = _srt_para_vtt(texto)
    elif not texto.lstrip().startswith('WEBVTT'):
        return Response({'detail': 'O ficheiro .vtt tem de começar por "WEBVTT".'}, status=status.HTTP_400_BAD_REQUEST)
    if '-->' not in texto:
        return Response({'detail': 'O ficheiro não tem legendas com tempos (00:00:01.000 --> …).'}, status=status.HTTP_400_BAD_REQUEST)

    if video.legenda:
        video.legenda.delete(save=False)
    video.legenda.save(f'video-{video.id}.vtt', ContentFile(texto.encode('utf-8')), save=True)
    return Response({'ok': True, 'tem_legenda': True})


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
