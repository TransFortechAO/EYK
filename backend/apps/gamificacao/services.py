from django.db.models import Sum
from django.utils import timezone

from .models import AlunoBadge, Badge, Carteira, Ofensiva, TransacaoMoeda


def creditar_moedas(user, valor, motivo):
    """Credita (ou debita, se valor negativo) moedas na carteira do utilizador."""
    carteira, _ = Carteira.objects.get_or_create(utilizador=user)
    carteira.saldo = max(0, carteira.saldo + valor)
    carteira.save(update_fields=['saldo', 'atualizado_em'])
    TransacaoMoeda.objects.create(utilizador=user, valor=valor, motivo=motivo)
    return carteira


def creditar_xp(user, valor):
    """Soma XP à carteira. Nunca desce — mesmo gastar coins não afeta o XP,
    é a única base do nível (ver nivel_info)."""
    if valor <= 0:
        return
    carteira, _ = Carteira.objects.get_or_create(utilizador=user)
    carteira.xp += valor
    carteira.save(update_fields=['xp'])
    return carteira


def nivel_info(xp: int) -> dict:
    """Nível deriva só do XP acumulado (nunca desce).

    Curva: XP acumulado para chegar ao nível N = 500 * N * (N-1).
    (nível 2 = 1000 XP, nível 3 = 3000 XP, ..., nível 6 = 15 000 XP —
    consistente com o badge "Mestre EYK".)
    """
    nivel = 1
    while 500 * (nivel + 1) * nivel <= xp:
        nivel += 1

    xp_nivel_atual = 500 * nivel * (nivel - 1)
    xp_proximo_nivel = 500 * (nivel + 1) * nivel
    exigencia = xp_proximo_nivel - xp_nivel_atual
    xp_no_nivel = xp - xp_nivel_atual
    progresso = int((xp_no_nivel / exigencia) * 100) if exigencia > 0 else 100

    return {
        'nivel': nivel,
        'levelProgress': min(100, progresso),
        'nextLevelXp': xp_proximo_nivel,
    }


def registrar_atividade_diaria(user):
    """Actualiza a ofensiva (streak) do utilizador com base na actividade de hoje.

    Devolve True se esta foi a primeira actividade registada hoje, False se já
    tinha sido registada. Não credita moedas — isso é feito à parte por
    verificar_bonus_streak_mensal, só em múltiplos de 30 dias.
    """
    hoje = timezone.localdate()
    ofensiva, criada = Ofensiva.objects.get_or_create(utilizador=user)

    if ofensiva.ultima_atividade == hoje:
        return False

    if ofensiva.ultima_atividade == hoje - timezone.timedelta(days=1):
        ofensiva.dias_atual += 1
    else:
        ofensiva.dias_atual = 1

    ofensiva.maior_sequencia = max(ofensiva.maior_sequencia, ofensiva.dias_atual)
    ofensiva.ultima_atividade = hoje
    ofensiva.save()
    return True


def processar_atividade_diaria(user):
    """Regista a actividade diária e, se hoje completar um múltiplo de 30 dias
    de streak, credita o bónus mensal (+400 coins, +200 XP)."""
    primeira_hoje = registrar_atividade_diaria(user)
    if not primeira_hoje:
        return

    ofensiva = user.ofensiva
    if ofensiva.dias_atual > 0 and ofensiva.dias_atual % 30 == 0:
        creditar_moedas(user, 400, 'streak_mensal')
        creditar_xp(user, 200)
        verificar_badges(user)


def _cursos_concluidos(user) -> int:
    from apps.alunos.models import Aluno
    from apps.cursos.models import Inscricao

    aluno = Aluno.objects.filter(profile=user).first()
    if not aluno:
        return 0
    return Inscricao.objects.filter(aluno=aluno, concluido=True).count()


def creditar_curso_concluido(user, curso):
    """Credita a conclusão de UM curso específico (uma vez só, controlado pelo
    chamador via Inscricao.concluido). +100 coins, +300 XP."""
    creditar_moedas(user, 100, 'curso_concluido')
    creditar_xp(user, 300)
    verificar_badges(user)


