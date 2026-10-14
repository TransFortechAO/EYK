from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, Prefetch, Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .certificados import gerar_certificado_pdf
from .models import AvaliacaoCurso, Categoria, Curso, Inscricao, RecursoCurso
from .serializers import (
    AvaliacaoCursoSerializer,
    CategoriaSerializer,
    ComentarioVideoSerializer,
    CourseSerializer,
    RecursoCursoSerializer,
    VideoSerializer,
)
from apps.professores.models import (
    ComentarioVideo,
    PosicaoVisualizacao,
    ReacaoComentarioVideo,
    ReacaoVideo,
    Video,
    VisualizacaoVideo,
)
from apps.gamificacao.services import creditar_curso_concluido, creditar_professor_por_views

TAMANHO_MAX_RECURSO_BYTES = 50 * 1024 * 1024  # 50MB, igual ao limite validado no frontend

User = get_user_model()


class CursoViewSet(viewsets.ModelViewSet):
    """Listagem pública de cursos (só leitura). A criação/edição/remoção dos
    próprios cursos é feita pelo professor através de /api/professor/cursos/,
    que valida a posse do curso."""
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'head', 'options']

    def get_queryset(self):
        # Pré-carrega tudo o que o CourseSerializer precisa (vídeos + os seus
        # gostos/visualizações, inscrições, engajamento) numa única ronda de
        # queries, em vez de uma query extra por curso — e outra por vídeo
        # dentro de cada curso — como acontecia antes (bug de N+1 clássico,
        # o maior responsável por listagens lentas desta API).
        videos_ativos = Video.objects.filter(ativo=True).order_by('ordem', 'criado_em').prefetch_related(
            'reacoes', 'visualizacoes', 'recursos',
            # Só as posições do próprio utilizador ("retomar onde ficaste").
            Prefetch(
                'posicoes',
                queryset=PosicaoVisualizacao.objects.filter(utilizador=self.request.user),
                to_attr='minhas_posicoes',
            ),
        )
        return (
            Curso.objects.filter(ativo=True)
            .select_related('professor', 'categoria')
            .prefetch_related(
                Prefetch('videos', queryset=videos_ativos, to_attr='videos_ativos'),
                'inscricoes',
                'engajamentos',
                'recursos',
                'avaliacoes',
            )
        )


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

    videos_queryset = (
        Video.objects.filter(ativo=True, curso__isnull=True)
        .select_related('professor')
        .prefetch_related('reacoes', 'visualizacoes', 'recursos')
    )

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

    return Response({
        'likes': video.total_likes(),
        'dislikes': ReacaoVideo.objects.filter(video=video, tipo='dislike').count(),
    })


