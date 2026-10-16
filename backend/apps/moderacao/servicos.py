"""Regras de moderação: denúncias, ocultação automática, sanções (aviso,
suspensão, banimento) e contestações. As views só validam o pedido e
chamam estas funções."""
from datetime import timedelta

from django.core import signing
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.notificacoes import enviar_email, notificar
from apps.plataforma.servicos import configuracao

from .conteudos import TIPOS
from .models import GRAVIDADE, AcaoModeracao, Bloqueio, Contestacao, Denuncia

CONTESTACAO_SALT = 'eyk.moderacao.contestar'
CONTESTACAO_VALIDADE_SEGUNDOS = 30 * 24 * 60 * 60  # 30 dias

ROTULO_SANCAO = {
    'aviso': 'um aviso',
    'suspensao': 'uma suspensão',
    'banimento': 'um banimento',
}


class ErroModeracao(Exception):
    def __init__(self, mensagem: str, status: int = 400):
        super().__init__(mensagem)
        self.mensagem = mensagem
        self.status = status


# ── Bloqueios ────────────────────────────────────────────────────────────────

def ids_bloqueados(user) -> set[int]:
    """Utilizadores com quem `user` não interage: os que bloqueou e os que o
    bloquearam (o bloqueio esconde o conteúdo nos dois sentidos)."""
    if not user or not user.is_authenticated:
        return set()
    pares = Bloqueio.objects.filter(Q(utilizador=user) | Q(bloqueado=user)).values_list('utilizador_id', 'bloqueado_id')
    return {b if a == user.id else a for a, b in pares}


def estao_bloqueados(a, b) -> bool:
    return Bloqueio.objects.filter(
        Q(utilizador=a, bloqueado=b) | Q(utilizador=b, bloqueado=a),
    ).exists()


# ── Tokens de contestação ────────────────────────────────────────────────────

def token_contestacao(acao: AcaoModeracao) -> str:
    return signing.dumps({'a': acao.id}, salt=CONTESTACAO_SALT)


def acao_do_token(token: str) -> AcaoModeracao | None:
    try:
        dados = signing.loads(token, salt=CONTESTACAO_SALT, max_age=CONTESTACAO_VALIDADE_SEGUNDOS)
    except signing.BadSignature:
        return None
    return AcaoModeracao.objects.select_related('alvo').filter(pk=dados.get('a')).first()


def link_contestacao(acao: AcaoModeracao) -> str:
    return f'/contestar?token={token_contestacao(acao)}'


def ultima_sancao_ativa(user) -> AcaoModeracao | None:
    tipo = 'banimento' if user.banido else 'suspensao'
    return AcaoModeracao.objects.filter(alvo=user, tipo=tipo, revertida=False).order_by('-criada_em').first()


# ── Denúncias ────────────────────────────────────────────────────────────────

def _notificar_admins(mensagem: str, link: str = '/configuracoes/administracao/moderacao'):
    for admin in User.objects.filter(is_staff=True, is_active=True):
        notificar(
            admin, 'moderacao', mensagem, link=link,
            categoria_email=None, assunto_email='Nova denúncia grave',
        )


