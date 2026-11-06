"""Vida interna de uma instituição: definições, membros, convites, grupos, alunos e consentimentos.
As regras e as mensagens são as de frontend/app/lib/instituicoes/api.ts."""
import datetime
import re

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.notificacoes import notificar

from .acesso import Recusa, com_membro, pid, pode, sid
from .models import (
    Consentimento,
    ConviteInstituicao,
    GrupoInstituicao,
    Instituicao,
    MembroInstituicao,
    PedidoAdesao,
    PerfilAluno,
)
from .servicos import (
    FINALIDADES,
    ROTULO_PAPEL,
    TAMANHO_CODIGO_PARTILHADO,
    VALIDADE_CONVITE_DIAS,
    auditar,
    enviar_convite_membro,
    gerar_codigo,
    link_do_convite,
    registar_consentimento,
)


def instituicao_json(i: Instituicao) -> dict:
    return {
        'id': sid(i.id),
        'nome': i.nome,
        'tipo': i.tipo,
        'provincia': i.provincia,
        'estado': i.estado,
        'responsavel': {'nome': i.responsavel_nome, 'email': i.responsavel_email},
        'criadaEm': i.criada_em.isoformat(),
        'quotas': {
            'armazenamentoMb': i.armazenamento_mb,
            'ficheiroMaxMb': i.ficheiro_max_mb,
            'utilizadoresMax': i.utilizadores_max,
        },
        'aprovarPedidosPorCodigo': i.aprovar_pedidos_por_codigo,
        'canaisAviso': i.canais_aviso,
        'escola': {
            'comunidadePublicaParaAlunos': i.comunidade_publica_para_alunos,
            'rankingVisivel': i.ranking_visivel,
        },
    }


def membro_json(m: MembroInstituicao) -> dict:
    return {
        'id': sid(m.id),
        'instituicaoId': sid(m.instituicao_id),
        'utilizadorId': m.utilizador_id,
        'nome': m.utilizador.get_display_name(),
        'email': m.utilizador.email,
        'papel': m.papel,
        'estado': m.estado,
        'desde': m.desde.isoformat(),
        'ultimoAcesso': m.ultimo_acesso.isoformat() if m.ultimo_acesso else None,
        'gruposIds': [sid(g.id) for g in m.grupos.all()],
    }


def grupo_json(g: GrupoInstituicao) -> dict:
    dados = {
        'id': sid(g.id),
        'instituicaoId': sid(g.instituicao_id),
        'nome': g.nome,
        'tipo': g.tipo,
        'anoLetivo': g.ano_letivo,
        'arquivado': g.arquivado,
        'criadoEm': g.criado_em.isoformat(),
    }
    if g.lga_publico:
        dados['lga'] = {
            'publico': g.lga_publico,
            'nivel': g.lga_nivel,
            'descricao': g.lga_descricao,
            'conviteAlunosId': sid(g.convite_alunos_id),
            'conviteFamiliasId': sid(g.convite_familias_id),
        }
    return dados


def aluno_json(a: PerfilAluno) -> dict:
    return {
        'id': sid(a.id),
        'instituicaoId': sid(a.instituicao_id),
        'nome': a.nome,
        'grupoId': sid(a.grupo_id),
        'tutoresIds': [sid(t.id) for t in a.tutores.all()],
        'contaId': sid(a.conta_id),
        'estado': a.estado,
        'criadoEm': a.criado_em.isoformat(),
    }


def convite_json(c: ConviteInstituicao) -> dict:
    expirado = c.estado == ConviteInstituicao.PENDENTE and c.expira_em < timezone.now()
    return {
        'id': sid(c.id),
        'instituicaoId': sid(c.instituicao_id),
        'canal': c.canal,
        'destino': c.email or c.telefone,
        'codigo': c.codigo,
        'link': link_do_convite(c),
        'papel': c.papel,
        'grupoId': sid(c.grupo_id),
        'alunoId': sid(c.aluno_id),
        'usos': c.usos,
        'usosMax': c.usos_max,
        'criadoPor': c.criado_por.get_display_name() if c.criado_por else 'Equipa EYK',
        'criadoEm': c.criado_em.isoformat(),
        'expiraEm': c.expira_em.isoformat(),
        'estado': 'expirado' if expirado else c.estado,
    }


