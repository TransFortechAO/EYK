import datetime

from django.conf import settings
from django.db.models import Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.cursos.models import Categoria

from .models import Anuncio, ConfiguracaoPlataforma
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
        'limites': {'videoMb': config.limite_video_mb, 'pdfMb': config.limite_pdf_mb},
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
