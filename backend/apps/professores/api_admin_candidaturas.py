"""Fase 2: a equipa EYK analisa as candidaturas a professor e decide.
Aprovar dá as funções de professor; rejeitar e pedir correção dizem sempre porquê."""
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.notificacoes import notificar

from .api_candidatura import candidatura_json
from .candidaturas import TransicaoInvalida, mudar_estado
from .models import CandidaturaProfessor as C
from .models import NotaCandidatura, Professor

PENDENTES = (C.SUBMETIDA, C.EM_ANALISE)
LINK_CANDIDATO = '/inicio'


def _erro(mensagem: str, codigo=status.HTTP_400_BAD_REQUEST):
    return Response({'detail': mensagem}, status=codigo)


def _nome(user) -> str:
    return user.get_display_name() if user else 'Equipa EYK'


def _linha(c: C) -> dict:
    return {
        'id': c.id,
        'nome': c.nome,
        'email': c.email,
        'area': c.area,
        'estado': c.estado,
        'tipoQualificacao': c.tipo_qualificacao or None,
        'submetidaEm': c.submetida_em.isoformat() if c.submetida_em else None,
        'documentos': c.n_documentos,
    }


@api_view(['GET'])
@permission_classes([permissions.IsAdminUser])
def lista(request):
    """Todas as candidaturas com conta criada, com filtros por estado, área e texto."""
    todas = C.objects.filter(user__isnull=False).annotate(n_documentos=Count('documentos'))
    estado = request.query_params.get('estado') or 'pendentes'
    if estado == 'pendentes':
        filtradas = todas.filter(estado__in=PENDENTES)
    elif estado == 'todas':
        filtradas = todas
    else:
        filtradas = todas.filter(estado=estado)
    if area := (request.query_params.get('area') or '').strip():
        filtradas = filtradas.filter(area__iexact=area)
    if q := (request.query_params.get('q') or '').strip():
        filtradas = filtradas.filter(Q(nome__icontains=q) | Q(email__icontains=q) | Q(area__icontains=q))
    # As mais antigas por decidir primeiro: ninguém fica esquecido no fim da fila.
    filtradas = filtradas.order_by('submetida_em', 'criado_em') if estado == 'pendentes' else filtradas.order_by('-criado_em')
    contagens = dict(todas.values_list('estado').annotate(n=Count('id')))
    return Response({
        'candidaturas': [_linha(c) for c in filtradas[:300]],
        'contagens': {**contagens, 'pendentes': sum(contagens.get(e, 0) for e in PENDENTES)},
        'areas': sorted({a for a in todas.exclude(area='').values_list('area', flat=True)}, key=str.lower),
    })


def _detalhe(c: C) -> dict:
    return {
        **candidatura_json(c),
        'id': c.id,
        'userId': c.user_id,
        'criadaEm': c.criado_em.isoformat(),
        'decididaEm': c.decidida_em.isoformat() if c.decidida_em else None,
        'decididaPor': _nome(c.decidida_por) if c.decidida_por else None,
        'historico': [
            {'de': h.de or None, 'para': h.para, 'por': _nome(h.por) if h.por else 'Sistema', 'mensagem': h.mensagem, 'em': h.criado_em.isoformat()}
            for h in c.historico.select_related('por')
        ],
        'notas': [
            {'id': n.id, 'autor': _nome(n.autor), 'texto': n.texto, 'em': n.criado_em.isoformat()}
            for n in c.notas.select_related('autor')
        ],
    }


def _candidatura(candidatura_id) -> C | None:
    return C.objects.select_related('user', 'decidida_por').prefetch_related('documentos').filter(
        pk=candidatura_id, user__isnull=False,
    ).first()


@api_view(['GET'])
@permission_classes([permissions.IsAdminUser])
def detalhe(request, candidatura_id):
    c = _candidatura(candidatura_id)
    if not c:
        return _erro('Candidatura não encontrada.', status.HTTP_404_NOT_FOUND)
    return Response(_detalhe(c))


ACOES = {
    'em_analise': C.EM_ANALISE,
    'aprovar': C.APROVADA,
    'rejeitar': C.REJEITADA,
    'corrigir': C.CORRECAO_PEDIDA,
}


def _avisar(c: C, acao: str, mensagem: str) -> None:
    textos = {
        'em_analise': ('A tua candidatura a professor está em análise pela equipa EYK.', None),
        'aprovar': (
            'A tua candidatura a professor foi aprovada! Já podes criar e publicar cursos e vídeos no Painel.',
            'A tua candidatura a professor foi aprovada',
        ),
        'rejeitar': (
            f'A tua candidatura a professor não foi aprovada. Motivo: {mensagem}',
            'Decisão sobre a tua candidatura a professor',
        ),
        'corrigir': (
            f'A equipa EYK pediu uma correção à tua candidatura a professor: {mensagem}',
            'A tua candidatura a professor precisa de uma correção',
        ),
    }
    texto, assunto = textos[acao]
    notificar(
        c.user, 'novidade', texto, link='/professor' if acao == 'aprovar' else LINK_CANDIDATO,
        categoria_email=None, assunto_email=assunto, enviar_por_email=bool(assunto),
    )


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def decidir(request, candidatura_id):
    c = _candidatura(candidatura_id)
    if not c:
        return _erro('Candidatura não encontrada.', status.HTTP_404_NOT_FOUND)
    acao = request.data.get('acao')
    if acao not in ACOES:
        return _erro('Ação inválida.')
    mensagem = (request.data.get('mensagem') or '').strip()
    if acao == 'rejeitar' and not mensagem:
        return _erro('Indica o motivo da rejeição: o candidato vai recebê-lo.')
    if acao == 'corrigir' and not mensagem:
        return _erro('Diz ao candidato o que deve completar ou corrigir.')
    if len(mensagem) > 2000:
        return _erro('A mensagem tem no máximo 2000 caracteres.')

    with transaction.atomic():
        c = C.objects.select_for_update().get(pk=c.pk)
        try:
            mudar_estado(c, ACOES[acao], request.user, mensagem)
        except TransicaoInvalida:
            return _erro('Esta candidatura já não está à espera desta decisão. Recarrega a página.')
        if acao != 'em_analise':
            c.decidida_em = timezone.now()
            c.decidida_por = request.user
            c.mensagem_decisao = '' if acao == 'aprovar' else mensagem
            c.save(update_fields=['decidida_em', 'decidida_por', 'mensagem_decisao', 'atualizado_em'])
        if acao == 'aprovar':
            user = c.user
            user.is_teacher = True
            user.save(update_fields=['is_teacher'])
            Professor.objects.get_or_create(
                user=user,
                defaults={'nome_publico': c.nome[:150], 'area': c.area, 'bio': c.apresentacao},
            )
    _avisar(c, acao, mensagem)
    return Response(_detalhe(_candidatura(c.pk)))


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def notas(request, candidatura_id):
    """Nota interna (ex: parecer de um especialista externo). O candidato nunca a vê."""
    c = _candidatura(candidatura_id)
    if not c:
        return _erro('Candidatura não encontrada.', status.HTTP_404_NOT_FOUND)
    texto = (request.data.get('texto') or '').strip()
    if not texto:
        return _erro('Escreve a nota.')
    if len(texto) > 4000:
        return _erro('A nota tem no máximo 4000 caracteres.')
    NotaCandidatura.objects.create(candidatura=c, autor=request.user, texto=texto)
    return Response(_detalhe(c), status=status.HTTP_201_CREATED)