def criar_denuncia(denunciante, tipo: str, objeto_id: int, motivo: str, descricao: str = '') -> tuple[Denuncia, bool]:
    """Devolve (denuncia, criada). Uma pessoa só denuncia o mesmo conteúdo
    uma vez — repetir devolve a denúncia existente."""
    if tipo not in TIPOS:
        raise ErroModeracao('Tipo de conteúdo inválido.')
    if motivo not in GRAVIDADE or motivo == 'filtro_automatico':
        raise ErroModeracao('Escolhe um motivo.')

    definicao = TIPOS[tipo]
    objeto = definicao.obter(objeto_id)
    if objeto is None:
        raise ErroModeracao('Conteúdo não encontrado.', 404)
    autor = definicao.autor(objeto)
    if autor and autor.id == denunciante.id:
        raise ErroModeracao('Não podes denunciar o teu próprio conteúdo.')
    if autor and autor.is_staff:
        raise ErroModeracao('Este conteúdo é da equipa EYK. Se há um problema, contacta-nos diretamente.')

    existente = Denuncia.objects.filter(denunciante=denunciante, tipo=tipo, objeto_id=objeto_id).first()
    if existente:
        return existente, False
    try:
        with transaction.atomic():
            denuncia = Denuncia.objects.create(
                denunciante=denunciante, tipo=tipo, objeto_id=objeto_id, alvo=autor,
                motivo=motivo, descricao=(descricao or '').strip()[:2000],
                resumo_conteudo=definicao.resumo(objeto),
            )
    except IntegrityError:  # dois pedidos em simultâneo
        return Denuncia.objects.get(denunciante=denunciante, tipo=tipo, objeto_id=objeto_id), False

    _talvez_ocultar_automaticamente(tipo, objeto)
    if GRAVIDADE[motivo] >= 3:
        _notificar_admins(
            f'Nova denúncia grave ({denuncia.get_motivo_display().lower()}) — {denuncia.get_tipo_display().lower()}.'
        )
    return denuncia, True


def criar_denuncia_do_sistema(tipo: str, objeto, descricao: str):
    definicao = TIPOS[tipo]
    Denuncia.objects.create(
        denunciante=None, tipo=tipo, objeto_id=objeto.pk, alvo=definicao.autor(objeto),
        motivo='filtro_automatico', descricao=descricao, resumo_conteudo=definicao.resumo(objeto),
    )


def _talvez_ocultar_automaticamente(tipo: str, objeto):
    definicao = TIPOS[tipo]
    if not definicao.ocultar_automaticamente or objeto.oculto:
        return
    pendentes = Denuncia.objects.filter(
        tipo=tipo, objeto_id=objeto.pk, estado='pendente', denunciante__isnull=False,
    ).count()
    if pendentes < configuracao().denuncias_para_ocultar:
        return
    ocultar(tipo, objeto, moderador=None, motivo=f'Ocultado automaticamente após {pendentes} denúncias.')


# ── Ações sobre conteúdo ─────────────────────────────────────────────────────

def _registar(tipo_acao, *, moderador, alvo, motivo='', conteudo_tipo='', objeto=None, dias=None):
    resumo = TIPOS[conteudo_tipo].resumo(objeto) if conteudo_tipo and objeto is not None else ''
    return AcaoModeracao.objects.create(
        moderador=moderador, alvo=alvo, tipo=tipo_acao, motivo=motivo,
        conteudo_tipo=conteudo_tipo, conteudo_id=objeto.pk if objeto is not None else None,
        resumo_conteudo=resumo, duracao_dias=dias, automatica=moderador is None,
    )


def ocultar(tipo: str, objeto, moderador, motivo: str = '') -> AcaoModeracao:
    definicao = TIPOS[tipo]
    if not definicao.ocultavel:
        raise ErroModeracao('Este tipo de conteúdo não pode ser ocultado.')
    objeto.oculto = True
    objeto.save(update_fields=['oculto'])
    autor = definicao.autor(objeto)
    acao = _registar('ocultar', moderador=moderador, alvo=autor, motivo=motivo, conteudo_tipo=tipo, objeto=objeto)
    if autor:
        notificar(
            autor, 'moderacao',
            'Um conteúdo teu foi ocultado pela moderação por possível violação das regras da comunidade. '
            'Se achas que foi um engano, podes contestar.',
            link=link_contestacao(acao), categoria_email=None, assunto_email='Conteúdo ocultado',
        )
    return acao


def restaurar(tipo: str, objeto, moderador, motivo: str = '') -> AcaoModeracao:
    objeto.oculto = False
    objeto.save(update_fields=['oculto'])
    return _registar(
        'restaurar', moderador=moderador, alvo=TIPOS[tipo].autor(objeto), motivo=motivo,
        conteudo_tipo=tipo, objeto=objeto,
    )


