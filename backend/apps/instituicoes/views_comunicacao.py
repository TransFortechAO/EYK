"""Avisos, agenda, ficheiros, relatórios, auditoria e pedidos de dados de uma instituição.
As regras e as mensagens são as de frontend/app/lib/instituicoes/api.ts."""
import datetime
import json

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Sum
from django.urls import reverse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import permissions, status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.notificacoes import enviar_em_massa, notificar

from .acesso import Recusa, com_membro, pid, pode, sid
from .armazenamento import categoria_de, servir
from .models import (
    Aviso,
    Evento,
    FicheiroInstituicao,
    LeituraAviso,
    MembroInstituicao,
    PedidoDados,
    PerfilAluno,
    RespostaEvento,
)
from .servicos import auditar, consentimentos_atuais

LIMITE_ANONIMATO = 5
DEFINICAO_ATIVO = 'Pelo menos um acesso nos últimos 30 dias.'
RESPOSTAS_PRESENCA = ('vou', 'nao_vou', 'talvez')


def _nome(membro: MembroInstituicao) -> str:
    return membro.utilizador.get_display_name()


# ── Destinatários ────────────────────────────────────────────────────────────

def destino_json(o) -> dict:
    if o.dest_tipo == 'grupo':
        return {'tipo': 'grupo', 'grupoId': sid(o.dest_grupo_id)}
    if o.dest_tipo == 'pessoa':
        return {'tipo': 'pessoa', 'membroId': sid(o.dest_membro_id)}
    return {'tipo': 'instituicao'}


def ler_destino(membro: MembroInstituicao, dados) -> dict:
    """Valida o destino e devolve os campos do modelo."""
    instituicao = membro.instituicao
    tipo = (dados or {}).get('tipo')
    if tipo == 'grupo':
        grupo = instituicao.grupos.filter(pk=pid(dados.get('grupoId'))).first()
        if not grupo:
            raise Recusa('Grupo não encontrado.')
        if not pode(membro.papel, 'ver_todos_grupos') and not membro.grupos.filter(pk=grupo.pk).exists():
            raise Recusa('Só podes escolher os teus grupos.', status.HTTP_403_FORBIDDEN)
        return {'dest_tipo': 'grupo', 'dest_grupo': grupo, 'dest_membro': None}
    if tipo == 'pessoa':
        alvo = instituicao.membros.filter(pk=pid(dados.get('membroId'))).first()
        if not alvo:
            raise Recusa('Pessoa não encontrada.')
        return {'dest_tipo': 'pessoa', 'dest_grupo': None, 'dest_membro': alvo}
    if tipo != 'instituicao':
        raise Recusa('Destinatários inválidos.')
    if not pode(membro.papel, 'gerir_membros'):
        raise Recusa('Só a administração pode escrever para toda a instituição.', status.HTTP_403_FORBIDDEN)
    return {'dest_tipo': 'instituicao', 'dest_grupo': None, 'dest_membro': None}


def e_destinatario(o, membro: MembroInstituicao, grupos: set[int]) -> bool:
    if pode(membro.papel, 'ver_todos_grupos') or o.dest_tipo == 'instituicao':
        return True
    if o.dest_tipo == 'grupo':
        return o.dest_grupo_id in grupos
    return o.dest_membro_id == membro.pk


def destinatarios(o):
    """Membros ativos que recebem isto."""
    ativos = o.instituicao.membros.filter(estado=MembroInstituicao.ATIVO).select_related('utilizador')
    if o.dest_tipo == 'grupo':
        return ativos.filter(grupos=o.dest_grupo_id)
    if o.dest_tipo == 'pessoa':
        return ativos.filter(pk=o.dest_membro_id)
    return ativos


def descrever(o) -> str:
    if o.dest_tipo == 'grupo':
        return o.dest_grupo.nome if o.dest_grupo else 'um grupo'
    if o.dest_tipo == 'pessoa':
        return o.dest_membro.utilizador.get_display_name() if o.dest_membro else 'uma pessoa'
    return 'toda a instituição'


def avisar_pessoas(instituicao, alvo, assunto: str, corpo: str, link: str, por_email: bool = True) -> None:
    """Notificação na app para todos; email para quem o tiver ligado."""
    alvo = list(alvo)
    for m in alvo:
        notificar(m.utilizador, 'novidade', f'{instituicao.nome}: {corpo}', link=link, enviar_por_email=False)
    if por_email and 'email' in instituicao.canais_aviso:
        contas = [m.utilizador for m in alvo if m.aviso_email is not False]
        enviar_em_massa(contas, assunto, corpo, None, link)


