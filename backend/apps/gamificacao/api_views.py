from datetime import datetime, timedelta
from django.db.models import OuterRef, Subquery, Sum, Value, IntegerField, CharField, F
from django.utils import timezone
from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.models import User
from .models import AlunoBadge, Badge, Carteira, TransacaoMoeda, Ofensiva
from .services import nivel_info, progresso_badges, verificar_badges


MOTIVO_LABEL = {
    'curso_concluido': 'Curso concluído',
    'streak_mensal': 'Streak de 30 dias',
    'indicacao_amigo': 'Amigo indicado',
    'views_professor': 'Visualizações',
    'ajuste_admin': 'Ajuste do administrador',
}


def _get_initials(user: User) -> str:
    full = (user.get_full_name() or user.username or 'U').strip()
    parts = full.split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[-1][0]).upper()
    return full[:2].upper()


def _get_name(user: User) -> str:
    return user.get_display_name()


def _format_date_transacao(criado_em: datetime) -> str:
    now = timezone.now().date()
    data = criado_em.date()
    time_str = criado_em.strftime('%H:%M')

    if data == now:
        return f'Hoje, {time_str}'
    if data == now - timedelta(days=1):
        return f'Ontem, {time_str}'
    return criado_em.strftime('%d/%m')


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def gamificacao_painel(request):
    user = request.user

    try:
        carteira = user.carteira
        coins = carteira.saldo
        xp = carteira.xp
    except Carteira.DoesNotExist:
        coins = 0
        xp = 0

    try:
        ofensiva = user.ofensiva
        streak = ofensiva.dias_atual
        streak_record = ofensiva.maior_sequencia
    except Ofensiva.DoesNotExist:
        streak = 0
        streak_record = 0

    nivel = nivel_info(xp)

    data = {
        'coins': coins,
        'xp': xp,
        'streak': streak,
        'streakRecord': streak_record,
        'level': nivel['nivel'],
        'levelProgress': nivel['levelProgress'],
        'nextLevelXp': nivel['nextLevelXp'],
        'initials': _get_initials(user),
        'name': _get_name(user),
    }
    return Response(data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def leaderboard_list(request):
    carteira_saldo = Carteira.objects.filter(utilizador=OuterRef('pk')).values('saldo')
    ofensiva_dias = Ofensiva.objects.filter(utilizador=OuterRef('pk')).values('dias_atual')

    users = User.objects.annotate(
        _coins=Subquery(carteira_saldo, output_field=IntegerField()),
        _streak=Subquery(ofensiva_dias, output_field=IntegerField()),
    ).order_by(F('_coins').desc(nulls_last=True), F('_streak').desc(nulls_last=True))[:20]

    resultado = []
    for idx, u in enumerate(users, start=1):
        coins = u._coins if u._coins is not None else 0
        streak = u._streak if u._streak is not None else 0
        resultado.append({
            'rank': idx,
            'userId': u.id,
            'name': _get_name(u),
            'initials': _get_initials(u),
            'coins': coins,
            'streak': streak,
            'isMe': u.id == request.user.id,
        })
    return Response(resultado)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def badges_list(request):
    user = request.user
    verificar_badges(user)
    progresso = progresso_badges(user)
    desbloqueados = set(AlunoBadge.objects.filter(utilizador=user).values_list('badge__slug', flat=True))

    resultado = []
    for badge in Badge.objects.all().order_by('ordem'):
        info = progresso.get(badge.slug, {'progresso': 0})
        earned = badge.slug in desbloqueados
        resultado.append({
            'id': badge.slug,
            'name': badge.nome,
            'description': badge.descricao,
            'icon': badge.icone,
            'earned': earned,
            'progress': 100 if earned else info['progresso'],
        })

    return Response(resultado)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def carteira_historico(request):
    transacoes = TransacaoMoeda.objects.filter(utilizador=request.user)[:20]
    resultado = []
    for t in transacoes:
        resultado.append({
            'id': t.id,
            'label': MOTIVO_LABEL.get(t.motivo, t.motivo),
            'delta': t.valor,
            'date': _format_date_transacao(t.criado_em),
        })
    return Response(resultado)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def leaderboard_professores_mensal(request):
    """Ranking de professores por moedas ganhas com visualizações (views)
    desde o início do mês corrente — diferente do leaderboard de alunos,
    que ordena por saldo total (a gamificação do professor é só views)."""
    inicio_mes = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    ganhos = (
        TransacaoMoeda.objects
        .filter(motivo='views_professor', criado_em__gte=inicio_mes, utilizador__is_teacher=True)
        .values('utilizador')
        .annotate(total=Sum('valor'))
        .order_by('-total')[:20]
    )

    resultado = []
    for idx, row in enumerate(ganhos, start=1):
        u = User.objects.get(id=row['utilizador'])
        resultado.append({
            'rank': idx,
            'userId': u.id,
            'name': _get_name(u),
            'initials': _get_initials(u),
            'coins': row['total'],
            'isMe': u.id == request.user.id,
        })
    return Response(resultado)
