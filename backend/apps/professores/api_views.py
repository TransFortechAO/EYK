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
from apps.plataforma.segundo_plano import executar_depois
from apps.plataforma.servicos import configuracao, limite_aula_bytes, limite_pdf_bytes, limite_video_bytes

from . import envio_direto
from .envio_direto import EnvioInvalido
from .models import Professor, ReacaoVideo, RecursoVideo, Seguidor, Video
from .serializers import (
    ProfessorCursoSerializer,
    ProfessorSerializer,
    ProfessorVideoSerializer,
    ReacaoVideoSerializer,
)
from .video_processing import processar_videos

TAMANHO_MAX_LEGENDA_BYTES = 1024 * 1024  # 1MB — uma legenda de 2h tem ~150KB

# Ao editar, o professor muda o texto, a capa e os recursos, mas não troca o vídeo
# (nem as aulas de um curso): quem já viu ou comentou continua a ver o mesmo vídeo.
MSG_NAO_TROCAR_VIDEO = 'Ao editar não é possível trocar o vídeo. Para outro vídeo, publica-o como novo.'
MSG_NAO_TROCAR_AULAS = (
    'Ao editar um curso não é possível trocar, acrescentar ou apagar aulas. '
    'Muda o título, a descrição, a capa ou os recursos.'
)
CAMPOS_CONTEUDO_VIDEO = ('titulo', 'descricao', 'categoria_id', 'thumbnail')
CAMPOS_CONTEUDO_CURSO = ('titulo', 'descricao', 'categoria_id', 'preco', 'duracao', 'thumbnail')


def _estado(obj, campos):
    return {c: str(getattr(obj, c) or '') for c in campos}


def _marcar_editado(obj, antes, campos, houve_ficheiros=False):
    """Marca "editado" só quando muda o conteúdo (não ao publicar ou esconder)."""
    if houve_ficheiros or _estado(obj, campos) != antes:
        obj.editado_em = timezone.now()
        obj.save(update_fields=['editado_em'])


def _get_professor(request):
    # Suspenso (ativo=False) não usa a área de professor.
    return Professor.objects.filter(user=request.user, ativo=True).first()