# ── Avisos ───────────────────────────────────────────────────────────────────

def _aviso_json(a: Aviso, membro: MembroInstituicao, leituras: dict) -> dict:
    recebidos = {m.pk for m in destinatarios(a)} - {a.autor_id}
    dele = leituras.get(a.pk, {})
    minha = dele.get(membro.pk)
    return {
        'id': sid(a.id),
        'instituicaoId': sid(a.instituicao_id),
        'titulo': a.titulo,
        'mensagem': a.mensagem,
        'destinatarios': destino_json(a),
        'autor': a.autor_nome,
        'autorId': sid(a.autor_id),
        'publicadoEm': a.publicado_em.isoformat(),
        'pedirConfirmacao': a.pedir_confirmacao,
        'anexosIds': [sid(f.id) for f in a.anexos.all()],
        # Contagens agregadas: quem envia vê números, não quem não leu.
        'recebidos': len(recebidos),
        'lidos': sum(1 for m in dele if m in recebidos),
        'confirmados': sum(1 for m, c in dele.items() if c and m in recebidos),
        'lidoPorMim': minha is not None or a.autor_id == membro.pk,
        'confirmadoPorMim': bool(minha),
    }


def _leituras(instituicao) -> dict:
    r: dict = {}
    for aviso, m, confirmado in LeituraAviso.objects.filter(aviso__instituicao=instituicao).values_list(
        'aviso_id', 'membro_id', 'confirmado',
    ):
        r.setdefault(aviso, {})[m] = confirmado
    return r