def apagar(tipo: str, objeto, moderador, motivo: str = '') -> AcaoModeracao:
    definicao = TIPOS[tipo]
    if not definicao.apagavel:
        raise ErroModeracao('Vídeos e cursos não são apagados pela moderação — oculta-os.')
    autor = definicao.autor(objeto)
    acao = _registar('apagar', moderador=moderador, alvo=autor, motivo=motivo, conteudo_tipo=tipo, objeto=objeto)
    objeto.delete()
    return acao


# ── Sanções ──────────────────────────────────────────────────────────────────

def _terminar_sessoes(user):
    from apps.accounts.sessoes import terminar_sessoes
    terminar_sessoes(user)


def _validar_alvo(alvo):
    if alvo is None:
        raise ErroModeracao('Utilizador não encontrado.', 404)
    if alvo.is_staff or alvo.is_superuser:
        raise ErroModeracao('Não é possível sancionar uma conta de administrador.')


def aplicar_aviso(alvo, moderador, motivo: str, conteudo_tipo: str = '', objeto=None) -> AcaoModeracao:
    _validar_alvo(alvo)
    acao = _registar('aviso', moderador=moderador, alvo=alvo, motivo=motivo, conteudo_tipo=conteudo_tipo, objeto=objeto)
    notificar(
        alvo, 'moderacao',
        f'Recebeste um aviso da moderação: {motivo or "violação das regras da comunidade"}. '
        'Avisos repetidos levam à suspensão da conta. Se achas que foi um engano, podes contestar.',
        link=link_contestacao(acao), categoria_email=None, assunto_email='Recebeste um aviso',
    )
    _talvez_suspender_por_reincidencia(alvo)
    return acao


def _talvez_suspender_por_reincidencia(alvo):
    config = configuracao()
    ultima = (
        AcaoModeracao.objects.filter(alvo=alvo, tipo__in=['suspensao', 'banimento'], revertida=False)
        .order_by('-criada_em').values_list('criada_em', flat=True).first()
    )
    avisos = AcaoModeracao.objects.filter(alvo=alvo, tipo='aviso', revertida=False)
    if ultima:
        avisos = avisos.filter(criada_em__gt=ultima)
    total = avisos.count()
    if total < config.avisos_para_suspender:
        return
    aplicar_suspensao(
        alvo, None, config.dias_suspensao_automatica,
        f'Suspensão automática depois de {total} avisos.',
    )
    _notificar_admins(
        f'A conta de {alvo.username} foi suspensa automaticamente ({total} avisos).',
        link='/configuracoes/administracao/moderacao?tab=registo',
    )


def aplicar_suspensao(alvo, moderador, dias: int, motivo: str, conteudo_tipo: str = '', objeto=None) -> AcaoModeracao:
    _validar_alvo(alvo)
    dias = max(1, min(int(dias or 1), 365))
    alvo.suspenso_ate = timezone.now() + timedelta(days=dias)
    alvo.motivo_sancao = motivo
    alvo.save(update_fields=['suspenso_ate', 'motivo_sancao'])
    _terminar_sessoes(alvo)
    acao = _registar(
        'suspensao', moderador=moderador, alvo=alvo, motivo=motivo, conteudo_tipo=conteudo_tipo,
        objeto=objeto, dias=dias,
    )
    enviar_email(
        alvo, 'A tua conta foi suspensa',
        f'A tua conta EYK foi suspensa durante {dias} dia(s), até {timezone.localtime(alvo.suspenso_ate):%d/%m/%Y às %H:%M}.\n'
        f'Motivo: {motivo or "violação das regras da comunidade"}.\n\n'
        'Se achas que foi um engano, podes contestar a decisão neste link:',
        categoria=None, link=link_contestacao(acao),
    )
    return acao