def _nome(membro: MembroInstituicao) -> str:
    return membro.utilizador.get_display_name()


def _grupo(instituicao, grupo_id) -> GrupoInstituicao:
    grupo = instituicao.grupos.filter(pk=pid(grupo_id)).first()
    if not grupo:
        raise Recusa('Grupo não encontrado.', status.HTTP_404_NOT_FOUND)
    return grupo


def _aluno(instituicao, aluno_id) -> PerfilAluno:
    aluno = instituicao.alunos.filter(pk=pid(aluno_id)).first()
    if not aluno:
        raise Recusa('Aluno não encontrado.', status.HTTP_404_NOT_FOUND)
    return aluno


def _alvo(instituicao, membro_id) -> MembroInstituicao:
    alvo = instituicao.membros.select_related('utilizador').filter(pk=pid(membro_id)).first()
    if not alvo:
        raise Recusa('Membro não encontrado.', status.HTTP_404_NOT_FOUND)
    return alvo


def _ultimo_administrador(instituicao, alvo: MembroInstituicao, novo_papel: str | None) -> bool:
    if alvo.papel != 'administrador' or alvo.estado != MembroInstituicao.ATIVO or novo_papel == 'administrador':
        return False
    return not instituicao.membros.filter(
        papel='administrador', estado=MembroInstituicao.ATIVO,
    ).exclude(pk=alvo.pk).exists()


def _ids_grupos(membro: MembroInstituicao) -> set[int]:
    return set(membro.grupos.values_list('pk', flat=True))


def _exigir_grupo_meu(membro: MembroInstituicao, grupo: GrupoInstituicao, mensagem='Só podes gerir os teus grupos.'):
    if not pode(membro.papel, 'ver_todos_grupos') and grupo.pk not in _ids_grupos(membro):
        raise Recusa(mensagem, status.HTTP_403_FORBIDDEN)


# ── Definições ───────────────────────────────────────────────────────────────

