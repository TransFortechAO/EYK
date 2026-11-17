"""Fase 3: código de conduta e autorização para ensinar crianças e adolescentes."""
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.notificacoes import notificar
from apps.instituicoes.armazenamento import categoria_de, servir

from . import conduta as codigo
from .models import AutorizacaoMenores, Professor
from .seguranca import despublicar_para_criancas

MAX_MB = 50


def _erro(mensagem: str, codigo_http=status.HTTP_400_BAD_REQUEST):
    return Response({'detail': mensagem}, status=codigo_http)


def _professor(request) -> Professor | None:
    return Professor.objects.filter(user=request.user, ativo=True).first()


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def conduta(request):
    """O texto do código (para todos) e, para professores, aceitá-lo."""
    if request.method == 'GET':
        prof = _professor(request)
        return Response({**codigo.texto(), 'aceite': bool(prof and prof.conduta_versao == codigo.VERSAO)})
    prof = _professor(request)
    if not prof:
        return _erro('Só os professores aceitam o código de conduta aqui.', status.HTTP_403_FORBIDDEN)
    prof.conduta_versao = codigo.VERSAO
    prof.conduta_aceite_em = timezone.now()
    prof.save(update_fields=['conduta_versao', 'conduta_aceite_em'])
    return Response({**codigo.texto(), 'aceite': True})


def _autorizacao_json(a: AutorizacaoMenores | None) -> dict:
    if not a:
        return {'estado': AutorizacaoMenores.NAO_PEDIDA, 'formacao': '', 'documento': None, 'motivo': None, 'pedidaEm': None}
    return {
        'estado': a.estado,
        'formacao': a.formacao,
        'documento': a.nome_documento or None,
        'motivo': a.motivo or None,
        'pedidaEm': a.pedida_em.isoformat() if a.pedida_em else None,
    }


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, JSONParser])
def minha_autorizacao(request):
    """O professor pede a autorização para ensinar crianças e adolescentes."""
    prof = _professor(request)
    if not prof:
        return _erro('Só os professores aprovados pedem esta autorização.', status.HTTP_403_FORBIDDEN)
    atual = AutorizacaoMenores.objects.filter(professor=prof).first()
    if request.method == 'GET':
        return Response(_autorizacao_json(atual))

    if atual and atual.estado in (AutorizacaoMenores.PEDIDA, AutorizacaoMenores.AUTORIZADA):
        return _erro('O teu pedido já está feito.')
    formacao = (request.data.get('formacao') or '').strip()
    documento = request.FILES.get('documento')
    if len(formacao) < 20:
        return _erro('Descreve a tua formação ou experiência em proteção de crianças (pelo menos uma frase).')
    if not documento and not (atual and atual.documento):
        return _erro('Junta o registo criminal ou uma declaração equivalente.')
    if documento:
        if categoria_de(documento.name) not in ('documento', 'imagem'):
            return _erro('Junta um PDF, documento ou imagem.')
        if documento.size > MAX_MB * 1024 * 1024:
            return _erro(f'O documento pode ter até {MAX_MB} MB.')
    if str(request.data.get('declaracao')).lower() not in ('true', '1', 'on'):
        return _erro('Confirma a declaração de que cumpres as regras de proteção de menores.')
    a = atual or AutorizacaoMenores(professor=prof)
    a.formacao = formacao[:4000]
    if documento:
        if a.documento:
            a.documento.delete(save=False)
        a.documento = documento
        a.nome_documento = documento.name[:255]
    a.declaracao_aceite_em = timezone.now()
    a.pedida_em = timezone.now()
    a.estado = AutorizacaoMenores.PEDIDA
    a.motivo = ''
    a.save()
    from django.contrib.auth import get_user_model

    for conta in get_user_model().objects.filter(is_staff=True, is_active=True):
        notificar(
            conta, 'novidade', f'Pedido de autorização para ensinar menores: {prof.nome_publico}.',
            link='/configuracoes/administracao/candidaturas', enviar_por_email=False,
        )
    return Response(_autorizacao_json(a), status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAdminUser])
def admin_autorizacoes(request):
    estado = request.query_params.get('estado') or AutorizacaoMenores.PEDIDA
    lista = AutorizacaoMenores.objects.select_related('professor__user').exclude(estado=AutorizacaoMenores.NAO_PEDIDA)
    if estado != 'todas':
        lista = lista.filter(estado=estado)
    return Response([
        {
            'id': a.id,
            'professor': a.professor.nome_publico,
            'email': a.professor.user.email,
            'area': a.professor.area,
            **_autorizacao_json(a),
            'documentoUrl': f'/api/admin/autorizacoes-menores/{a.id}/documento/' if a.documento else None,
        }
        for a in lista.order_by('pedida_em')
    ])


@api_view(['GET'])
@permission_classes([permissions.IsAdminUser])
def admin_autorizacao_documento(request, autorizacao_id):
    a = AutorizacaoMenores.objects.filter(pk=autorizacao_id).first()
    if not a or not a.documento:
        return _erro('Documento não encontrado.', status.HTTP_404_NOT_FOUND)
    return servir(request, a.documento, a.nome_documento or 'documento')


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def admin_autorizacao_decidir(request, autorizacao_id):
    a = AutorizacaoMenores.objects.select_related('professor__user').filter(pk=autorizacao_id).first()
    if not a:
        return _erro('Pedido não encontrado.', status.HTTP_404_NOT_FOUND)
    acao = request.data.get('acao')
    motivo = (request.data.get('motivo') or '').strip()
    passagens = {
        'autorizar': (AutorizacaoMenores.PEDIDA, AutorizacaoMenores.AUTORIZADA),
        'recusar': (AutorizacaoMenores.PEDIDA, AutorizacaoMenores.RECUSADA),
        'retirar': (AutorizacaoMenores.AUTORIZADA, AutorizacaoMenores.RETIRADA),
    }
    if acao not in passagens:
        return _erro('Ação inválida.')
    de, para = passagens[acao]
    if a.estado != de:
        return _erro('Este pedido já não está à espera desta decisão. Recarrega a página.')
    if acao in ('recusar', 'retirar') and not motivo:
        return _erro('Indica o motivo: o professor vai recebê-lo.')
    a.estado, a.motivo = para, motivo
    a.decidida_em, a.decidida_por = timezone.now(), request.user
    a.save(update_fields=['estado', 'motivo', 'decidida_em', 'decidida_por'])
    despublicados = despublicar_para_criancas(a.professor) if acao == 'retirar' else 0
    textos = {
        'autorizar': 'Já podes marcar cursos e vídeos como "Para crianças e adolescentes".',
        'recusar': f'O teu pedido de autorização para ensinar menores foi recusado. Motivo: {motivo}',
        'retirar': f'A tua autorização para ensinar menores foi retirada ({despublicados} conteúdo(s) despublicado(s)). Motivo: {motivo}',
    }
    notificar(
        a.professor.user, 'novidade', textos[acao], link='/professor',
        categoria_email=None, assunto_email='Autorização para ensinar crianças e adolescentes',
    )
    return Response({**_autorizacao_json(a), 'despublicados': despublicados})
