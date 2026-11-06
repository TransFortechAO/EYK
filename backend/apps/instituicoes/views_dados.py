"""Pedidos de exportação e eliminação de dados."""
import datetime

from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import FileResponse
from django.urls import reverse
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.notificacoes import notificar

from .acesso import Recusa, com_membro, pid, pode, sid
from .dados import eliminar_crianca, eliminar_instituicao, eliminar_membro, gerar_zip
from .models import MembroInstituicao, PedidoDados
from .servicos import auditar

LINK = '/instituicao/dados'


def _nome(membro) -> str:
    return membro.utilizador.get_display_name()


def _alvo_existe(p: PedidoDados) -> bool:
    if p.ambito == 'crianca':
        return p.aluno_id is not None
    if p.ambito == 'familia':
        return p.pedido_por_id is not None
    return True


def _exportacao_pronta(p: PedidoDados) -> bool:
    if p.estado == 'recusado' or not _alvo_existe(p):
        return False
    return p.tipo == 'exportacao' or p.estado == 'em_curso'


def pedido_json(p: PedidoDados) -> dict:
    pronto = _exportacao_pronta(p)
    return {
        'id': sid(p.id),
        'instituicaoId': sid(p.instituicao_id),
        'tipo': p.tipo,
        'ambito': p.ambito,
        'alvo': p.alvo,
        'pedidoPor': p.pedido_por_nome,
        'pedidoEm': p.pedido_em.isoformat(),
        'estado': p.estado,
        'prazo': p.prazo.isoformat(),
        'ficheiroPronto': pronto,
        'url': reverse('escola-pedido-exportacao', args=[f'srv-{p.instituicao_id}', f'srv-{p.id}']) if pronto else None,
        'nota': p.nota or None,
    }


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('pedir_dados')
def pedidos_dados(request, membro):
    instituicao = membro.instituicao
    gere = pode(membro.papel, 'gerir_pedidos_dados')
    if request.method == 'GET':
        todos = instituicao.pedidos_dados.all()
        if not gere:
            todos = todos.filter(pedido_por=membro)
        return Response([pedido_json(p) for p in todos])

    tipo, ambito = request.data.get('tipo'), request.data.get('ambito')
    if tipo not in ('exportacao', 'eliminacao') or ambito not in ('crianca', 'familia', 'instituicao'):
        raise Recusa('Pedido inválido.')
    aluno = None
    if ambito == 'instituicao':
        if not gere:
            raise Recusa('Só a administração pode pedir os dados da instituição inteira.', status.HTTP_403_FORBIDDEN)
        alvo = instituicao.nome
    elif ambito == 'crianca':
        aluno = instituicao.alunos.filter(pk=pid(request.data.get('alunoId'))).first()
        if not aluno:
            raise Recusa('Escolhe a criança.')
        if not gere and not aluno.tutores.filter(pk=membro.pk).exists():
            raise Recusa('Só o tutor da criança pode pedir os dados dela.', status.HTTP_403_FORBIDDEN)
        alvo = aluno.nome
    else:
        alvo = f'Família de {_nome(membro)}'

    if tipo == 'exportacao':
        estado, nota = 'concluido', ''
    else:
        quem = 'da equipa EYK' if ambito == 'instituicao' else 'da administração'
        estado, nota = 'em_curso', f'Descarrega a cópia. A eliminação só avança com a confirmação {quem}.'
    with transaction.atomic():
        p = PedidoDados.objects.create(
            instituicao=instituicao, tipo=tipo, ambito=ambito, alvo=alvo[:200], aluno=aluno, pedido_por=membro,
            pedido_por_nome=_nome(membro), prazo=timezone.now() + datetime.timedelta(days=30), estado=estado, nota=nota,
        )
        nome_tipo = 'Exportação' if tipo == 'exportacao' else 'Eliminação'
        acao = 'dados_exportados' if tipo == 'exportacao' else 'dados_eliminacao_pedida'
        auditar(instituicao, acao, f'{nome_tipo} pedida: {alvo}.', _nome(membro))
    if tipo == 'eliminacao':
        _avisar_quem_decide(p, membro)
    return Response(pedido_json(p), status=status.HTTP_201_CREATED)


def _avisar_quem_decide(p: PedidoDados, membro) -> None:
    mensagem = f'{p.instituicao.nome}: eliminação de dados pedida ({p.alvo}).'
    if p.ambito == 'instituicao':
        contas = get_user_model().objects.filter(is_staff=True, is_active=True)
        link = '/configuracoes/administracao/instituicoes'
    else:
        admins = p.instituicao.membros.filter(papel='administrador', estado=MembroInstituicao.ATIVO).exclude(pk=membro.pk)
        contas = [m.utilizador for m in admins.select_related('utilizador')]
        link = LINK
    for conta in contas:
        notificar(conta, 'novidade', mensagem, link=link, enviar_por_email=False)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('pedir_dados')
