import datetime
import re
import unicodedata

from django.conf import settings
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.cursos.models import Categoria
from apps.instituicoes.armazenamento import servir
from apps.professores.models import Video

from .models import AmostraLGA, Anuncio, ConfiguracaoPlataforma, FonteDatasetLGA, GestoLGA
from .servicos import configuracao, limpar_cache_configuracao
from .tasks import enviar_anuncio, enviar_lembrete_agora

# Sem notícias do beat há mais do que isto (corre de 5 em 5 min) → o painel
# avisa que o worker do Celery está parado.
AGENDADOR_PARADO_APOS = datetime.timedelta(minutes=15)
# Sem Celery (deploy gratuito), o ciclo é chamado de hora a hora pelo
# GitHub Actions (.github/workflows/agendador.yml).
AGENDADOR_EXTERNO_PARADO_APOS = datetime.timedelta(minutes=90)
ANUNCIO_AGENDAR_MAX_DIAS = 90

CAMPOS_NUMERICOS = {
    # campo: (mínimo, máximo)
    'limite_video_mb': (10, 5000),
    'limite_aula_mb': (10, 5000),
    'limite_pdf_mb': (1, 500),
    'denuncias_para_ocultar': (1, 50),
    'avisos_para_suspender': (1, 20),
    'dias_suspensao_automatica': (1, 365),
    'dias_conta_nova': (0, 60),
}


def _config_publica(config: ConfiguracaoPlataforma) -> dict:
    return {
        'aviso': {
            'ativo': config.aviso_ativo and bool(config.aviso_mensagem.strip()),
            'tipo': config.aviso_tipo,
            'mensagem': config.aviso_mensagem,
            # Muda sempre que o aviso é editado — o frontend usa-o para voltar
            # a mostrar um aviso novo a quem fechou o anterior.
            'versao': config.atualizado_em.isoformat() if config.atualizado_em else '',
        },
        'limites': {
            'videoMb': config.limite_video_mb,
            'aulaMb': config.limite_aula_mb,
            'pdfMb': config.limite_pdf_mb,
        },
    }


CAMPOS_EDITAVEIS = [
    *CAMPOS_NUMERICOS, 'aviso_ativo', 'aviso_tipo', 'aviso_mensagem',
    'lembrete_ofensiva_ativo', 'lembrete_ofensiva_hora',
]


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def config_publica(request):
    """Aviso no topo da app + limites de upload. Público (também aparece no login)."""
    return Response(_config_publica(configuracao()))


def _iso(valor):
    return valor.isoformat() if valor else None


def _estado_agendador(config: ConfiguracaoPlataforma) -> dict:
    # Sem broker, as tarefas correm logo no próprio pedido e não há beat: os
    # anúncios saem na hora; os agendados e o lembrete dependem de um
    # agendador externo (GitHub Actions no deploy gratuito).
    imediato = bool(getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False))
    ultimo = config.agendador_ultimo_ciclo
    limite = AGENDADOR_EXTERNO_PARADO_APOS if imediato else AGENDADOR_PARADO_APOS
    return {
        'modo': 'imediato' if imediato else 'celery',
        'ultimoCiclo': _iso(ultimo),
        'ativo': bool(ultimo and timezone.now() - ultimo < limite),
    }


def _config_admin(config: ConfiguracaoPlataforma) -> dict:
    return {
        **{campo: getattr(config, campo) for campo in CAMPOS_NUMERICOS},
        'aviso_ativo': config.aviso_ativo,
        'aviso_tipo': config.aviso_tipo,
        'aviso_mensagem': config.aviso_mensagem,
        'lembrete_ofensiva_ativo': config.lembrete_ofensiva_ativo,
        'lembrete_ofensiva_hora': config.lembrete_ofensiva_hora.strftime('%H:%M'),
        'lembrete_ofensiva_ultimo_envio': _iso(config.lembrete_ofensiva_ultimo_envio),
        'lembrete_ofensiva_ultimo_total': config.lembrete_ofensiva_ultimo_total,
        'agendador': _estado_agendador(config),
        'atualizado_em': _iso(config.atualizado_em),
        'atualizado_por': config.atualizado_por.username if config.atualizado_por else None,
    }