def aplicar_banimento(alvo, moderador, motivo: str, conteudo_tipo: str = '', objeto=None) -> AcaoModeracao:
    _validar_alvo(alvo)
    alvo.banido = True
    alvo.motivo_sancao = motivo
    alvo.save(update_fields=['banido', 'motivo_sancao'])
    _terminar_sessoes(alvo)
    acao = _registar('banimento', moderador=moderador, alvo=alvo, motivo=motivo, conteudo_tipo=conteudo_tipo, objeto=objeto)
    enviar_email(
        alvo, 'A tua conta foi banida',
        f'A tua conta EYK foi banida.\nMotivo: {motivo or "violação grave das regras da comunidade"}.\n\n'
        'Se achas que foi um engano, podes contestar a decisão neste link:',
        categoria=None, link=link_contestacao(acao),
    )
    return acao


def levantar_sancao(alvo, moderador, motivo: str = '') -> AcaoModeracao:
    if alvo is None:
        raise ErroModeracao('Utilizador não encontrado.', 404)
    alvo.banido = False
    alvo.suspenso_ate = None
    alvo.motivo_sancao = ''
    alvo.save(update_fields=['banido', 'suspenso_ate', 'motivo_sancao'])
    acao = _registar('levantar', moderador=moderador, alvo=alvo, motivo=motivo)
    enviar_email(
        alvo, 'A tua conta voltou a estar ativa',
        'A sanção na tua conta EYK foi levantada — já podes voltar a entrar.',
        categoria=None, link='/login',
    )
    return acao


# ── Resolver denúncias (fila de moderação) ───────────────────────────────────

def resolver(moderador, tipo: str, objeto_id: int, conteudo: str, sancao: str | None, motivo: str, dias=None) -> dict:
    """Decide sobre TODAS as denúncias pendentes de um conteúdo.

    `conteudo`: 'manter' | 'ocultar' | 'restaurar' | 'apagar'
    `sancao`: None | 'aviso' | 'suspensao' | 'banimento' (aplicada ao autor)
    Manter (ou repor) sem sanção = rejeitar as denúncias.
    """
    if tipo not in TIPOS:
        raise ErroModeracao('Tipo de conteúdo inválido.')
    if conteudo not in ('manter', 'ocultar', 'restaurar', 'apagar'):
        raise ErroModeracao('Decisão inválida.')
    if sancao not in (None, 'aviso', 'suspensao', 'banimento'):
        raise ErroModeracao('Sanção inválida.')

    definicao = TIPOS[tipo]
    objeto = definicao.obter(objeto_id)
    pendentes = Denuncia.objects.filter(tipo=tipo, objeto_id=objeto_id, estado='pendente')
    alvo = definicao.autor(objeto) if objeto is not None else (pendentes.first().alvo if pendentes.exists() else None)

    with transaction.atomic():
        if objeto is not None:
            if conteudo == 'ocultar' and definicao.ocultavel and not objeto.oculto:
                ocultar(tipo, objeto, moderador, motivo)
            elif conteudo == 'restaurar' and definicao.ocultavel and objeto.oculto:
                restaurar(tipo, objeto, moderador, motivo)
            elif conteudo == 'apagar':
                apagar(tipo, objeto, moderador, motivo)
                objeto = None

        if sancao == 'aviso':
            aplicar_aviso(alvo, moderador, motivo, tipo, objeto)
        elif sancao == 'suspensao':
            aplicar_suspensao(alvo, moderador, dias or 7, motivo, tipo, objeto)
        elif sancao == 'banimento':
            aplicar_banimento(alvo, moderador, motivo, tipo, objeto)

        rejeitadas = conteudo in ('manter', 'restaurar') and sancao is None
        if rejeitadas:
            if objeto is not None and definicao.ocultavel and objeto.oculto:
                # Ocultado automaticamente, mas afinal estava bem: volta a aparecer.
                restaurar(tipo, objeto, moderador, motivo or 'Denúncias rejeitadas.')
            _registar('rejeitar', moderador=moderador, alvo=alvo, motivo=motivo, conteudo_tipo=tipo, objeto=objeto)

        denunciantes = list(User.objects.filter(
            id__in=pendentes.exclude(denunciante__isnull=True).values('denunciante_id'),
        ))
        total = pendentes.update(
            estado='rejeitada' if rejeitadas else 'resolvida',
            resolvida_em=timezone.now(), resolvida_por=moderador,
        )

    mensagem = (
        'Analisámos a tua denúncia e concluímos que o conteúdo não viola as regras da comunidade. Obrigado na mesma!'
        if rejeitadas else
        'Analisámos a tua denúncia e tomámos medidas. Obrigado por ajudares a manter a EYK segura.'
    )
    for pessoa in denunciantes:
        notificar(pessoa, 'moderacao', mensagem, enviar_por_email=False)

    return {'denunciasResolvidas': total, 'rejeitadas': rejeitadas}


