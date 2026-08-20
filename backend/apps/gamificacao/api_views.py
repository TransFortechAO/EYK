from datetime import datetime, timedelta
from django.db.models import OuterRef, Subquery, Value, IntegerField, CharField, F
from django.utils import timezone
from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.models import User
from .models import Carteira, TransacaoMoeda, Ofensiva


MOTIVO_LABEL = {
    'login_diario': 'Login diário',
    'post_comunidade': 'Post na comunidade',
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
    except Carteira.DoesNotExist:
        coins = 0

    try:
        ofensiva = user.ofensiva
        streak = ofensiva.dias_atual
        streak_record = ofensiva.maior_sequencia
    except Ofensiva.DoesNotExist:
        streak = 0
        streak_record = 0

    level = (coins // 500) + 1
    level_min = (level - 1) * 500
    level_max = level * 500
    progress_numerator = coins - level_min
    progress_denominator = level_max - level_min
    level_progress = int((progress_numerator / progress_denominator) * 100) if progress_denominator > 0 else 100
    next_level_coins = level * 500

    data = {
        'coins': coins,
        'streak': streak,
        'streakRecord': streak_record,
        'level': level,
        'levelProgress': level_progress,
        'nextLevelCoins': next_level_coins,
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

    try:
        coins = user.carteira.saldo
    except Carteira.DoesNotExist:
        coins = 0

    try:
        streak = user.ofensiva.dias_atual
        streak_record = user.ofensiva.maior_sequencia
    except Ofensiva.DoesNotExist:
        streak = 0
        streak_record = 0

    badges = [
        {
            'id': 'b1',
            'name': 'Primeiros Passos',
            'description': 'Acumula 500 moedas pela primeira vez',
            'icon': 'Trophy',
            'earned': coins >= 500,
            'progress': min(100, int((coins / 500) * 100)) if coins < 500 else 100,
        },
        {
            'id': 'b2',
            'name': 'Fiel à Rotina',
            'description': 'Mantém uma sequência de 7 dias',
            'icon': 'Flame',
            'earned': streak >= 7,
            'progress': min(100, int((streak / 7) * 100)) if streak < 7 else 100,
        },
        {
            'id': 'b3',
            'name': 'Mestre da Comunidade',
            'description': 'Contribui com 5 posts na comunidade',
            'icon': 'Users',
            'earned': True,
            'progress': 100,
        },
        {
            'id': 'b4',
            'name': 'Milionário em Treino',
            'description': 'Alcança 2000 moedas',
            'icon': 'Coins',
            'earned': coins >= 2000,
            'progress': min(100, int((coins / 2000) * 100)) if coins < 2000 else 100,
        },
        {
            'id': 'b5',
            'name': 'Sem Falhas',
            'description': 'Melhor marca: 30 dias consecutivos',
            'icon': 'Calendar',
            'earned': streak_record >= 30,
            'progress': min(100, int((streak_record / 30) * 100)) if streak_record < 30 else 100,
        },
        {
            'id': 'b6',
            'name': 'Aluno Dedicado',
            'description': 'Completa o teu primeiro curso',
            'icon': 'GraduationCap',
            'earned': False,
            'progress': 25,
        },
        {
            'id': 'b7',
            'name': 'Colecionador',
            'description': 'Desbloqueia 5 badges',
            'icon': 'Award',
            'earned': False,
            'progress': 40,
        },
        {
            'id': 'b8',
            'name': 'Lenda',
            'description': 'Entra para o Top 10 da Leaderboard',
            'icon': 'Crown',
            'earned': False,
            'progress': 0,
        },
    ]

    return Response(badges)


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