def _bloqueio_seguranca(professor, request):
    """Antes de criar ou alterar: código de conduta aceite e, para conteúdos para crianças,
    a autorização própria. Devolve a resposta de recusa, ou None."""
    # Desativado temporariamente (18/11/2026): o frontend ainda não tem o
    # fluxo de aceitação do código de conduta nem o de autorização para
    # menores, por isso este bloqueio impedia todo o trabalho de criar/
    # editar cursos e vídeos. Remover esta linha reativa as duas
    # verificações abaixo assim que o frontend suportar os dois fluxos.
    return None

    from .conduta import VERSAO
    from .seguranca import autorizado_para_menores, quer_para_criancas

    if professor.conduta_versao != VERSAO:
        return Response(
            {'detail': 'Aceita o código de conduta dos professores antes de continuar.', 'codigo': 'conduta'},
            status=status.HTTP_403_FORBIDDEN,
        )
    if quer_para_criancas(request) and not autorizado_para_menores(professor):
        return Response(
            {'detail': 'Para marcar conteúdos para crianças e adolescentes precisas da autorização própria.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


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


def _validar_tamanho_video(arquivo, aula=False):
    """Lança ValueError se o vídeo ultrapassar o limite definido pelos administradores
    (um para vídeos avulsos, outro para os vídeos das aulas de um curso)."""
    if arquivo is None:
        return
    if aula and arquivo.size > limite_aula_bytes():
        raise ValueError(f'Cada aula pode ter no máximo {configuracao().limite_aula_mb}MB.')
    if not aula and arquivo.size > limite_video_bytes():
        raise ValueError(f'Cada vídeo pode ter no máximo {configuracao().limite_video_mb}MB.')


def _lista(request, campo: str) -> list:
    """Valores repetidos de um campo, em multipart (getlist) ou em JSON (lista)."""
    dados = request.data
    if hasattr(dados, 'getlist'):
        valores = dados.getlist(campo)
    else:
        valor = dados.get(campo)
        valores = valor if isinstance(valor, (list, tuple)) else ([] if valor in (None, '') else [valor])
    return [v for v in valores if str(v).strip()]


def _duracao_indicada(valor) -> int:
    """Duração que o browser leu do vídeo (poupa ao servidor descarregá-lo para a saber)."""
    try:
        segundos = int(float(valor))
    except (TypeError, ValueError):
        return 0
    return segundos if 0 < segundos <= 24 * 3600 else 0


def _notificar_seguidores(professor, mensagem: str, link: str):
    """Lançamento (curso/vídeo novo) → quem segue o professor. O email
    respeita o interruptor "Novidades da plataforma". Em segundo plano: com
    muitos seguidores, os emails um a um faziam esperar o professor."""
    executar_depois(_enviar_aos_seguidores, professor.pk, mensagem, link)


def _enviar_aos_seguidores(professor_id: int, mensagem: str, link: str):
    professor = Professor.objects.filter(pk=professor_id).first()
    if not professor:
        return
    for seguidor in professor.seguidores.select_related('utilizador'):
        notificar(
            seguidor.utilizador, 'lancamento', mensagem, link=link,
            categoria_email='novidades', assunto_email=f'Novidade de {professor.nome_publico}',
        )


def _criar_recursos(model_cls, fk_campo, fk_valor, arquivos, envios=(), finalidade=None, professor=None):
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
    for envio_id in envios:
        envio = envio_direto.confirmar(professor, envio_id, finalidade)
        criados.append(model_cls.objects.create(
            **{fk_campo: fk_valor},
            nome=envio.nome,
            tipo='pdf',
            arquivo=envio.chave,
            tamanho_bytes=envio.tamanho_bytes,
        ))
    return criados


# ── ENVIO DIRETO PARA O BUCKET ───────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def professor_envios(request):
    """Link assinado para o browser enviar o ficheiro direto para o B2. Sem bucket
    (desenvolvimento) responde {direto: false} e o ficheiro segue pelo servidor."""
    professor = _get_professor(request)
    if not professor:
        return _professor_required_response()
    if (recusa := _bloqueio_seguranca(professor, request)):
        return recusa
    if not envio_direto.disponivel():
        return Response({'direto': False})
    try:
        tamanho = int(request.data.get('tamanho'))
    except (TypeError, ValueError):
        return Response({'detail': 'Tamanho do ficheiro inválido.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        envio, como = envio_direto.preparar(
            professor,
            str(request.data.get('finalidade') or ''),
            str(request.data.get('nome') or ''),
            tamanho,
            str(request.data.get('tipo') or ''),
        )
    except EnvioInvalido as erro:
        return Response({'detail': str(erro)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({'direto': True, 'id': envio.id, **como}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def professor_envio_concluir(request, envio_id):
    """Fim de um envio em partes: o B2 junta-as num só ficheiro."""
    professor = _get_professor(request)
    if not professor:
        return _professor_required_response()
    try:
        envio_direto.concluir(professor, envio_id, request.data.get('partes'))
    except EnvioInvalido as erro:
        return Response({'detail': str(erro)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({'ok': True})


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

CAPA_MAX_BYTES = 5 * 1024 * 1024


def _capa_valida(ficheiro):
    """Capa que o browser tirou do vídeo (JPEG pequeno); outra coisa é ignorada."""
    if ficheiro and (ficheiro.content_type or '').startswith('image/') and ficheiro.size <= CAPA_MAX_BYTES:
        return ficheiro
    return None


def _criar_videos_curso(professor, curso, arquivos, ordem_inicial=0, envios=(), duracoes=(), capas=None):
    """Cria as aulas (ficheiros enviados pelo servidor ou já no bucket) e devolve os ids,
    para o que faltar (capa, duração) se tratar em segundo plano. `capas` dá a capa de
    cada aula pelo índice (tirada pelo browser)."""
    capas = capas or {}
    for arquivo in arquivos:
        _validar_tamanho_video(arquivo, aula=True)
    ficheiros = list(arquivos) + [envio_direto.confirmar(professor, e, 'aula').chave for e in envios]
    ids = []
    for indice, arquivo in enumerate(ficheiros):
        video = Video.objects.create(
            professor=professor,
            curso=curso,
            categoria=curso.categoria,
            titulo=f'{curso.titulo} — vídeo {ordem_inicial + indice + 1}',
            arquivo=arquivo,
            ativo=True,
            ordem=ordem_inicial + indice,
            uso_ia_lga=curso.uso_ia_lga,
            uso_ia_lga_em=curso.uso_ia_lga_em,
            uso_ia_lga_versao=curso.uso_ia_lga_versao,
            duracao_segundos=duracoes[indice] if indice < len(duracoes) else 0,
            thumbnail=capas.get(indice),
        )
        ids.append(video.id)
        # Sem capa escolhida, o curso fica com a da primeira aula (como fazia o servidor).
        if indice == 0 and video.thumbnail and not curso.thumbnail:
            curso.thumbnail = video.thumbnail.name
            curso.save(update_fields=['thumbnail'])
    return ids


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def professor_cursos(request):
    professor = _get_professor(request)
    if not professor:
        return _professor_required_response()

    if request.method == 'POST':
        if (recusa := _bloqueio_seguranca(professor, request)):
            return recusa
        arquivos = request.FILES.getlist('videos')
        envios_aulas = _lista(request, 'videos_envios')
        if not arquivos and not envios_aulas:
            return Response(
                {'detail': 'Envia pelo menos um vídeo para criar o curso.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ProfessorCursoSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                curso = serializer.save(professor=professor)
                ids_aulas = _criar_videos_curso(
                    professor, curso, arquivos, envios=envios_aulas,
                    duracoes=[_duracao_indicada(d) for d in _lista(request, 'videos_duracoes')],
                    capas={
                        i: capa for i in range(len(arquivos) + len(envios_aulas))
                        if (capa := _capa_valida(request.FILES.get(f'videos_capas_{i}')))
                    },
                )
                _criar_recursos(
                    RecursoCurso, 'curso', curso, request.FILES.getlist('recursos'),
                    envios=_lista(request, 'recursos_envios'), finalidade='recurso_curso', professor=professor,
                )
        except ValueError as erro:
            return Response({'detail': str(erro)}, status=status.HTTP_400_BAD_REQUEST)
        executar_depois(processar_videos, ids_aulas)

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
        if (recusa := _bloqueio_seguranca(professor, request)):
            return recusa
        if request.FILES.getlist('videos') or _lista(request, 'videos_envios'):
            return Response({'detail': MSG_NAO_TROCAR_AULAS}, status=status.HTTP_400_BAD_REQUEST)
        antes = _estado(curso, CAMPOS_CONTEUDO_CURSO)
        serializer = ProfessorCursoSerializer(curso, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        novos_recursos = request.FILES.getlist('recursos')
        novos_envios = _lista(request, 'recursos_envios')
        alterou_consentimento_ia = 'uso_ia_lga' in request.data
        try:
            with transaction.atomic():
                curso = serializer.save()
                if alterou_consentimento_ia:
                    curso.videos.update(
                        uso_ia_lga=curso.uso_ia_lga,
                        uso_ia_lga_em=curso.uso_ia_lga_em,
                        uso_ia_lga_versao=curso.uso_ia_lga_versao,
                    )
                if novos_recursos or novos_envios:
                    _criar_recursos(
                        RecursoCurso, 'curso', curso, novos_recursos,
                        envios=novos_envios, finalidade='recurso_curso', professor=professor,
                    )
        except ValueError as erro:
            return Response({'detail': str(erro)}, status=status.HTTP_400_BAD_REQUEST)

        _marcar_editado(curso, antes, CAMPOS_CONTEUDO_CURSO, houve_ficheiros=bool(novos_recursos or novos_envios))
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
        if (recusa := _bloqueio_seguranca(professor, request)):
            return recusa
        envio_arquivo = request.data.get('arquivo_envio')
        serializer = ProfessorVideoSerializer(
            data=request.data, context={'request': request, 'arquivo_envio': bool(envio_arquivo)},
        )
        serializer.is_valid(raise_exception=True)
        try:
            _validar_tamanho_video(request.FILES.get('arquivo'))
            with transaction.atomic():
                extra = {}
                if envio_arquivo:
                    extra['arquivo'] = envio_direto.confirmar(professor, envio_arquivo, 'video').chave
                if (duracao := _duracao_indicada(request.data.get('duracao_segundos'))):
                    extra['duracao_segundos'] = duracao
                video = serializer.save(professor=professor, **extra)
                _criar_recursos(
                    RecursoVideo, 'video', video, request.FILES.getlist('recursos'),
                    envios=_lista(request, 'recursos_envios'), finalidade='recurso_video', professor=professor,
                )
        except ValueError as erro:
            return Response({'detail': str(erro)}, status=status.HTTP_400_BAD_REQUEST)
        executar_depois(processar_videos, [video.id])
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
        if (recusa := _bloqueio_seguranca(professor, request)):
            return recusa
        url_nova = request.data.get('url_externa')
        troca_link = url_nova is not None and (url_nova or '') != (video.url_externa or '')
        if request.FILES.get('arquivo') or request.data.get('arquivo_envio') or troca_link:
            return Response({'detail': MSG_NAO_TROCAR_VIDEO}, status=status.HTTP_400_BAD_REQUEST)
        antes = _estado(video, CAMPOS_CONTEUDO_VIDEO)
        serializer = ProfessorVideoSerializer(video, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        novos_recursos = request.FILES.getlist('recursos')
        novos_envios = _lista(request, 'recursos_envios')
        try:
            with transaction.atomic():
                video = serializer.save()
                if novos_recursos or novos_envios:
                    _criar_recursos(
                        RecursoVideo, 'video', video, novos_recursos,
                        envios=novos_envios, finalidade='recurso_video', professor=professor,
                    )
        except ValueError as erro:
            return Response({'detail': str(erro)}, status=status.HTTP_400_BAD_REQUEST)
        _marcar_editado(video, antes, CAMPOS_CONTEUDO_VIDEO, houve_ficheiros=bool(novos_recursos or novos_envios))
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