# ── Contestações ─────────────────────────────────────────────────────────────

ACOES_CONTESTAVEIS = ('ocultar', 'apagar', 'aviso', 'suspensao', 'banimento')


def contestar(acao: AcaoModeracao, texto: str) -> Contestacao:
    if acao.tipo not in ACOES_CONTESTAVEIS or acao.alvo is None:
        raise ErroModeracao('Esta decisão não pode ser contestada.')
    if acao.revertida:
        raise ErroModeracao('Esta decisão já foi anulada.')
    texto = (texto or '').strip()
    if len(texto) < 10:
        raise ErroModeracao('Explica em poucas palavras porque achas que a decisão foi um engano.')
    if Contestacao.objects.filter(acao=acao).exists():
        raise ErroModeracao('Já contestaste esta decisão. Vais receber a resposta por email.')
    contestacao = Contestacao.objects.create(acao=acao, utilizador=acao.alvo, texto=texto[:3000])
    _notificar_admins(
        f'{acao.alvo.username} contestou uma decisão de moderação ({acao.get_tipo_display().lower()}).',
        link='/configuracoes/administracao/moderacao?tab=contestacoes',
    )
    return contestacao


def responder_contestacao(contestacao: Contestacao, moderador, aceitar: bool, resposta: str) -> Contestacao:
    if contestacao.estado != 'pendente':
        raise ErroModeracao('Esta contestação já foi respondida.')
    acao = contestacao.acao
    with transaction.atomic():
        if aceitar:
            acao.revertida = True
            acao.save(update_fields=['revertida'])
            alvo = acao.alvo
            if acao.tipo in ('suspensao', 'banimento') and alvo and alvo.esta_sancionado:
                levantar_sancao(alvo, moderador, 'Contestação aceite.')
            elif acao.tipo == 'ocultar' and acao.conteudo_tipo:
                objeto = TIPOS[acao.conteudo_tipo].obter(acao.conteudo_id)
                if objeto is not None and objeto.oculto:
                    restaurar(acao.conteudo_tipo, objeto, moderador, 'Contestação aceite.')
        contestacao.estado = 'aceite' if aceitar else 'recusada'
        contestacao.resposta = (resposta or '').strip()
        contestacao.respondida_em = timezone.now()
        contestacao.respondida_por = moderador
        contestacao.save(update_fields=['estado', 'resposta', 'respondida_em', 'respondida_por'])

    if aceitar:
        corpo = 'Analisámos a tua contestação e demos-te razão: a decisão foi anulada.'
    else:
        corpo = 'Analisámos a tua contestação e decidimos manter a decisão.'
    if contestacao.resposta:
        corpo += f'\n\nResposta da equipa: {contestacao.resposta}'
    enviar_email(contestacao.utilizador, 'Resposta à tua contestação', corpo, categoria=None)
    notificar(contestacao.utilizador, 'moderacao', corpo, enviar_por_email=False)
    return contestacao