@api_view(['GET', 'PATCH'])
@permission_classes([permissions.IsAdminUser])
def admin_config(request):
    config, _ = ConfiguracaoPlataforma.objects.get_or_create(pk=1)
    if request.method == 'PATCH':
        for campo, (minimo, maximo) in CAMPOS_NUMERICOS.items():
            if campo not in request.data:
                continue
            try:
                valor = int(request.data[campo])
            except (TypeError, ValueError):
                return Response({'detail': f'Valor inválido em "{campo}".'}, status=status.HTTP_400_BAD_REQUEST)
            if not minimo <= valor <= maximo:
                return Response(
                    {'detail': f'"{campo}" tem de estar entre {minimo} e {maximo}.'}, status=status.HTTP_400_BAD_REQUEST,
                )
            setattr(config, campo, valor)
        if 'aviso_ativo' in request.data:
            config.aviso_ativo = bool(request.data['aviso_ativo'])
        if 'aviso_tipo' in request.data:
            if request.data['aviso_tipo'] not in dict(ConfiguracaoPlataforma.AVISO_TIPOS):
                return Response({'detail': 'Tipo de aviso inválido.'}, status=status.HTTP_400_BAD_REQUEST)
            config.aviso_tipo = request.data['aviso_tipo']
        if 'aviso_mensagem' in request.data:
            config.aviso_mensagem = (request.data['aviso_mensagem'] or '').strip()[:300]
        if config.aviso_ativo and not config.aviso_mensagem:
            return Response({'detail': 'Escreve a mensagem do aviso.'}, status=status.HTTP_400_BAD_REQUEST)
        if 'lembrete_ofensiva_ativo' in request.data:
            config.lembrete_ofensiva_ativo = bool(request.data['lembrete_ofensiva_ativo'])
        if 'lembrete_ofensiva_hora' in request.data:
            try:
                config.lembrete_ofensiva_hora = datetime.time.fromisoformat(str(request.data['lembrete_ofensiva_hora']))
            except ValueError:
                return Response({'detail': 'Hora do lembrete inválida (ex: 18:00).'}, status=status.HTTP_400_BAD_REQUEST)
        config.atualizado_por = request.user
        # Só os campos editáveis: o estado do agendador é escrito pelo worker
        # ao mesmo tempo e não pode ser reposto com valores antigos.
        config.save(update_fields=[*CAMPOS_EDITAVEIS, 'atualizado_por', 'atualizado_em'])
        limpar_cache_configuracao()
    return Response(_config_admin(config))


# ── Anúncios ─────────────────────────────────────────────────────────────────