@api_view(['PATCH'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('gerir_definicoes')
def definicoes(request, membro):
    instituicao = membro.instituicao
    dados = request.data
    if 'aprovarPedidosPorCodigo' in dados:
        instituicao.aprovar_pedidos_por_codigo = bool(dados['aprovarPedidosPorCodigo'])
    if 'canaisAviso' in dados:
        canais = dados['canaisAviso']
        if not isinstance(canais, list) or not set(canais) <= {'plataforma', 'email'}:
            raise Recusa('Canais de aviso inválidos.')
        instituicao.canais_aviso = canais
    if 'escola' in dados:
        escola = dados['escola'] or {}
        instituicao.comunidade_publica_para_alunos = bool(escola.get('comunidadePublicaParaAlunos'))
        instituicao.ranking_visivel = bool(escola.get('rankingVisivel'))
    instituicao.save()
    return Response(instituicao_json(instituicao))


# ── Membros ──────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
@com_membro()
def membros(request, membro):
    todos = membro.instituicao.membros.exclude(estado=MembroInstituicao.REMOVIDO).select_related(
        'utilizador',
    ).prefetch_related('grupos')
    if pode(membro.papel, 'gerir_membros') or pode(membro.papel, 'ver_todos_grupos'):
        visiveis = list(todos)
    elif membro.papel == 'educador':
        # Educadores: só quem partilha grupos com eles.
        meus = _ids_grupos(membro)
        visiveis = [m for m in todos if m.pk == membro.pk or {g.id for g in m.grupos.all()} & meus]
    else:
        visiveis = [membro]
    return Response([membro_json(m) for m in visiveis])


@api_view(['PATCH', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('gerir_membros')
def membro_detalhe(request, membro, membro_id):
    instituicao = membro.instituicao
    alvo = _alvo(instituicao, membro_id)
    if request.method == 'DELETE':
        if _ultimo_administrador(instituicao, alvo, None):
            raise Recusa('A instituição tem de ter sempre pelo menos um administrador.')
        alvo.estado = MembroInstituicao.REMOVIDO
        alvo.save(update_fields=['estado'])
        # Deixa de ser tutor de qualquer criança.
        alvo.criancas.clear()
        auditar(
            instituicao, 'membro_removido', f'{_nome(alvo)} ({ROTULO_PAPEL[alvo.papel]}) removido da instituição.',
            _nome(membro),
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    papel = request.data.get('papel')
    if papel not in ROTULO_PAPEL:
        raise Recusa('Papel inválido.')
    if _ultimo_administrador(instituicao, alvo, papel):
        raise Recusa('A instituição tem de ter sempre pelo menos um administrador.')
    antes = alvo.papel
    alvo.papel = papel
    alvo.save(update_fields=['papel'])
    auditar(
        instituicao, 'papel_alterado', f'{_nome(alvo)}: {ROTULO_PAPEL[antes]} → {ROTULO_PAPEL[papel]}.', _nome(membro),
    )
    return Response(membro_json(alvo))


# ── Convites ─────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('convidar')
def convites(request, membro):
    instituicao = membro.instituicao
    if request.method == 'GET':
        todos = instituicao.convites.select_related('criado_por')
        if pode(membro.papel, 'gerir_membros'):
            lista = list(todos)
        else:
            # Educadores vêem os convites dos seus grupos.
            meus = _ids_grupos(membro)
            lista = [c for c in todos if not c.grupo_id or c.grupo_id in meus]
        return Response([convite_json(c) for c in lista])

    dados = request.data
    canal, papel = dados.get('canal'), dados.get('papel')
    if canal not in ('email', 'sms', 'codigo') or papel not in ROTULO_PAPEL:
        raise Recusa('Convite inválido.')
    if not pode(membro.papel, 'gerir_membros') and papel not in ('familia', 'aluno'):
        raise Recusa('Educadores só podem convidar famílias e alunos.', status.HTTP_403_FORBIDDEN)
    grupo = _grupo(instituicao, dados['grupoId']) if dados.get('grupoId') else None
    if grupo:
        _exigir_grupo_meu(membro, grupo, 'Só podes convidar para os teus grupos.')
    aluno = _aluno(instituicao, dados['alunoId']) if dados.get('alunoId') else None
    if aluno and papel != 'familia':
        raise Recusa('Só convites de família podem ficar ligados a uma criança.')
    destino = (dados.get('destino') or '').strip()
    if canal == 'email':
        try:
            validate_email(destino)
        except ValidationError:
            raise Recusa('Email inválido.') from None
    if canal == 'sms' and len(re.sub(r'\D', '', destino)) < 9:
        raise Recusa('Número de telemóvel inválido.')
    try:
        validade = int(dados.get('validadeDias') or VALIDADE_CONVITE_DIAS)
        usos_max = int(dados.get('usosMax') or 1)
    except (TypeError, ValueError):
        raise Recusa('Convite inválido.') from None

    convite = ConviteInstituicao.objects.create(
        instituicao=instituicao,
        canal=canal,
        codigo=gerar_codigo(TAMANHO_CODIGO_PARTILHADO),
        email=destino if canal == 'email' else '',
        telefone=destino if canal == 'sms' else '',
        papel=papel,
        grupo=grupo,
        aluno=aluno,
        usos_max=max(1, min(500, usos_max)) if canal == 'codigo' else 1,
        criado_por=request.user,
        expira_em=timezone.now() + datetime.timedelta(days=max(1, min(90, validade))),
    )
    para = f' para {grupo.nome}' if grupo else ''
    auditar(instituicao, 'convite_criado', f'Convite ({canal}) como {ROTULO_PAPEL[papel]}{para}.', _nome(membro))
    email_enviado = enviar_convite_membro(convite) if canal == 'email' else False
    return Response({**convite_json(convite), 'emailEnviado': email_enviado}, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('convidar')
def convite_detalhe(request, membro, convite_id):
    convite = membro.instituicao.convites.filter(pk=pid(convite_id)).first()
    if not convite:
        raise Recusa('Convite não encontrado.', status.HTTP_404_NOT_FOUND)
    if convite.estado != ConviteInstituicao.PENDENTE:
        raise Recusa('Este convite já não está ativo.')
    convite.estado = ConviteInstituicao.CANCELADO
    convite.save(update_fields=['estado'])
    auditar(membro.instituicao, 'convite_cancelado', f'Convite {convite.codigo} cancelado.', _nome(membro))
    return Response(status=status.HTTP_204_NO_CONTENT)


# ── Pedidos de adesão ────────────────────────────────────────────────────────

def _pedido_json(p: PedidoAdesao) -> dict:
    return {
        'id': sid(p.id),
        'instituicaoId': sid(p.instituicao_id),
        'conviteId': sid(p.convite_id),
        'nome': p.utilizador.get_display_name(),
        'email': p.utilizador.email,
        'papel': p.papel,
        'grupoId': sid(p.grupo_id),
        'pedidoEm': p.pedido_em.isoformat(),
        'estado': p.estado,
        'utilizadorId': p.utilizador_id,
    }


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('aprovar_pedidos')
def pedidos_adesao(request, membro):
    pedidos = membro.instituicao.pedidos_adesao.select_related('utilizador')
    return Response([_pedido_json(p) for p in pedidos])


def adicionar_membro(instituicao, utilizador, papel, grupo=None) -> MembroInstituicao:
    """Junta a conta à instituição (respeita a quota) ou reativa quem tinha sido removido."""
    existente = instituicao.membros.filter(utilizador=utilizador).first()
    if not existente or existente.estado != MembroInstituicao.ATIVO:
        ativos = instituicao.membros.filter(estado=MembroInstituicao.ATIVO).count()
        if ativos >= instituicao.utilizadores_max:
            raise Recusa('A instituição atingiu o limite de utilizadores.')
    if existente:
        if existente.estado != MembroInstituicao.ATIVO:
            existente.papel = papel
        existente.estado = MembroInstituicao.ATIVO
        existente.save(update_fields=['papel', 'estado'])
        membro = existente
    else:
        membro = MembroInstituicao.objects.create(instituicao=instituicao, utilizador=utilizador, papel=papel)
    if grupo:
        membro.grupos.add(grupo)
    return membro


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('aprovar_pedidos')
def pedido_decidir(request, membro, pedido_id):
    instituicao = membro.instituicao
    with transaction.atomic():
        pedido = (
            instituicao.pedidos_adesao.select_for_update()
            .filter(pk=pid(pedido_id), estado=PedidoAdesao.PENDENTE)
            .first()
        )
        if not pedido:
            raise Recusa('Pedido não encontrado ou já decidido.', status.HTTP_404_NOT_FOUND)
        aprovar = bool(request.data.get('aprovar'))
        pedido.estado = PedidoAdesao.APROVADO if aprovar else PedidoAdesao.REJEITADO
        pedido.save(update_fields=['estado'])
        if aprovar:
            adicionar_membro(instituicao, pedido.utilizador, pedido.papel, pedido.grupo)
        nome = pedido.utilizador.get_display_name()
        decisao = 'aprovado' if aprovar else 'rejeitado'
        auditar(instituicao, 'pedido_decidido', f'Pedido de {nome} ({ROTULO_PAPEL[pedido.papel]}) {decisao}.', _nome(membro))
    notificar(
        pedido.utilizador, 'novidade',
        f'O teu pedido para entrar na {instituicao.nome} foi {decisao}.', link='/instituicao' if aprovar else '',
    )
    return Response({'ok': True})


# ── Grupos ───────────────────────────────────────────────────────────────────

def _grupos_visiveis(membro: MembroInstituicao, incluir_arquivados: bool):
    grupos = membro.instituicao.grupos.all()
    if not incluir_arquivados:
        grupos = grupos.filter(arquivado=False)
    if not pode(membro.papel, 'ver_todos_grupos'):
        grupos = grupos.filter(pk__in=_ids_grupos(membro))
    return grupos


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro()
def grupos(request, membro):
    if request.method == 'GET':
        incluir = request.query_params.get('arquivados') == '1'
        return Response([
            {
                **grupo_json(g),
                'membros': g.membros.filter(estado=MembroInstituicao.ATIVO).count(),
                'alunos': g.alunos.filter(estado=PerfilAluno.ATIVO).count(),
            }
            for g in _grupos_visiveis(membro, incluir)
        ])

    if not pode(membro.papel, 'gerir_grupos'):
        raise Recusa('O teu papel não permite esta ação.', status.HTTP_403_FORBIDDEN)
    nome = (request.data.get('nome') or '').strip()
    tipo = request.data.get('tipo') or 'turma'
    if not nome:
        raise Recusa('Dá um nome ao grupo.')
    if tipo not in dict(GrupoInstituicao.TIPOS):
        raise Recusa('Tipo de grupo inválido.')
    grupo = GrupoInstituicao.objects.create(
        instituicao=membro.instituicao, nome=nome, tipo=tipo, ano_letivo=(request.data.get('anoLetivo') or '').strip(),
    )
    # Quem cria um grupo fica nele (educadores só vêem os seus grupos).
    membro.grupos.add(grupo)
    auditar(membro.instituicao, 'grupo_criado', f'Grupo «{grupo.nome}» criado.', _nome(membro))
    return Response(grupo_json(grupo), status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('gerir_grupos')
def grupo_detalhe(request, membro, grupo_id):
    grupo = _grupo(membro.instituicao, grupo_id)
    _exigir_grupo_meu(membro, grupo)
    grupo.arquivado = bool(request.data.get('arquivado', True))
    grupo.save(update_fields=['arquivado'])
    estado = 'arquivado' if grupo.arquivado else 'reativado'
    auditar(membro.instituicao, 'grupo_arquivado', f'Grupo «{grupo.nome}» {estado}.', _nome(membro))
    return Response(grupo_json(grupo))


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('gerir_grupos')
def grupo_membro(request, membro, grupo_id):
    instituicao = membro.instituicao
    grupo = _grupo(instituicao, grupo_id)
    _exigir_grupo_meu(membro, grupo)
    alvo = _alvo(instituicao, request.data.get('membroId'))
    if request.data.get('dentro'):
        alvo.grupos.add(grupo)
    else:
        alvo.grupos.remove(grupo)
    return Response({'ok': True})


# ── Alunos ───────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro()
def alunos(request, membro):
    instituicao = membro.instituicao
    if request.method == 'GET':
        todos = instituicao.alunos.prefetch_related('tutores')
        if membro.papel == 'familia':
            lista = todos.filter(tutores=membro)
        elif membro.papel == 'aluno':
            lista = todos.none()
        elif pode(membro.papel, 'ver_todos_grupos'):
            lista = todos
        else:
            lista = todos.filter(grupo_id__in=_ids_grupos(membro))
        return Response([aluno_json(a) for a in lista])

    if not pode(membro.papel, 'gerir_alunos'):
        raise Recusa('O teu papel não permite esta ação.', status.HTTP_403_FORBIDDEN)
    nome = (request.data.get('nome') or '').strip()
    if not nome:
        raise Recusa('Indica o nome ou alcunha da criança.')
    grupo = _grupo(instituicao, request.data['grupoId']) if request.data.get('grupoId') else None
    if grupo:
        _exigir_grupo_meu(membro, grupo)
    aluno = PerfilAluno.objects.create(instituicao=instituicao, nome=nome, grupo=grupo)
    auditar(instituicao, 'aluno_criado', f'Perfil de {aluno.nome} criado (à espera do consentimento do tutor).', _nome(membro))
    return Response(aluno_json(aluno), status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('gerir_alunos')
def aluno_conta(request, membro, aluno_id):
    """Liga o perfil da criança à conta de aluno com que ela entra: é o que faz valer os
    consentimentos nas respostas em vídeo e dá à família acesso ao que a criança envia."""
    instituicao = membro.instituicao
    aluno = _aluno(instituicao, aluno_id)
    if aluno.grupo:
        _exigir_grupo_meu(membro, aluno.grupo)
    conta_id = request.data.get('contaId')
    conta = None
    if conta_id:
        conta = _alvo(instituicao, conta_id)
        if conta.papel != 'aluno' or conta.estado != MembroInstituicao.ATIVO:
            raise Recusa('Escolhe uma conta de aluno ativa.')
        if instituicao.alunos.filter(conta=conta).exclude(pk=aluno.pk).exists():
            raise Recusa('Esta conta já está ligada a outra criança.')
    aluno.conta = conta
    aluno.save(update_fields=['conta'])
    detalhe = f'Conta de {_nome(conta)} ligada a' if conta else 'Conta desligada de'
    auditar(instituicao, 'vinculo_criado', f'{detalhe} {aluno.nome}.', _nome(membro))
    return Response(aluno_json(aluno))


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('gerir_membros')
def aluno_tutor(request, membro, aluno_id, tutor_id):
    instituicao = membro.instituicao
    aluno = _aluno(instituicao, aluno_id)
    tutor = _alvo(instituicao, tutor_id)
    aluno.tutores.remove(tutor)
    auditar(instituicao, 'vinculo_removido', f'{_nome(tutor)} deixou de ser tutor de {aluno.nome}.', _nome(membro))
    return Response(status=status.HTTP_204_NO_CONTENT)


# ── Consentimentos ───────────────────────────────────────────────────────────

def _consentimento_json(c: Consentimento) -> dict:
    return {
        'id': sid(c.id),
        'instituicaoId': sid(c.instituicao_id),
        'alunoId': sid(c.aluno_id),
        'tutorId': sid(c.tutor_id),
        'tutorNome': c.tutor_nome,
        'finalidade': c.finalidade,
        'aceite': c.aceite,
        'versaoTexto': c.versao_texto,
        'registadoEm': c.registado_em.isoformat(),
        'comApoio': c.com_apoio,
    }


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro()
def consentimentos(request, membro):
    instituicao = membro.instituicao
    if request.method == 'GET':
        if pode(membro.papel, 'ver_consentimentos'):
            lista = instituicao.consentimentos.all()
        elif membro.papel == 'familia':
            lista = instituicao.consentimentos.filter(tutor=membro)
        else:
            raise Recusa('O teu papel não permite ver os consentimentos.', status.HTTP_403_FORBIDDEN)
        return Response([_consentimento_json(c) for c in lista])

    if not pode(membro.papel, 'dar_consentimento'):
        raise Recusa('O teu papel não permite esta ação.', status.HTTP_403_FORBIDDEN)
    aluno = instituicao.alunos.filter(pk=pid(request.data.get('alunoId'))).first()
    if not aluno or not aluno.tutores.filter(pk=membro.pk).exists():
        raise Recusa('Só o tutor da criança pode decidir isto.', status.HTTP_403_FORBIDDEN)
    finalidade = request.data.get('finalidade')
    if finalidade not in FINALIDADES:
        raise Recusa('Finalidade inválida.')
    registar_consentimento(aluno, membro, finalidade, bool(request.data.get('aceite')))
    aluno.refresh_from_db()
    return Response(aluno_json(aluno))