def avisos_de(membro: MembroInstituicao) -> list[dict]:
    grupos = set(membro.grupos.values_list('pk', flat=True))
    leituras = _leituras(membro.instituicao)
    return [
        _aviso_json(a, membro, leituras)
        for a in membro.instituicao.avisos.select_related('instituicao').prefetch_related('anexos')
        if a.autor_id == membro.pk or e_destinatario(a, membro, grupos)
    ]


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('ver_avisos')
def avisos(request, membro):
    if request.method == 'GET':
        return Response(avisos_de(membro))
    if not pode(membro.papel, 'publicar_avisos'):
        raise Recusa('O teu papel não permite esta ação.', status.HTTP_403_FORBIDDEN)
    instituicao = membro.instituicao
    dados = request.data
    titulo, mensagem = (dados.get('titulo') or '').strip(), (dados.get('mensagem') or '').strip()
    if not titulo or not mensagem:
        raise Recusa('O aviso precisa de título e mensagem.')
    aviso = Aviso.objects.create(
        instituicao=instituicao, titulo=titulo, mensagem=mensagem, autor=membro, autor_nome=_nome(membro),
        pedir_confirmacao=bool(dados.get('pedirConfirmacao')), **ler_destino(membro, dados.get('destinatarios')),
    )
    anexos = [pid(i) for i in dados.get('anexosIds') or []]
    aviso.anexos.set(instituicao.ficheiros.filter(pk__in=anexos))
    auditar(instituicao, 'aviso_publicado', f'«{aviso.titulo}» para {descrever(aviso)}.', _nome(membro))
    avisar_pessoas(
        instituicao, destinatarios(aviso).exclude(pk=membro.pk), f'{instituicao.nome}: {titulo}', mensagem,
        '/instituicao/avisos',
    )
    return Response(_aviso_json(aviso, membro, {}), status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('ver_avisos')
def aviso_lido(request, membro, aviso_id):
    aviso = membro.instituicao.avisos.filter(pk=pid(aviso_id)).first()
    if not aviso:
        raise Recusa('Aviso não encontrado.', status.HTTP_404_NOT_FOUND)
    leitura, _ = LeituraAviso.objects.get_or_create(aviso=aviso, membro=membro)
    if request.data.get('confirmar') and not leitura.confirmado:
        leitura.confirmado = True
        leitura.save(update_fields=['confirmado'])
    return Response({'ok': True})


@api_view(['GET', 'PUT'])
@permission_classes([permissions.IsAuthenticated])
@com_membro()
def preferencias_aviso(request, membro):
    canais = membro.instituicao.canais_aviso
    if request.method == 'PUT':
        # Só os canais que a instituição ativou; a plataforma está sempre ligada.
        membro.aviso_email = bool(request.data.get('email')) and 'email' in canais
        membro.save(update_fields=['aviso_email'])
    email = membro.aviso_email if membro.aviso_email is not None else 'email' in canais
    return Response({'preferencias': {'plataforma': True, 'email': email}, 'disponiveis': canais})


# ── Agenda ───────────────────────────────────────────────────────────────────

def _data(valor) -> datetime.datetime | None:
    data = parse_datetime(valor) if isinstance(valor, str) else None
    if data and timezone.is_naive(data):
        data = timezone.make_aware(data)
    return data


def _evento_json(ev: Evento, membro: MembroInstituicao) -> dict:
    presencas = dict.fromkeys(RESPOSTAS_PRESENCA, 0)
    minha = None
    for r in ev.respostas.all():
        presencas[r.resposta] += 1
        if r.membro_id == membro.pk:
            minha = r.resposta
    return {
        'id': sid(ev.id),
        'instituicaoId': sid(ev.instituicao_id),
        'titulo': ev.titulo,
        'descricao': ev.descricao,
        'inicio': ev.inicio.isoformat(),
        'fim': ev.fim.isoformat(),
        'local': ev.local,
        'ligacao': ev.ligacao,
        'destinatarios': destino_json(ev),
        'recorrencia': ev.recorrencia,
        'lembretes': ev.lembretes,
        'cancelado': ev.cancelado,
        'criadoPor': ev.criado_por,
        'presencas': presencas,
        'minhaResposta': minha,
    }


def eventos_de(membro: MembroInstituicao) -> list[dict]:
    grupos = set(membro.grupos.values_list('pk', flat=True))
    return [
        _evento_json(ev, membro)
        for ev in membro.instituicao.eventos.prefetch_related('respostas')
        if e_destinatario(ev, membro, grupos)
    ]


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('ver_agenda')
def eventos(request, membro):
    if request.method == 'GET':
        return Response(eventos_de(membro))
    if not pode(membro.papel, 'criar_eventos'):
        raise Recusa('O teu papel não permite esta ação.', status.HTTP_403_FORBIDDEN)
    dados = request.data
    titulo = (dados.get('titulo') or '').strip()
    if not titulo:
        raise Recusa('Dá um título ao evento.')
    inicio = _data(dados.get('inicio'))
    if not inicio:
        raise Recusa('Indica a data e a hora de início.')
    fim = _data(dados.get('fim')) if dados.get('fim') else inicio
    if not fim or fim < inicio:
        raise Recusa('O fim não pode ser antes do início.')
    recorrencia = dados.get('recorrencia') or 'nenhuma'
    lembretes = [x for x in dados.get('lembretes') or [] if x in ('1d', '1h')]
    if recorrencia not in ('nenhuma', 'semanal', 'mensal'):
        raise Recusa('Recorrência inválida.')
    ev = Evento.objects.create(
        instituicao=membro.instituicao, titulo=titulo, descricao=(dados.get('descricao') or '').strip(), inicio=inicio,
        fim=fim, local=(dados.get('local') or '').strip(), ligacao=(dados.get('ligacao') or '').strip(),
        recorrencia=recorrencia, lembretes=lembretes, criado_por=_nome(membro),
        **ler_destino(membro, dados.get('destinatarios')),
    )
    auditar(membro.instituicao, 'evento_criado', f'«{ev.titulo}» para {descrever(ev)}.', _nome(membro))
    return Response(_evento_json(ev, membro), status=status.HTTP_201_CREATED)


def _evento(membro, evento_id) -> Evento:
    ev = membro.instituicao.eventos.filter(pk=pid(evento_id)).first()
    if not ev:
        raise Recusa('Evento não encontrado.', status.HTTP_404_NOT_FOUND)
    return ev


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('criar_eventos')
def evento_cancelar(request, membro, evento_id):
    ev = _evento(membro, evento_id)
    ev.cancelado = True
    ev.save(update_fields=['cancelado'])
    alvo = list(destinatarios(ev).exclude(pk=membro.pk))
    auditar(membro.instituicao, 'evento_cancelado', f'«{ev.titulo}» cancelado; {len(alvo)} pessoas avisadas.', _nome(membro))
    avisar_pessoas(membro.instituicao, alvo, f'Evento cancelado: {ev.titulo}', f'O evento «{ev.titulo}» foi cancelado.', '/instituicao/agenda')
    return Response({'ok': True})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('ver_agenda')
def evento_presenca(request, membro, evento_id):
    resposta = request.data.get('resposta')
    if resposta not in RESPOSTAS_PRESENCA:
        raise Recusa('Resposta inválida.')
    RespostaEvento.objects.update_or_create(evento=_evento(membro, evento_id), membro=membro, defaults={'resposta': resposta})
    return Response({'ok': True})


# ── Ficheiros ────────────────────────────────────────────────────────────────

def uso_armazenamento(instituicao) -> int:
    ficheiros = instituicao.ficheiros.aggregate(t=Sum('tamanho_bytes'))['t'] or 0
    anexos = instituicao.anexos.aggregate(t=Sum('tamanho_bytes'))['t'] or 0
    return ficheiros + anexos


def validar_quota(instituicao, tamanho: int) -> None:
    if tamanho > instituicao.ficheiro_max_mb * 1024 * 1024:
        raise Recusa(f'O ficheiro passa o limite de {instituicao.ficheiro_max_mb} MB por ficheiro.')
    if uso_armazenamento(instituicao) + tamanho > instituicao.armazenamento_mb * 1024 * 1024:
        raise Recusa('A instituição chegou ao limite de armazenamento. Apaga ficheiros antigos ou fala com a equipa EYK.')


def _ficheiro_json(f: FicheiroInstituicao) -> dict:
    return {
        'id': sid(f.id),
        'instituicaoId': sid(f.instituicao_id),
        'nome': f.nome,
        'categoria': f.categoria,
        'tamanhoBytes': f.tamanho_bytes,
        'visibilidade': destino_json(f),
        'temCriancas': f.tem_criancas,
        'estado': f.estado,
        'carregadoPor': f.carregado_por_nome,
        'carregadoPorId': sid(f.carregado_por_id),
        'carregadoEm': f.carregado_em.isoformat(),
        'url': reverse('escola-ficheiro-conteudo', args=[f'srv-{f.instituicao_id}', f'srv-{f.id}']),
    }


def _criancas_sem_fotos(instituicao, destino: dict) -> list[str]:
    atuais = consentimentos_atuais(instituicao)
    alvo = instituicao.alunos.filter(estado=PerfilAluno.ATIVO)
    if destino['dest_tipo'] == 'grupo':
        alvo = alvo.filter(grupo=destino['dest_grupo'])
    elif destino['dest_tipo'] != 'instituicao':
        return []
    return [a.nome for a in alvo if not (atuais.get(a.pk, {}).get('fotografias') and atuais[a.pk]['fotografias'].aceite)]


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, JSONParser])
@com_membro('ver_ficheiros')
def ficheiros(request, membro):
    instituicao = membro.instituicao
    if request.method == 'GET':
        grupos = set(membro.grupos.values_list('pk', flat=True))
        return Response([
            _ficheiro_json(f) for f in instituicao.ficheiros.all()
            if e_destinatario(f, membro, grupos) or f.carregado_por_id == membro.pk
        ])

    if not pode(membro.papel, 'carregar_ficheiros'):
        raise Recusa('O teu papel não permite esta ação.', status.HTTP_403_FORBIDDEN)
    enviado = request.FILES.get('ficheiro')
    if not enviado:
        raise Recusa('Escolhe um ficheiro.')
    categoria = categoria_de(enviado.name)
    if not categoria:
        raise Recusa('Tipo de ficheiro não permitido. Aceitamos documentos, imagens, áudio e vídeo.')
    validar_quota(instituicao, enviado.size)
    try:
        visibilidade = json.loads(request.data.get('visibilidade') or '{}')
    except ValueError:
        raise Recusa('Destinatários inválidos.') from None
    destino = ler_destino(membro, visibilidade)
    tem_criancas = request.data.get('temCriancas') == 'true'
    if tem_criancas:
        faltam = _criancas_sem_fotos(instituicao, destino)
        if faltam:
            n = len(faltam)
            mostrar = ', '.join(faltam[:3]) + ('…' if n > 3 else '')
            raise Recusa(
                f'Não é possível publicar: {n} criança{"" if n == 1 else "s"} do grupo não '
                f'{"tem" if n == 1 else "têm"} consentimento para fotografias ({mostrar}).',
            )
    f = FicheiroInstituicao.objects.create(
        instituicao=instituicao, ficheiro=enviado, nome=enviado.name[:255], categoria=categoria,
        tamanho_bytes=enviado.size, tem_criancas=tem_criancas, carregado_por=membro, carregado_por_nome=_nome(membro),
        **destino,
    )
    extra = ' (com crianças)' if tem_criancas else ''
    auditar(instituicao, 'ficheiro_carregado', f'«{f.nome}»{extra} para {descrever(f)}.', _nome(membro))
    return Response(_ficheiro_json(f), status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
@com_membro()
def ficheiros_uso(request, membro):
    i = membro.instituicao
    return Response({
        'usadoBytes': uso_armazenamento(i),
        'quotaBytes': i.armazenamento_mb * 1024 * 1024,
        'ficheiroMaxBytes': i.ficheiro_max_mb * 1024 * 1024,
    })


def _ficheiro(membro, ficheiro_id) -> FicheiroInstituicao:
    f = membro.instituicao.ficheiros.filter(pk=pid(ficheiro_id)).first()
    if not f:
        raise Recusa('Ficheiro não encontrado.', status.HTTP_404_NOT_FOUND)
    return f


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('carregar_ficheiros')
def ficheiro_detalhe(request, membro, ficheiro_id):
    f = _ficheiro(membro, ficheiro_id)
    if f.carregado_por_id != membro.pk and not pode(membro.papel, 'gerir_membros'):
        raise Recusa('Só quem carregou o ficheiro ou a administração o pode apagar.', status.HTTP_403_FORBIDDEN)
    auditar(membro.instituicao, 'ficheiro_removido', f'«{f.nome}» apagado.', _nome(membro))
    f.ficheiro.delete(save=False)
    f.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('ver_ficheiros')
def ficheiro_conteudo(request, membro, ficheiro_id):
    """A única porta de saída do ficheiro: verifica o acesso a cada pedido."""
    f = _ficheiro(membro, ficheiro_id)
    grupos = set(membro.grupos.values_list('pk', flat=True))
    if not e_destinatario(f, membro, grupos) and f.carregado_por_id != membro.pk:
        raise Recusa('Não tens acesso a este ficheiro.', status.HTTP_403_FORBIDDEN)
    # Um vídeo faz muitos pedidos parciais: só o primeiro conta como abrir.
    if f.tem_criancas and request.headers.get('Range', 'bytes=0-').startswith('bytes=0-'):
        auditar(membro.instituicao, 'ficheiro_aberto', f'«{f.nome}» aberto.', _nome(membro))
    return servir(request, f.ficheiro, f.nome)


# ── Relatório, auditoria e dados ─────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('ver_relatorios')
def relatorio(request, membro):
    return Response(calcular_relatorio(membro.instituicao, timezone.now()))


def _conteudos_mais_usados(instituicao) -> list[dict]:
    usados = instituicao.conteudos.filter(vistas__gt=0).order_by('-vistas')[:4]
    return [{'titulo': c.titulo, 'acessos': c.vistas} for c in usados]


def calcular_relatorio(instituicao, agora) -> dict:
    limite = agora - datetime.timedelta(days=30)
    membros = list(instituicao.membros.filter(estado=MembroInstituicao.ATIVO).prefetch_related('grupos'))
    ativos = {m.pk for m in membros if m.ultimo_acesso and m.ultimo_acesso >= limite}
    atuais = consentimentos_atuais(instituicao)
    # Sem consentimento para relatórios, ou com perfil inativo, a criança não conta.
    # Quem tem conta já conta como membro.
    contaveis = [
        a for a in instituicao.alunos.filter(estado=PerfilAluno.ATIVO, conta__isnull=True)
        if atuais.get(a.pk, {}).get('relatorios') and atuais[a.pk]['relatorios'].aceite
    ]
    por_papel: dict = {}
    for m in membros:
        por_papel[m.papel] = por_papel.get(m.papel, 0) + 1

    acessos = list(instituicao.acessos.filter(dia__gte=(agora - datetime.timedelta(days=84)).date()).values_list('dia', 'membro_id'))
    hoje = agora.date()
    inicio_semana = hoje - datetime.timedelta(days=hoje.weekday())
    semanas = []
    for i in range(11, -1, -1):
        de = inicio_semana - datetime.timedelta(weeks=i)
        ate = de + datetime.timedelta(days=7)
        semanas.append({'semana': de.isoformat(), 'n': sum(1 for dia, _ in acessos if de <= dia < ate)})

    avisos_lista = list(instituicao.avisos.select_related('instituicao'))
    leituras = _leituras(instituicao)
    recebidos = lidos = 0
    for a in avisos_lista:
        ids = {m.pk for m in destinatarios(a)} - {a.autor_id}
        recebidos += len(ids)
        lidos += sum(1 for m in leituras.get(a.pk, {}) if m in ids)

    grupos = []
    dia_limite = limite.date()
    for g in instituicao.grupos.filter(arquivado=False):
        pessoas = [m for m in membros if any(x.pk == g.pk for x in m.grupos.all())]
        ids = {m.pk for m in pessoas}
        total = len(pessoas) + sum(1 for a in contaveis if a.grupo_id == g.pk)
        oculto = total < LIMITE_ANONIMATO
        grupos.append({
            'grupoId': sid(g.id),
            'nome': g.nome,
            'membros': total,
            'ativos30d': None if oculto else len(ids & ativos),
            'acessos30d': None if oculto else sum(1 for dia, m in acessos if m in ids and dia >= dia_limite),
            'oculto': oculto,
        })

    return {
        'geradoEm': agora.isoformat(),
        'definicaoAtivo': DEFINICAO_ATIVO,
        'utilizadores': {'total': len(membros) + len(contaveis), 'ativos30d': len(ativos), 'porPapel': por_papel},
        'acessosPorSemana': semanas,
        'conteudosMaisUsados': _conteudos_mais_usados(instituicao),
        'avisos': {'publicados': len(avisos_lista), 'taxaLeitura': round(lidos / recebidos * 100) if recebidos else None},
        'eventos': {
            'criados': instituicao.eventos.count(),
            'confirmacoes': RespostaEvento.objects.filter(evento__instituicao=instituicao, resposta='vou').count(),
        },
        'grupos': grupos,
    }


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('ver_auditoria')
def auditoria(request, membro):
    return Response([
        {
            'id': sid(r.id),
            'instituicaoId': sid(r.instituicao_id),
            'quando': r.quando.isoformat(),
            'quem': r.quem,
            'origem': r.origem,
            'acao': r.acao,
            'detalhe': r.detalhe,
        }
        for r in membro.instituicao.auditoria.all()[:500]
    ])


def _pedido_dados_json(p: PedidoDados) -> dict:
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
        'ficheiroPronto': False,
        'nota': p.nota or None,
    }


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('pedir_dados')
def pedidos_dados(request, membro):
    instituicao = membro.instituicao
    if request.method == 'GET':
        todos = instituicao.pedidos_dados.all()
        if not pode(membro.papel, 'gerir_pedidos_dados'):
            todos = todos.filter(pedido_por=membro)
        return Response([_pedido_dados_json(p) for p in todos])

    tipo, ambito = request.data.get('tipo'), request.data.get('ambito')
    alvo = (request.data.get('alvo') or '').strip()
    if tipo not in ('exportacao', 'eliminacao') or ambito not in ('crianca', 'familia', 'instituicao') or not alvo:
        raise Recusa('Pedido inválido.')
    if ambito == 'instituicao' and not pode(membro.papel, 'gerir_pedidos_dados'):
        raise Recusa('Só a administração pode pedir os dados da instituição inteira.', status.HTTP_403_FORBIDDEN)
    with transaction.atomic():
        p = PedidoDados.objects.create(
            instituicao=instituicao, tipo=tipo, ambito=ambito, alvo=alvo[:200], pedido_por=membro,
            pedido_por_nome=_nome(membro), prazo=timezone.now() + datetime.timedelta(days=30),
            nota='Antes de eliminar, enviamos uma exportação completa.' if tipo == 'eliminacao' else '',
        )
        nome_tipo = 'Exportação' if tipo == 'exportacao' else 'Eliminação'
        acao = 'dados_exportados' if tipo == 'exportacao' else 'dados_eliminacao_pedida'
        auditar(instituicao, acao, f'{nome_tipo} pedida: {alvo}.', _nome(membro))
    # Estes pedidos são tratados pela equipa EYK dentro do prazo.
    for conta in get_user_model().objects.filter(is_staff=True, is_active=True):
        notificar(
            conta, 'novidade', f'{instituicao.nome}: {nome_tipo.lower()} de dados pedida ({alvo}).',
            link='/configuracoes/administracao/instituicoes', enviar_por_email=False,
        )
    return Response(_pedido_dados_json(p), status=status.HTTP_201_CREATED)