def _verificar_curso_concluido(user, curso) -> bool:
    from apps.alunos.models import Aluno

    aluno = Aluno.objects.filter(profile=user).first()
    if not aluno:
        return False

    inscricao = Inscricao.objects.filter(aluno=aluno, curso=curso).first()
    if not inscricao or inscricao.concluido:
        return False

    videos_ids = list(curso.videos.filter(ativo=True).values_list('id', flat=True))
    if not videos_ids:
        return False

    assistidos = VisualizacaoVideo.objects.filter(utilizador=user, video_id__in=videos_ids).count()
    if assistidos >= len(videos_ids):
        inscricao.concluido = True
        inscricao.concluido_em = timezone.now()
        inscricao.save(update_fields=['concluido', 'concluido_em'])
        creditar_curso_concluido(user, curso)
        return True
    return False


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def video_registar_view(request, pk):
    """Regista uma visualização real: só é chamado pelo frontend depois de 1
    minuto de reprodução CONTÍNUA (regra anti-fraude do modelo de coins).

    Não conta como view quando é o próprio professor a "ver" o seu vídeo —
    nem para o pagamento por views nem para a conclusão do curso.
    """
    try:
        video = Video.objects.select_related('professor').get(pk=pk, ativo=True)
    except Video.DoesNotExist:
        return Response({'detail': 'Vídeo não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    e_dono = video.professor.user_id == request.user.id
    if e_dono:
        return Response({'novaView': False, 'cursoConcluido': False})

    view, criada = VisualizacaoVideo.objects.get_or_create(video=video, utilizador=request.user)
    if not criada:
        view.count += 1
        view.save(update_fields=['count', 'ultima_visualizacao'])

    creditar_professor_por_views(video.professor)

    curso_concluido = False
    if video.curso_id:
        curso_concluido = _verificar_curso_concluido(request.user, video.curso)

    return Response({'novaView': criada, 'cursoConcluido': curso_concluido})


# Nos últimos segundos do vídeo, considera-se que o aluno terminou: a próxima
# vez que abrir a aula começa do início em vez de "retomar" nos créditos finais.
MARGEM_FIM_VIDEO_SEGUNDOS = 10


@api_view(['GET', 'PUT'])
@permission_classes([permissions.IsAuthenticated])
def video_posicao(request, pk):
    """Posição de reprodução do utilizador num vídeo ("retomar onde ficaste").

    GET devolve `{segundos}` (0 se nunca viu). PUT `{segundos}` guarda a
    posição atual — o player chama-o a cada poucos segundos de reprodução,
    ao pausar e ao sair da página.
    """
    video = get_object_or_404(Video, pk=pk, ativo=True)

    if request.method == 'GET':
        posicao = PosicaoVisualizacao.objects.filter(video=video, utilizador=request.user).first()
        return Response({'segundos': posicao.segundos if posicao else 0})

    try:
        segundos = int(float(request.data.get('segundos', 0)))
    except (TypeError, ValueError):
        return Response({'detail': 'Posição inválida.'}, status=status.HTTP_400_BAD_REQUEST)
    segundos = max(segundos, 0)
    if video.duracao_segundos:
        if segundos >= video.duracao_segundos - MARGEM_FIM_VIDEO_SEGUNDOS:
            segundos = 0
        segundos = min(segundos, video.duracao_segundos)

    PosicaoVisualizacao.objects.update_or_create(
        video=video, utilizador=request.user, defaults={'segundos': segundos},
    )
    return Response({'segundos': segundos})


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def video_comentarios(request, pk):
    """Comentários de um vídeo (avulso ou aula de curso). O professor pode
    comentar no seu próprio conteúdo, tal como qualquer aluno."""
    try:
        video = Video.objects.select_related('professor__user').get(pk=pk, ativo=True)
    except Video.DoesNotExist:
        return Response({'detail': 'Vídeo não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'POST':
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


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def curso_recursos(request, pk):
    """Lista (qualquer utilizador autenticado pode ver/descarregar) ou cria
    (só o professor dono) um recurso (PDF) anexado ao curso."""
    try:
        curso = Curso.objects.select_related('professor').get(pk=pk, ativo=True)
    except Curso.DoesNotExist:
        return Response({'detail': 'Curso não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    e_dono = curso.professor.user_id == request.user.id

    if request.method == 'POST':
        if not e_dono:
            return Response(
                {'detail': 'Só o professor do curso pode adicionar recursos.'}, status=status.HTTP_403_FORBIDDEN,
            )

        arquivo = request.FILES.get('arquivo')
        if not arquivo:
            return Response({'detail': 'Envia um ficheiro PDF.'}, status=status.HTTP_400_BAD_REQUEST)
        if (arquivo.content_type not in ('application/pdf',)
                and not arquivo.name.lower().endswith('.pdf')):
            return Response({'detail': 'Apenas são aceites ficheiros PDF.'}, status=status.HTTP_400_BAD_REQUEST)
        if arquivo.size > TAMANHO_MAX_RECURSO_BYTES:
            return Response(
                {'detail': 'O ficheiro deve ter no máximo 50MB.'}, status=status.HTTP_400_BAD_REQUEST,
            )

        nome = (request.data.get('nome') or arquivo.name or 'Recurso').strip()
        recurso = RecursoCurso.objects.create(
            curso=curso,
            nome=nome,
            tipo=request.data.get('tipo') or RecursoCurso.TIPO_PDF,
            arquivo=arquivo,
            tamanho_bytes=arquivo.size,
        )
        serializer = RecursoCursoSerializer(recurso, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    recursos = curso.recursos.all()
    serializer = RecursoCursoSerializer(recursos, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def curso_recurso_delete(request, pk, recurso_id):
    """Só o professor dono do curso pode apagar um recurso."""
    curso = get_object_or_404(Curso, pk=pk)
    if curso.professor.user_id != request.user.id:
        return Response(
            {'detail': 'Só o professor do curso pode remover recursos.'}, status=status.HTTP_403_FORBIDDEN,
        )
    recurso = get_object_or_404(RecursoCurso, id=recurso_id, curso=curso)
    recurso.arquivo.delete(save=False)
    recurso.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ── Certificados de conclusão ────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def curso_certificado(request, pk):
    """Descarrega o certificado (PDF) do aluno autenticado — só depois de o
    curso estar concluído (`Inscricao.concluido`)."""
    from apps.alunos.models import Aluno

    curso = get_object_or_404(Curso.objects.select_related('professor'), pk=pk)
    aluno = Aluno.objects.filter(profile=request.user).first()
    inscricao = (
        Inscricao.objects.filter(aluno=aluno, curso=curso).select_related('aluno__profile').first()
        if aluno else None
    )
    if not inscricao or not inscricao.concluido:
        return Response(
            {'detail': 'O certificado fica disponível quando concluíres o curso.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    if not request.user.email_verificado:
        # O certificado leva o nome do aluno e é verificável publicamente —
        # só é emitido a contas com o email confirmado.
        return Response(
            {
                'detail': 'Confirma o teu email para descarregares o certificado.',
                'codigo': 'email_nao_verificado',
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    if inscricao.concluido_em is None:
        # Cursos concluídos antes de existir `concluido_em`: fixa a data agora,
        # para o certificado mostrar sempre a mesma data em downloads futuros.
        inscricao.concluido_em = timezone.now()
        inscricao.save(update_fields=['concluido_em'])

    pdf = gerar_certificado_pdf(inscricao)
    response = HttpResponse(pdf, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="certificado-eyk-curso-{curso.id}.pdf"'
    return response


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def certificado_verificar(request, codigo):
    """Verificação pública de um certificado (link/QR impresso no PDF). Só
    expõe o necessário para confirmar a autenticidade — nunca email/username."""
    inscricao = (
        Inscricao.objects.filter(codigo_certificado=codigo, concluido=True)
        .select_related('aluno__profile', 'curso__professor')
        .first()
    )
    if not inscricao:
        return Response({'valido': False}, status=status.HTTP_404_NOT_FOUND)

    user = inscricao.aluno.profile
    return Response({
        'valido': True,
        'codigo': str(inscricao.codigo_certificado),
        'aluno': user.get_display_name() or user.username,
        'curso': inscricao.curso.titulo,
        'cursoId': inscricao.curso.id,
        'professor': inscricao.curso.professor.nome_publico,
        'concluidoEm': inscricao.concluido_em.isoformat() if inscricao.concluido_em else None,
    })


# ── Avaliações de curso ──────────────────────────────────────────────────────

def _resumo_avaliacoes(curso) -> dict:
    agregados = curso.avaliacoes.aggregate(media=Avg('estrelas'), total=Count('id'))
    distribuicao = {str(n): 0 for n in range(1, 6)}
    for linha in curso.avaliacoes.values('estrelas').annotate(n=Count('id')):
        distribuicao[str(linha['estrelas'])] = linha['n']
    return {
        'media': round(agregados['media'], 1) if agregados['media'] is not None else None,
        'total': agregados['total'],
        'distribuicao': distribuicao,
    }


@api_view(['GET', 'POST', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def curso_avaliacoes(request, pk):
    """GET: resumo (média, distribuição) + lista de avaliações do curso.
    POST `{estrelas, comentario}`: cria/atualiza a avaliação do aluno
    autenticado (tem de estar inscrito; o professor não avalia o próprio curso).
    DELETE: remove a avaliação do aluno autenticado."""
    from apps.alunos.models import Aluno

    curso = get_object_or_404(Curso.objects.select_related('professor'), pk=pk, ativo=True)
    aluno = Aluno.objects.filter(profile=request.user).first()
    inscrito = bool(aluno) and Inscricao.objects.filter(aluno=aluno, curso=curso).exists()
    pode_avaliar = inscrito and curso.professor.user_id != request.user.id

    if request.method == 'POST':
        if not pode_avaliar:
            return Response(
                {'detail': 'Só alunos inscritos no curso podem avaliá-lo.'}, status=status.HTTP_403_FORBIDDEN,
            )
        try:
            estrelas = int(request.data.get('estrelas'))
        except (TypeError, ValueError):
            estrelas = 0
        if not 1 <= estrelas <= 5:
            return Response({'detail': 'Escolhe entre 1 e 5 estrelas.'}, status=status.HTTP_400_BAD_REQUEST)
        comentario = (request.data.get('comentario') or '').strip()[:2000]

        avaliacao, criada = AvaliacaoCurso.objects.update_or_create(
            curso=curso, aluno=aluno, defaults={'estrelas': estrelas, 'comentario': comentario},
        )
        return Response(
            {
                'avaliacao': AvaliacaoCursoSerializer(avaliacao, context={'request': request}).data,
                'resumo': _resumo_avaliacoes(curso),
            },
            status=status.HTTP_201_CREATED if criada else status.HTTP_200_OK,
        )

    if request.method == 'DELETE':
        if aluno:
            AvaliacaoCurso.objects.filter(curso=curso, aluno=aluno).delete()
        return Response({'resumo': _resumo_avaliacoes(curso)})

    avaliacoes = curso.avaliacoes.select_related('aluno__profile')
    minha = next((a for a in avaliacoes if aluno and a.aluno_id == aluno.id), None)
    serializer_ctx = {'request': request}
    return Response({
        'resumo': _resumo_avaliacoes(curso),
        'podeAvaliar': pode_avaliar,
        'minha': AvaliacaoCursoSerializer(minha, context=serializer_ctx).data if minha else None,
        'avaliacoes': AvaliacaoCursoSerializer(avaliacoes, many=True, context=serializer_ctx).data,
    })
