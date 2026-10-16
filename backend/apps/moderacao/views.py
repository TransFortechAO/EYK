from collections import OrderedDict

from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.rate_limit import excedeu_limite

from . import servicos
from .conteudos import TIPOS
from .filtro import limpar_cache_palavras, normalizar
from .models import GRAVIDADE, MOTIVOS, AcaoModeracao, Bloqueio, Contestacao, Denuncia, PalavraProibida

MAX_DENUNCIAS_POR_HORA = 20
MOTIVOS_LABEL = dict(MOTIVOS)


def _erro(erro: servicos.ErroModeracao):
    return Response({'detail': erro.mensagem}, status=erro.status)


def _foto(user):
    if user is None:
        return None
    if user.is_teacher:
        from apps.professores.models import Professor
        prof = Professor.objects.filter(user=user).first()
        return prof.foto.url if prof and prof.foto else None
    from apps.alunos.models import Aluno
    aluno = Aluno.objects.filter(profile=user).first()
    return aluno.foto.url if aluno and aluno.foto else None


def _utilizador_resumo(user):
    if user is None:
        return None
    return {
        'id': user.id,
        'nome': user.get_display_name() or user.username,
        'username': user.username,
        'foto': _foto(user),
    }


# ── Utilizadores: denunciar, bloquear, contestar ─────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def denuncias(request):
    """GET: os motivos disponíveis. POST `{tipo, id, motivo, descricao}`."""
    if request.method == 'GET':
        return Response({
            'motivos': [
                {'id': m, 'label': label} for m, label in MOTIVOS if m != 'filtro_automatico'
            ],
        })

    if excedeu_limite(f'denunciar:{request.user.pk}', MAX_DENUNCIAS_POR_HORA, 60 * 60):
        return Response(
            {'detail': 'Fizeste muitas denúncias seguidas. Tenta de novo mais tarde.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    try:
        objeto_id = int(request.data.get('id'))
    except (TypeError, ValueError):
        return Response({'detail': 'Conteúdo inválido.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        _, criada = servicos.criar_denuncia(
            request.user, request.data.get('tipo') or '', objeto_id,
            request.data.get('motivo') or '', request.data.get('descricao') or '',
        )
    except servicos.ErroModeracao as erro:
        return _erro(erro)
    return Response(
        {'ok': True, 'jaDenunciado': not criada},
        status=status.HTTP_201_CREATED if criada else status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def bloqueados(request):
    bloqueios = Bloqueio.objects.filter(utilizador=request.user).select_related('bloqueado')
    return Response([
        {**_utilizador_resumo(b.bloqueado), 'bloqueadoEm': b.criado_em.isoformat()}
        for b in bloqueios
    ])


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def alternar_bloqueio(request, user_id):
    """Bloqueia (ou desbloqueia, se já estava) um utilizador."""
    alvo = get_object_or_404(User, pk=user_id)
    if alvo.id == request.user.id:
        return Response({'detail': 'Não te podes bloquear a ti próprio.'}, status=status.HTTP_400_BAD_REQUEST)
    if alvo.is_staff:
        return Response({'detail': 'Não é possível bloquear a equipa EYK.'}, status=status.HTTP_400_BAD_REQUEST)
    bloqueio, criado = Bloqueio.objects.get_or_create(utilizador=request.user, bloqueado=alvo)
    if not criado:
        bloqueio.delete()
    return Response({'bloqueado': criado})


def _acao_publica(acao: AcaoModeracao) -> dict:
    return {
        'tipo': acao.tipo,
        'tipoLabel': acao.get_tipo_display(),
        'motivo': acao.motivo,
        'criadaEm': acao.criada_em.isoformat(),
        'duracaoDias': acao.duracao_dias,
        'conteudo': acao.resumo_conteudo,
    }


@api_view(['GET', 'POST'])
@permission_classes([permissions.AllowAny])
def contestar(request):
    """Contestar uma decisão a partir do link (com token) enviado por email
    ou mostrado no login — funciona sem sessão, porque uma conta suspensa
    ou banida não consegue entrar."""
    token = request.query_params.get('token') if request.method == 'GET' else request.data.get('token')
    acao = servicos.acao_do_token(token or '')
    if acao is None:
        return Response({'detail': 'Este link é inválido ou já expirou.'}, status=status.HTTP_404_NOT_FOUND)

    contestacao = Contestacao.objects.filter(acao=acao).first()
    if request.method == 'GET':
        return Response({
            'acao': _acao_publica(acao),
            'contestavel': acao.tipo in servicos.ACOES_CONTESTAVEIS and not acao.revertida,
            'contestacao': {
                'estado': contestacao.estado,
                'resposta': contestacao.resposta,
                'criadaEm': contestacao.criada_em.isoformat(),
            } if contestacao else None,
        })

    try:
        servicos.contestar(acao, request.data.get('texto') or '')
    except servicos.ErroModeracao as erro:
        return _erro(erro)
    return Response({'ok': True}, status=status.HTTP_201_CREATED)


# ── Administração: fila de moderação ─────────────────────────────────────────

def _historico(user) -> dict | None:
    if user is None:
        return None
    acoes = AcaoModeracao.objects.filter(alvo=user, revertida=False)
    return {
        **_utilizador_resumo(user),
        'avisos': acoes.filter(tipo='aviso').count(),
        'suspensoes': acoes.filter(tipo='suspensao').count(),
        'denunciasRecebidas': Denuncia.objects.filter(alvo=user).count(),
        'banido': user.banido,
        'suspensoAte': user.suspenso_ate.isoformat() if user.esta_suspenso else None,
    }


@api_view(['GET'])
@permission_classes([permissions.IsAdminUser])
def admin_fila(request):
    """Denúncias agrupadas por conteúdo, das mais graves/numerosas para as
    menos. `?estado=pendente|resolvida|rejeitada` (pendente por omissão)."""
    estado = request.query_params.get('estado') or 'pendente'
    qs = Denuncia.objects.filter(estado=estado).select_related('denunciante', 'alvo').order_by('-criada_em')[:500]

    grupos: OrderedDict = OrderedDict()
    for d in qs:
        grupo = grupos.setdefault((d.tipo, d.objeto_id), {'denuncias': [], 'alvo': d.alvo})
        grupo['denuncias'].append(d)

    itens = []
    historicos = {}
    for (tipo, objeto_id), grupo in grupos.items():
        lista = grupo['denuncias']
        definicao = TIPOS[tipo]
        objeto = definicao.obter(objeto_id)
        alvo = definicao.autor(objeto) if objeto is not None else grupo['alvo']
        if alvo is not None and alvo.id not in historicos:
            historicos[alvo.id] = _historico(alvo)
        motivos = {}
        for d in lista:
            motivos[d.motivo] = motivos.get(d.motivo, 0) + 1
        itens.append({
            'chave': f'{tipo}:{objeto_id}',
            'tipo': tipo,
            'tipoLabel': lista[0].get_tipo_display(),
            'objetoId': objeto_id,
            'existe': objeto is not None,
            'oculto': bool(getattr(objeto, 'oculto', False)),
            'ocultavel': definicao.ocultavel,
            'apagavel': definicao.apagavel,
            'conteudo': definicao.resumo(objeto) if objeto is not None else lista[0].resumo_conteudo,
            'link': definicao.link(objeto) if objeto is not None else None,
            'total': len(lista),
            'gravidade': max(GRAVIDADE.get(d.motivo, 1) for d in lista),
            'motivos': [{'id': m, 'label': MOTIVOS_LABEL[m], 'total': n} for m, n in motivos.items()],
            'primeira': lista[-1].criada_em.isoformat(),
            'ultima': lista[0].criada_em.isoformat(),
            'descricoes': [
                {
                    'motivo': MOTIVOS_LABEL[d.motivo],
                    'descricao': d.descricao,
                    'denunciante': _utilizador_resumo(d.denunciante)['nome'] if d.denunciante else 'Sistema',
                    'criadaEm': d.criada_em.isoformat(),
                }
                for d in lista[:10]
            ],
            'autor': historicos.get(alvo.id) if alvo is not None else None,
        })

    itens.sort(key=lambda i: (i['gravidade'], i['total'], i['ultima']), reverse=True)
    return Response({
        'itens': itens,
        'contadores': {
            'pendentes': Denuncia.objects.filter(estado='pendente').values('tipo', 'objeto_id').distinct().count(),
            'contestacoes': Contestacao.objects.filter(estado='pendente').count(),
        },
    })


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def admin_resolver(request):
    """`{tipo, objetoId, conteudo, sancao, motivo, dias}` — ver servicos.resolver."""
    try:
        objeto_id = int(request.data.get('objetoId'))
    except (TypeError, ValueError):
        return Response({'detail': 'Conteúdo inválido.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        resultado = servicos.resolver(
            request.user,
            request.data.get('tipo') or '',
            objeto_id,
            request.data.get('conteudo') or 'manter',
            request.data.get('sancao') or None,
            (request.data.get('motivo') or '').strip(),
            request.data.get('dias'),
        )
    except servicos.ErroModeracao as erro:
        return _erro(erro)
    return Response({'ok': True, **resultado})


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def admin_sancionar(request, user_id):
    """Sanção direta a um utilizador (sem denúncia): `{sancao, motivo, dias}`
    com sancao = aviso | suspensao | banimento | levantar."""
    alvo = User.objects.filter(pk=user_id).first()
    sancao = request.data.get('sancao')
    motivo = (request.data.get('motivo') or '').strip()
    try:
        if sancao == 'aviso':
            servicos.aplicar_aviso(alvo, request.user, motivo)
        elif sancao == 'suspensao':
            servicos.aplicar_suspensao(alvo, request.user, request.data.get('dias') or 7, motivo)
        elif sancao == 'banimento':
            servicos.aplicar_banimento(alvo, request.user, motivo)
        elif sancao == 'levantar':
            servicos.levantar_sancao(alvo, request.user, motivo)
        else:
            return Response({'detail': 'Sanção inválida.'}, status=status.HTTP_400_BAD_REQUEST)
    except servicos.ErroModeracao as erro:
        return _erro(erro)
    alvo.refresh_from_db()
    return Response({'ok': True, 'utilizador': _historico(alvo)})


@api_view(['GET'])
@permission_classes([permissions.IsAdminUser])
def admin_registo(request):
    qs = AcaoModeracao.objects.select_related('moderador', 'alvo')
    alvo_id = request.query_params.get('utilizador')
    if alvo_id:
        qs = qs.filter(alvo_id=alvo_id)
    return Response([
        {
            'id': a.id,
            'tipo': a.tipo,
            'tipoLabel': a.get_tipo_display(),
            'moderador': _utilizador_resumo(a.moderador)['nome'] if a.moderador else 'Sistema',
            'automatica': a.automatica,
            'alvo': _utilizador_resumo(a.alvo),
            'motivo': a.motivo,
            'conteudoTipo': a.get_conteudo_tipo_display() if a.conteudo_tipo else None,
            'conteudo': a.resumo_conteudo,
            'duracaoDias': a.duracao_dias,
            'revertida': a.revertida,
            'criadaEm': a.criada_em.isoformat(),
        }
        for a in qs[:200]
    ])


@api_view(['GET'])
@permission_classes([permissions.IsAdminUser])
def admin_contestacoes(request):
    estado = request.query_params.get('estado') or 'pendente'
    qs = Contestacao.objects.filter(estado=estado).select_related('acao', 'utilizador')
    return Response([
        {
            'id': c.id,
            'utilizador': _utilizador_resumo(c.utilizador),
            'texto': c.texto,
            'estado': c.estado,
            'resposta': c.resposta,
            'criadaEm': c.criada_em.isoformat(),
            'acao': _acao_publica(c.acao),
        }
        for c in qs[:200]
    ])


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def admin_responder_contestacao(request, pk):
    contestacao = get_object_or_404(Contestacao.objects.select_related('acao__alvo', 'utilizador'), pk=pk)
    try:
        servicos.responder_contestacao(
            contestacao, request.user, bool(request.data.get('aceitar')), request.data.get('resposta') or '',
        )
    except servicos.ErroModeracao as erro:
        return _erro(erro)
    return Response({'ok': True})


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAdminUser])
def admin_palavras(request):
    if request.method == 'POST':
        termo = (request.data.get('termo') or '').strip().lower()
        acao = request.data.get('acao') or 'bloquear'
        if not termo or len(termo) > 100:
            return Response({'detail': 'Indica uma palavra ou expressão.'}, status=status.HTTP_400_BAD_REQUEST)
        if acao not in dict(PalavraProibida.ACOES):
            return Response({'detail': 'Ação inválida.'}, status=status.HTTP_400_BAD_REQUEST)
        existentes = {normalizar(p) for p in PalavraProibida.objects.values_list('termo', flat=True)}
        if normalizar(termo) in existentes:
            return Response({'detail': 'Essa palavra já está na lista.'}, status=status.HTTP_400_BAD_REQUEST)
        PalavraProibida.objects.create(termo=termo, acao=acao)
        limpar_cache_palavras()

    return Response([
        {'id': p.id, 'termo': p.termo, 'acao': p.acao, 'acaoLabel': p.get_acao_display()}
        for p in PalavraProibida.objects.all()
    ], status=status.HTTP_201_CREATED if request.method == 'POST' else status.HTTP_200_OK)


@api_view(['DELETE'])
@permission_classes([permissions.IsAdminUser])
def admin_palavra_apagar(request, pk):
    get_object_or_404(PalavraProibida, pk=pk).delete()
    limpar_cache_palavras()
    return Response(status=status.HTTP_204_NO_CONTENT)