def _anuncio(a: Anuncio) -> dict:
    return {
        'id': a.id,
        'titulo': a.titulo,
        'mensagem': a.mensagem,
        'link': a.link,
        'enviarEmail': a.enviar_email,
        'estado': a.estado,
        'estadoLabel': a.get_estado_display(),
        'agendadoPara': _iso(a.agendado_para),
        'autor': a.autor.get_display_name() if a.autor else None,
        'totalDestinatarios': a.total_destinatarios,
        'totalEmails': a.total_emails,
        'criadoEm': a.criado_em.isoformat(),
        'enviadoEm': _iso(a.enviado_em),
    }


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAdminUser])
def admin_anuncios(request):
    """POST `{titulo, mensagem, link, enviar_email, agendado_para?}`:
    notificação "Novidade" para todos os utilizadores ativos e, se pedido,
    email para quem tem "Novidades da plataforma" ligado. O envio corre em
    segundo plano (Celery) — já, ou à hora de `agendado_para` (ISO 8601)."""
    if request.method == 'GET':
        return Response([_anuncio(a) for a in Anuncio.objects.select_related('autor')[:50]])

    titulo = (request.data.get('titulo') or '').strip()[:150]
    mensagem = (request.data.get('mensagem') or '').strip()
    link = (request.data.get('link') or '').strip()[:255]
    if not titulo or not mensagem:
        return Response({'detail': 'Escreve o título e a mensagem.'}, status=status.HTTP_400_BAD_REQUEST)
    if link and not link.startswith('/'):
        return Response(
            {'detail': 'O link tem de ser uma página da plataforma (ex: /cursos/3).'}, status=status.HTTP_400_BAD_REQUEST,
        )

    agendado_para = None
    if request.data.get('agendado_para'):
        agendado_para = parse_datetime(str(request.data['agendado_para']))
        if agendado_para is None or timezone.is_naive(agendado_para):
            return Response({'detail': 'Data de agendamento inválida.'}, status=status.HTTP_400_BAD_REQUEST)
        agora = timezone.now()
        if agendado_para <= agora:
            return Response({'detail': 'A data de agendamento já passou.'}, status=status.HTTP_400_BAD_REQUEST)
        if agendado_para > agora + datetime.timedelta(days=ANUNCIO_AGENDAR_MAX_DIAS):
            return Response(
                {'detail': f'Só dá para agendar até {ANUNCIO_AGENDAR_MAX_DIAS} dias.'}, status=status.HTTP_400_BAD_REQUEST,
            )

    anuncio = Anuncio.objects.create(
        titulo=titulo, mensagem=mensagem, link=link, autor=request.user,
        enviar_email=bool(request.data.get('enviar_email')),
        agendado_para=agendado_para, estado='agendado' if agendado_para else 'pendente',
    )
    if not agendado_para:
        enviar_anuncio.delay(anuncio.id)
        anuncio.refresh_from_db()
    return Response(_anuncio(anuncio), status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([permissions.IsAdminUser])
def admin_anuncio_cancelar(request, pk):
    """Cancela um anúncio agendado (antes de sair)."""
    apagados, _ = Anuncio.objects.filter(pk=pk, estado='agendado').delete()
    if not apagados:
        return Response({'detail': 'Este anúncio já foi enviado ou está a ser enviado.'}, status=status.HTTP_409_CONFLICT)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def admin_lembrete_ofensiva_enviar(request):
    """Envia já o lembrete de ofensiva (conta como o envio de hoje)."""
    enviar_lembrete_agora()
    return Response(_config_admin(ConfiguracaoPlataforma.objects.get(pk=1)), status=status.HTTP_202_ACCEPTED)


# ── Categorias de cursos ─────────────────────────────────────────────────────

def _categorias():
    return [
        {'id': c.id, 'nome': c.nome, 'totalCursos': c.total_cursos}
        for c in Categoria.objects.annotate(total_cursos=Count('curso')).order_by('nome')
    ]


def _nome_valido(nome: str, exceto_id=None):
    if not nome:
        return 'Indica o nome da categoria.'
    if len(nome) > 100:
        return 'O nome pode ter no máximo 100 caracteres.'
    qs = Categoria.objects.filter(nome__iexact=nome)
    if exceto_id:
        qs = qs.exclude(pk=exceto_id)
    if qs.exists():
        return 'Já existe uma categoria com esse nome.'
    return None


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAdminUser])
def admin_categorias(request):
    if request.method == 'POST':
        nome = (request.data.get('nome') or '').strip()
        erro = _nome_valido(nome)
        if erro:
            return Response({'detail': erro}, status=status.HTTP_400_BAD_REQUEST)
        Categoria.objects.create(nome=nome)
        return Response(_categorias(), status=status.HTTP_201_CREATED)
    return Response(_categorias())


@api_view(['PATCH', 'DELETE'])
@permission_classes([permissions.IsAdminUser])
def admin_categoria_detail(request, pk):
    categoria = get_object_or_404(Categoria, pk=pk)
    if request.method == 'DELETE':
        # Curso.categoria é SET_NULL: os cursos ficam "sem categoria".
        categoria.delete()
        return Response(_categorias())
    nome = (request.data.get('nome') or '').strip()
    erro = _nome_valido(nome, exceto_id=categoria.id)
    if erro:
        return Response({'detail': erro}, status=status.HTTP_400_BAD_REQUEST)
    categoria.nome = nome
    categoria.save(update_fields=['nome'])
    return Response(_categorias())


# ── Gestos de LGA ────────────────────────────────────────────────────────────