def creditar_professor_por_views(professor):
    """A cada bloco de 20 visualizações (contínuas, já filtradas por
    VisualizacaoVideo — só contam depois de 1 min de reprodução), credita
    +30 coins ao professor. Usa Professor.views_creditadas para nunca pagar
    o mesmo bloco duas vezes."""
    from apps.professores.models import VisualizacaoVideo

    total_views = VisualizacaoVideo.objects.filter(
        video__professor=professor,
    ).aggregate(total=Sum('count'))['total'] or 0

    blocos_devidos = total_views // 20
    novos_blocos = blocos_devidos - professor.views_creditadas
    if novos_blocos > 0:
        creditar_moedas(professor.user, novos_blocos * 30, 'views_professor')
        professor.views_creditadas = blocos_devidos
        professor.save(update_fields=['views_creditadas'])
        verificar_badges(professor.user)


# ── Badges ───────────────────────────────────────────────────────────────────
# As 11 conquistas do modelo v2.1. Cada uma tem um 'campo' (chave do contexto
# devolvido por _construir_contexto) e uma 'meta' — usados tanto para decidir
# se está desbloqueada como para calcular a % de progresso.
# 'perfeccionista' e 'eficiente' dependem de quizzes (ainda não construídos):
# campo=None fica sempre por atingir, sem inventar progresso.
BADGES_METAS = {
    'primeira-aula': {'campo': 'videos_assistidos', 'meta': 1},
    'cinefilo': {'campo': 'videos_assistidos', 'meta': 10},
    'fiel-a-rotina': {'campo': 'streak_record', 'meta': 7},
    'sem-falhas': {'campo': 'streak_record', 'meta': 30},
    'perfeccionista': {'campo': None, 'meta': 1},
    'eficiente': {'campo': None, 'meta': 1},
    'aluno-dedicado': {'campo': 'cursos_concluidos', 'meta': 1},
    'colecionador': {'campo': 'cursos_concluidos', 'meta': 5},
    'embaixador': {'campo': 'convidados', 'meta': 3},
    'veterano': {'campo': 'dias_conta', 'meta': 365},
    'mestre-eyk': {'campo': 'nivel', 'meta': 6},
}


def _construir_contexto(user) -> dict:
    from apps.professores.models import VisualizacaoVideo

    try:
        streak_record = user.ofensiva.maior_sequencia
    except Ofensiva.DoesNotExist:
        streak_record = 0

    try:
        xp = user.carteira.xp
    except Carteira.DoesNotExist:
        xp = 0

    dias_conta = (timezone.now() - user.date_joined).days if user.date_joined else 0

    return {
        'cursos_concluidos': _cursos_concluidos(user),
        'streak_record': streak_record,
        'convidados': user.convidados.count(),
        'dias_conta': dias_conta,
        'nivel': nivel_info(xp)['nivel'],
        'videos_assistidos': VisualizacaoVideo.objects.filter(utilizador=user).count(),
    }


def progresso_badges(user) -> dict:
    """Devolve, por slug, {'valor': int, 'meta': int, 'progresso': 0-100}."""
    ctx = _construir_contexto(user)
    resultado = {}
    for slug, info in BADGES_METAS.items():
        campo, meta = info['campo'], info['meta']
        valor = ctx[campo] if campo else 0
        progresso = min(100, int((valor / meta) * 100)) if meta > 0 else 0
        resultado[slug] = {'valor': valor, 'meta': meta, 'progresso': progresso}
    return resultado


def verificar_badges(user):
    """Verifica todas as condições e desbloqueia (idempotente) as conquistas
    novas. Chamado depois de qualquer ação que possa desbloquear um badge."""
    progresso = progresso_badges(user)
    ja_desbloqueados = set(
        AlunoBadge.objects.filter(utilizador=user).values_list('badge__slug', flat=True)
    )

    for slug, info in progresso.items():
        if slug in ja_desbloqueados:
            continue
        if info['valor'] >= info['meta']:
            badge = Badge.objects.filter(slug=slug).first()
            if badge:
                AlunoBadge.objects.get_or_create(utilizador=user, badge=badge)
