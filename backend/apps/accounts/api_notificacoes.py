from datetime import datetime
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Notificacao


TIPO_MAP_FRONTEND = {
    'conquista': 'gamification',
    'lancamento': 'course',
    'novidade': 'community',
    'saque': 'system',
}

TIPO_TITLE = {
    'novidade': 'Novidade',
    'conquista': 'Conquista',
    'saque': 'Saque',
    'lancamento': 'Novo Lançamento',
}


def _time_ago(criado_em: datetime) -> str:
    now = timezone.now()
    delta = now - criado_em
    total_seconds = int(delta.total_seconds())

    if total_seconds < 60:
        return 'agora'
    if total_seconds < 3600:
        mins = total_seconds // 60
        return f'Há {mins} min'
    if total_seconds < 86400:
        horas = total_seconds // 3600
        return f'Há {horas} h'
    dias = delta.days
    if dias == 1:
        return 'Ontem'
    if dias < 7:
        return f'Há {dias} dias'
    return criado_em.strftime('%d/%m/%Y')


def _build_notificacao_dict(n: Notificacao) -> dict:
    tipo_frontend = TIPO_MAP_FRONTEND.get(n.tipo, 'novidade')
    mensagem_linhas = n.mensagem.strip().splitlines() if n.mensagem else []
    title = mensagem_linhas[0] if mensagem_linhas else TIPO_TITLE.get(n.tipo, 'Notificação')
    body = n.mensagem
    return {
        'id': n.id,
        'type': tipo_frontend,
        'title': title,
        'body': body,
        'timeAgo': _time_ago(n.criado_em),
        'read': n.lida,
    }


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def notificacao_list(request):
    notificacoes = Notificacao.objects.filter(utilizador=request.user)
    dados = [_build_notificacao_dict(n) for n in notificacoes]
    return Response(dados)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def notificacao_marcar_lida(request, pk):
    try:
        n = Notificacao.objects.get(pk=pk, utilizador=request.user)
    except Notificacao.DoesNotExist:
        return Response({'ok': False, 'detail': 'Notificação não encontrada.'}, status=status.HTTP_404_NOT_FOUND)

    n.lida = True
    n.save(update_fields=['lida'])
    return Response({'ok': True, 'read': True})