GESTO_TAMANHO_MAX = 20 * 1024 * 1024  # vídeo curto em loop


def _gesto_json(gesto: GestoLGA) -> dict:
    return {
        'id': gesto.id,
        'palavra': gesto.palavra,
        'video': gesto.video.url if gesto.video else None,
        'validado': gesto.validado,
        'validado_por': gesto.validado_por,
    }


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def gestos_publicos(request):
    """Gestos validados, por palavra (a app mostra-os junto ao texto)."""
    gestos = GestoLGA.objects.filter(validado=True).exclude(video='')
    return Response({g.palavra: g.video.url for g in gestos})


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAdminUser])
def admin_gestos(request):
    if request.method == 'GET':
        return Response([_gesto_json(g) for g in GestoLGA.objects.all()])
    palavra = (request.data.get('palavra') or '').strip()
    video = request.FILES.get('video')
    if not palavra or not video:
        return Response({'detail': 'Indica a palavra e o vídeo do gesto.'}, status=status.HTTP_400_BAD_REQUEST)
    if not (video.content_type or '').startswith('video/'):
        return Response({'detail': 'O gesto tem de ser um vídeo (MP4 ou WebM).'}, status=status.HTTP_400_BAD_REQUEST)
    if video.size > GESTO_TAMANHO_MAX:
        return Response({'detail': 'O vídeo do gesto pode ter no máximo 20MB.'}, status=status.HTTP_400_BAD_REQUEST)
    gesto, _ = GestoLGA.objects.update_or_create(
        palavra=palavra,
        defaults={
            'video': video,
            'validado': str(request.data.get('validado', '')).lower() in ('1', 'true', 'on'),
            'validado_por': (request.data.get('validado_por') or '').strip()[:120],
        },
    )
    return Response(_gesto_json(gesto), status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@permission_classes([permissions.IsAdminUser])
def admin_gesto(request, pk):
    gesto = get_object_or_404(GestoLGA, pk=pk)
    if request.method == 'DELETE':
        gesto.video.delete(save=False)
        gesto.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if 'validado' in request.data:
        gesto.validado = bool(request.data.get('validado'))
    if 'validado_por' in request.data:
        gesto.validado_por = (request.data.get('validado_por') or '').strip()[:120]
    gesto.save()
    return Response(_gesto_json(gesto))


# ── Recolha voluntária de amostras para investigação de LGA ─────────────────

AMOSTRA_LGA_CONSENTIMENTO_VERSAO = 'lga-ia-v1'
AMOSTRA_LGA_TAMANHO_MAX = 40 * 1024 * 1024
AMOSTRA_LGA_PALAVRAS = [
    'Olá', 'Obrigado', 'Sim', 'Não', 'Água', 'Comida', 'Casa', 'Família',
    'Amigo', 'Escola', 'Professor', 'Aprender', 'Livro', 'Trabalho', 'Ajuda',
]
_EXTENSOES_VIDEO_LGA = {'.mp4', '.webm', '.mov', '.m4v'}


def _amostra_json(amostra, incluir_autor=False):
    resultado = {
        'id': amostra.id,
        'palavra': amostra.palavra,
        'variante': amostra.variante,
        'estado': amostra.estado,
        'estadoLabel': amostra.get_estado_display(),
        'criadoEm': amostra.criado_em.isoformat(),
        'notaRevisao': amostra.nota_revisao,
    }
    if incluir_autor:
        resultado.update({
            'autor': amostra.autor.get_username(),
            'consentimentoVersao': amostra.consentimento_versao,
            'consentidoEm': amostra.consentido_em.isoformat(),
            'representanteConfirmado': amostra.confirmacao_representante,
        })
    return resultado


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def amostras_lga(request):
    """O utilizador vê as suas amostras e pode enviar uma contribuição explícita."""
    if request.method == 'GET':
        from django.db.models import Count

        contagens = dict(
            AmostraLGA.objects.filter(estado='validada')
            .values_list('palavra').annotate(total=Count('id'))
        )
        return Response({
            'versaoConsentimento': AMOSTRA_LGA_CONSENTIMENTO_VERSAO,
            'palavras': [{'nome': p, 'amostrasValidadas': contagens.get(p, 0)} for p in AMOSTRA_LGA_PALAVRAS],
            'amostras': [_amostra_json(a) for a in AmostraLGA.objects.filter(autor=request.user)],
        })

    video = request.FILES.get('video')
    palavra = (request.data.get('palavra') or '').strip()
    variante = (request.data.get('variante') or '').strip()[:80]
    consentido = str(request.data.get('consentimento') or '').lower() in ('1', 'true', 'on', 'yes')
    representante = str(request.data.get('representante_confirmado') or '').lower() in ('1', 'true', 'on', 'yes')
    versao = (request.data.get('consentimento_versao') or '').strip()
    if palavra not in AMOSTRA_LGA_PALAVRAS:
        return Response({'detail': 'Escolhe uma palavra da lista de recolha.'}, status=status.HTTP_400_BAD_REQUEST)
    if not video:
        return Response({'detail': 'Grava ou escolhe um vídeo antes de enviar.'}, status=status.HTTP_400_BAD_REQUEST)
    nome = (video.name or '').lower()
    extensao = '.' + nome.rsplit('.', 1)[-1] if '.' in nome else ''
    if extensao not in _EXTENSOES_VIDEO_LGA or not (video.content_type or '').startswith('video/'):
        return Response({'detail': 'Usa um vídeo MP4, WebM ou MOV.'}, status=status.HTTP_400_BAD_REQUEST)
    if video.size > AMOSTRA_LGA_TAMANHO_MAX:
        return Response({'detail': 'O vídeo pode ter no máximo 40 MB.'}, status=status.HTTP_400_BAD_REQUEST)
    if not consentido or versao != AMOSTRA_LGA_CONSENTIMENTO_VERSAO:
        return Response({'detail': 'É necessário confirmar o consentimento informado antes do envio.'}, status=status.HTTP_400_BAD_REQUEST)
    if not representante:
        return Response({'detail': 'Confirma que és maior de idade ou que tens autorização do responsável legal.'}, status=status.HTTP_400_BAD_REQUEST)
    amostra = AmostraLGA.objects.create(
        autor=request.user,
        palavra=palavra,
        variante=variante,
        video=video,
        consentimento_versao=versao,
        consentido_em=timezone.now(),
        confirmacao_representante=representante,
    )
    return Response(_amostra_json(amostra), status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def amostra_lga_detail(request, pk):
    amostra = get_object_or_404(AmostraLGA, pk=pk, autor=request.user)
    amostra.video.delete(save=False)
    amostra.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([permissions.IsAdminUser])
def admin_amostras_lga(request):
    amostras = AmostraLGA.objects.select_related('autor', 'revisto_por').all()[:300]
    return Response([_amostra_json(a, incluir_autor=True) for a in amostras])


@api_view(['PATCH', 'GET'])
@permission_classes([permissions.IsAdminUser])
def admin_amostra_lga_detail(request, pk):
    amostra = get_object_or_404(AmostraLGA.objects.select_related('autor'), pk=pk)
    if request.method == 'GET':
        return servir(request, amostra.video, amostra.video.name)
    estado = request.data.get('estado')
    if estado not in {'validada', 'rejeitada', 'pendente'}:
        return Response({'detail': 'Estado de revisão inválido.'}, status=status.HTTP_400_BAD_REQUEST)
    amostra.estado = estado
    amostra.nota_revisao = (request.data.get('notaRevisao') or '').strip()[:500]
    amostra.revisto_por = request.user
    amostra.revisto_em = timezone.now()
    amostra.save(update_fields=['estado', 'nota_revisao', 'revisto_por', 'revisto_em'])
    return Response(_amostra_json(amostra, incluir_autor=True))


_TERMOS_RELEVANTES_LGA = (
    r'\blingua gestual angolana\b', r'\blingua gestual\b', r'\blga\b',
    r'\bgestos?\b', r'\balfabeto manual\b', r'\bcomunicacao gestual\b', r'\bsinais em angola\b',
)


def _normalizar_busca(texto):
    return ''.join(
        letra for letra in unicodedata.normalize('NFKD', texto.lower())
        if not unicodedata.combining(letra)
    )


def _pontuar_fonte_lga(video):
    curso = video.curso
    texto = ' '.join([
        video.titulo, video.descricao,
        curso.titulo if curso else '', curso.descricao if curso else '',
        curso.categoria.nome if curso and curso.categoria else '',
    ])
    texto = _normalizar_busca(texto)
    encontrados = [termo for termo in _TERMOS_RELEVANTES_LGA if re.search(_normalizar_busca(termo), texto)]
    motivos = []
    pontuacao = 0
    if encontrados:
        pontuacao += min(6, len(encontrados) * 3)
        motivos.append('O título ou a descrição menciona LGA, língua gestual ou gestos.')
    if curso:
        pontuacao += 2
        motivos.append('Faz parte de um curso com aulas organizadas.')
    if video.legenda:
        pontuacao += 2
        motivos.append('Tem legenda, o que ajuda a confirmar o rótulo e o contexto.')
    if 1 <= video.duracao_segundos <= 180:
        pontuacao += 2
        motivos.append('Tem duração adequada para rever um gesto ou sequência curta.')
    elif 180 < video.duracao_segundos <= 900:
        pontuacao += 1
        motivos.append('A duração permite selecionar segmentos úteis do vídeo.')
    likes = video.total_likes()
    visualizacoes = sum(v.count for v in video.visualizacoes.all())
    if likes >= 3:
        bonus_likes = min(2, likes // 3)
        pontuacao += bonus_likes
        motivos.append('Tem boa adesão dos utilizadores.')
    if visualizacoes >= 100:
        pontuacao += 2
        motivos.append('Tem muitas visualizações na plataforma.')
    elif visualizacoes >= 20:
        pontuacao += 1
        motivos.append('Já foi consultado por vários utilizadores.')
    return pontuacao, motivos, bool(encontrados)


def _sincronizar_fontes_dataset_lga():
    elegiveis = (
        Video.objects.filter(
            Q(uso_ia_lga=True) | Q(curso__uso_ia_lga=True),
            ativo=True,
            oculto=False,
            professor__ativo=True,
        )
        .filter(Q(curso__isnull=True) | Q(curso__ativo=True, curso__oculto=False))
        .exclude(arquivo='')
        .select_related('curso', 'curso__categoria', 'professor')
        .prefetch_related('reacoes', 'visualizacoes')
    )
    vistos = []
    for video in elegiveis:
        pontuacao, motivos, relevante = _pontuar_fonte_lga(video)
        if not relevante:
            continue
        vistos.append(video.id)
        fonte, criada = FonteDatasetLGA.objects.get_or_create(
            video=video,
            defaults={'pontuacao': pontuacao, 'motivos': motivos},
        )
        if not criada:
            atualizacoes = []
            if fonte.pontuacao != pontuacao:
                fonte.pontuacao = pontuacao
                atualizacoes.append('pontuacao')
            if fonte.motivos != motivos:
                fonte.motivos = motivos
                atualizacoes.append('motivos')
            if fonte.estado == 'retirada':
                fonte.estado = 'sugerida'
                atualizacoes.append('estado')
            if atualizacoes:
                fonte.save(update_fields=[*atualizacoes, 'atualizado_em'])

    if vistos:
        fontes_ativas = FonteDatasetLGA.objects.filter(estado__in=['sugerida', 'aprovada', 'rejeitada']).exclude(video_id__in=vistos)
        fontes_ativas.update(estado='retirada', nota_revisao='A autorização foi retirada ou o conteúdo deixou de estar publicado/elegível.')
    else:
        FonteDatasetLGA.objects.filter(estado__in=['sugerida', 'aprovada', 'rejeitada']).update(
            estado='retirada', nota_revisao='A autorização foi retirada ou o conteúdo deixou de estar publicado/elegível.',
        )


def _fonte_dataset_json(fonte):
    video = fonte.video
    return {
        'id': fonte.id,
        'videoId': video.id,
        'titulo': video.titulo,
        'descricao': video.descricao,
        'professor': video.professor.nome_publico,
        'curso': video.curso.titulo if video.curso else None,
        'duracaoSegundos': video.duracao_segundos,
        'videoUrl': video.arquivo.url if video.arquivo else None,
        'temLegenda': bool(video.legenda),
        'pontuacao': fonte.pontuacao,
        'motivos': fonte.motivos,
        'estado': fonte.estado,
        'palavra': fonte.palavra,
        'inicioSegundos': fonte.inicio_segundos,
        'fimSegundos': fonte.fim_segundos,
        'notaRevisao': fonte.nota_revisao,
        'consentimentoEm': (video.curso.uso_ia_lga_em if video.curso and video.curso.uso_ia_lga else video.uso_ia_lga_em).isoformat(),
        'consentimentoVersao': video.curso.uso_ia_lga_versao if video.curso and video.curso.uso_ia_lga else video.uso_ia_lga_versao,
    }


def _fonte_pode_ser_usada(video):
    autorizado = video.uso_ia_lga or bool(video.curso and video.curso.uso_ia_lga)
    curso_publico = not video.curso or (video.curso.ativo and not video.curso.oculto)
    return bool(autorizado and video.ativo and not video.oculto and video.professor.ativo and curso_publico and video.arquivo)


@api_view(['GET'])
@permission_classes([permissions.IsAdminUser])
def admin_fontes_dataset_lga(request):
    """Sugere conteúdos consentidos e publicados; a revisão humana decide o que entra."""
    _sincronizar_fontes_dataset_lga()
    fontes = FonteDatasetLGA.objects.select_related(
        'video', 'video__professor', 'video__curso', 'video__curso__categoria',
    ).filter(estado__in=['sugerida', 'aprovada']).order_by('-pontuacao', '-atualizado_em')[:200]
    return Response([_fonte_dataset_json(f) for f in fontes])


@api_view(['PATCH'])
@permission_classes([permissions.IsAdminUser])
def admin_fonte_dataset_lga_detail(request, pk):
    fonte = get_object_or_404(
        FonteDatasetLGA.objects.select_related('video', 'video__curso', 'video__professor'), pk=pk,
    )
    estado = request.data.get('estado')
    if estado not in {'aprovada', 'rejeitada'}:
        return Response({'detail': 'Escolhe aprovar ou rejeitar a fonte.'}, status=status.HTTP_400_BAD_REQUEST)
    if estado == 'aprovada':
        if not _fonte_pode_ser_usada(fonte.video):
            fonte.estado = 'retirada'
            fonte.nota_revisao = 'O professor retirou a autorização ou o conteúdo deixou de estar publicado/elegível.'
            fonte.save(update_fields=['estado', 'nota_revisao', 'atualizado_em'])
            return Response({'detail': 'A autorização ou a publicação deste conteúdo já não está ativa.'}, status=status.HTTP_409_CONFLICT)
        palavra = (request.data.get('palavra') or '').strip()[:60]
        if not palavra:
            return Response({'detail': 'Indica a palavra ou o gesto visível no vídeo.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            inicio = int(request.data['inicioSegundos']) if request.data.get('inicioSegundos') not in (None, '') else None
            fim = int(request.data['fimSegundos']) if request.data.get('fimSegundos') not in (None, '') else None
        except (TypeError, ValueError):
            return Response({'detail': 'O início e o fim têm de ser números de segundos.'}, status=status.HTTP_400_BAD_REQUEST)
        if (inicio is None) != (fim is None) or (inicio is not None and (inicio < 0 or fim <= inicio or fim > fonte.video.duracao_segundos)):
            return Response({'detail': 'Indica um intervalo completo dentro da duração do vídeo, ou deixa ambos vazios.'}, status=status.HTTP_400_BAD_REQUEST)
        fonte.palavra = palavra
        fonte.inicio_segundos = inicio
        fonte.fim_segundos = fim
    fonte.estado = estado
    fonte.nota_revisao = (request.data.get('notaRevisao') or '').strip()[:500]
    fonte.revisto_por = request.user
    fonte.save()
    return Response(_fonte_dataset_json(fonte))