def pedido_exportacao(request, membro, pedido_id):
    p = membro.instituicao.pedidos_dados.select_related('aluno__conta', 'pedido_por__utilizador', 'instituicao').filter(
        pk=pid(pedido_id),
    ).first()
    if not p:
        raise Recusa('Pedido não encontrado.', status.HTTP_404_NOT_FOUND)
    if p.pedido_por_id != membro.pk and not pode(membro.papel, 'gerir_pedidos_dados'):
        raise Recusa('Só quem fez o pedido ou a administração o pode descarregar.', status.HTTP_403_FORBIDDEN)
    if not _exportacao_pronta(p):
        raise Recusa('Esta cópia já não está disponível.', status.HTTP_404_NOT_FOUND)
    auditar(membro.instituicao, 'dados_exportados', f'Cópia descarregada: {p.alvo}.', _nome(membro))
    resposta = FileResponse(gerar_zip(p), as_attachment=True, filename=f'eyk-dados-{p.pk}.zip', content_type='application/zip')
    resposta['Cache-Control'] = 'private, no-store'
    return resposta


def _concluir(p: PedidoDados, aprovar: bool, quem: str, origem: str = 'instituicao') -> None:
    if not aprovar:
        p.estado, p.nota = 'recusado', 'Pedido recusado. Fala com a administração para saber porquê.'
        p.save(update_fields=['estado', 'nota'])
        auditar(p.instituicao, 'dados_eliminacao_pedida', f'Eliminação recusada: {p.alvo}.', quem, origem)
    else:
        if p.ambito == 'crianca' and p.aluno:
            eliminar_crianca(p.aluno)
        elif p.ambito == 'familia' and p.pedido_por:
            alvo = p.pedido_por
            ativos = p.instituicao.membros.filter(papel='administrador', estado=MembroInstituicao.ATIVO)
            if alvo.papel == 'administrador' and not ativos.exclude(pk=alvo.pk).exists():
                raise Recusa('A instituição tem de ter sempre pelo menos um administrador.')
            eliminar_membro(alvo)
        p.refresh_from_db()
        p.estado, p.nota = 'concluido', 'Dados eliminados. As cópias de segurança são limpas no ciclo normal.'
        p.save(update_fields=['estado', 'nota'])
        auditar(p.instituicao, 'dados_eliminacao_pedida', f'Eliminação concluída: {p.alvo}.', quem, origem)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('gerir_pedidos_dados')
def pedido_decidir(request, membro, pedido_id):
    p = membro.instituicao.pedidos_dados.select_related('aluno', 'pedido_por__utilizador', 'instituicao').filter(
        pk=pid(pedido_id), tipo='eliminacao', estado='em_curso',
    ).first()
    if not p:
        raise Recusa('Pedido não encontrado ou já decidido.', status.HTTP_404_NOT_FOUND)
    if p.ambito == 'instituicao':
        raise Recusa('A eliminação da instituição inteira é confirmada pela equipa EYK.', status.HTTP_403_FORBIDDEN)
    conta = p.pedido_por.utilizador if p.pedido_por else None
    aprovar = bool(request.data.get('aprovar'))
    with transaction.atomic():
        _concluir(p, aprovar, _nome(membro))
    if conta and conta != request.user:
        decisao = 'concluída' if aprovar else 'recusada'
        notificar(conta, 'novidade', f'A eliminação de dados que pediste foi {decisao}.', link=LINK, enviar_por_email=False)
    return Response(pedido_json(p))


@api_view(['GET'])
@permission_classes([permissions.IsAdminUser])
def admin_pedidos_dados(request):
    pendentes = PedidoDados.objects.select_related('instituicao').filter(
        ambito='instituicao', tipo='eliminacao', estado='em_curso',
    )
    return Response([{**pedido_json(p), 'escola': p.instituicao.nome} for p in pendentes])


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def admin_pedido_decidir(request, pedido_id):
    p = PedidoDados.objects.select_related('instituicao').filter(
        pk=pedido_id, ambito='instituicao', tipo='eliminacao', estado='em_curso',
    ).first()
    if not p:
        raise Recusa('Pedido não encontrado ou já decidido.', status.HTTP_404_NOT_FOUND)
    if request.data.get('aprovar'):
        with transaction.atomic():
            eliminar_instituicao(p.instituicao)
    else:
        _concluir(p, False, 'Equipa EYK', 'equipa_eyk')
    return Response({'ok': True})
