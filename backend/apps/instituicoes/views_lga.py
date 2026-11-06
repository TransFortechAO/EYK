"""Ensino de LGA nas escolas: turmas, aulas, respostas em vídeo, gestuário, prática, conteúdos,
comunidade da turma, classificações e desafios. Regras de frontend/app/lib/instituicoes/lga.ts."""
import datetime
import re

from django.db import transaction
from django.db.models import F, Q
from django.urls import reverse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import permissions, status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.notificacoes import notificar

from .acesso import Recusa, com_membro, pid, pode, sid
from .armazenamento import categoria_de, servir
from .models import (
    AnexoEscola,
    Aula,
    ConteudoEscola,
    ConviteInstituicao,
    Desafio,
    Gesto,
    GrupoInstituicao,
    MembroInstituicao,
    PerfilAluno,
    PostTurma,
    ProgressoPratica,
    RegistoPratica,
    RespostaVideo,
)
from .servicos import TAMANHO_CODIGO_PARTILHADO, auditar, consentimentos_atuais, gerar_codigo
from .views_comunicacao import avisos_de, eventos_de, validar_quota
from .views_escola import convite_json, grupo_json, membro_json

PONTOS_ACERTO = 2
PONTOS_RESPOSTA_CORRETA = 10
DURACAO_MAX_RESPOSTA_SEG = 90
JANELA_MESTRIA = 10
COMPETENCIAS = ('alfabeto', 'numeros', 'vocabulario', 'frases')
GLYPH_TEMA = {
    'alfabeto': '✋', 'numeros': '🔢', 'saudacoes': '👋', 'escola': '🏫', 'familia': '👪', 'emocoes': '😊',
    'quotidiano': '🏠', 'frases': '💬',
}
ROTULO_PUBLICO = {
    'surdos_l1': 'Alunos surdos (LGA como primeira língua)',
    'ouvintes': 'Ouvintes a aprender LGA',
    'familias': 'Famílias',
    'professores': 'Professores em formação',
}


def _nome(membro) -> str:
    return membro.utilizador.get_display_name()


def _proibido(mensagem: str) -> Recusa:
    return Recusa(mensagem, status.HTTP_403_FORBIDDEN)


def _exigir(membro, acao: str) -> None:
    if not pode(membro.papel, acao):
        raise _proibido('O teu papel não permite esta ação.')


def _grupos(membro) -> set[int]:
    if not hasattr(membro, '_ids_grupos'):
        membro._ids_grupos = set(membro.grupos.values_list('pk', flat=True))
    return membro._ids_grupos


def acede_turma(membro, turma_id) -> bool:
    return turma_id in _grupos(membro) or pode(membro.papel, 'ver_todos_grupos')


def ensina_na_turma(membro, turma_id) -> bool:
    return membro.papel == 'educador' and turma_id in _grupos(membro)


def _gere_turma(membro, turma_id) -> bool:
    return ensina_na_turma(membro, turma_id) or pode(membro.papel, 'gerir_membros')


def fim_ano_letivo(agora) -> datetime.datetime:
    ano = agora.year + 1 if agora.month >= 8 else agora.year
    return datetime.datetime(ano, 7, 31, 23, 59, tzinfo=datetime.UTC)


def competencia_do_tema(tema: str) -> str:
    return tema if tema in ('alfabeto', 'numeros', 'frases') else 'vocabulario'


def _turma(membro, turma_id) -> GrupoInstituicao:
    turma = membro.instituicao.grupos.filter(pk=pid(turma_id), tipo='turma_lga').exclude(lga_publico='').first()
    if not turma:
        raise Recusa('Turma não encontrada.', status.HTTP_404_NOT_FOUND)
    return turma


def _exigir_turma(membro, turma_id) -> GrupoInstituicao:
    _exigir(membro, 'ver_turmas_lga')
    turma = _turma(membro, turma_id)
    if not acede_turma(membro, turma.pk):
        raise _proibido('Não pertences a esta turma.')
    return turma


def _membros_turma(turma):
    return turma.membros.filter(estado=MembroInstituicao.ATIVO).select_related('utilizador').prefetch_related('grupos')


def aprendizes(turma) -> list[MembroInstituicao]:
    membros = list(_membros_turma(turma))
    if turma.lga_publico == 'familias':
        return [m for m in membros if m.papel == 'familia']
    if turma.lga_publico == 'professores':
        autores = set(turma.aulas.values_list('autor_id', flat=True))
        return [m for m in membros if m.papel in ('educador', 'coordenador') and m.pk not in autores]
    return [m for m in membros if m.papel == 'aluno']


# ── Anexos ───────────────────────────────────────────────────────────────────

def anexo_json(a: AnexoEscola | None, instituicao_id: int) -> dict | None:
    if not a:
        return None
    return {
        'id': sid(a.id),
        'nome': a.nome,
        'tamanhoBytes': a.tamanho_bytes,
        'duracaoSeg': a.duracao_seg,
        # Sempre pela escola de quem vê: é aí que o servidor verifica o acesso.
        'url': reverse('escola-anexo', args=[f'srv-{instituicao_id}', f'srv-{a.id}']),
    }


def _anexo_meu(membro, anexo_id) -> AnexoEscola | None:
    """Só se liga a uma aula, resposta ou publicação o que a própria pessoa carregou: de outro
    modo, bastaria citar o id do vídeo de uma criança numa publicação para o conseguir ver."""
    if not anexo_id:
        return None
    anexo = membro.instituicao.anexos.filter(pk=pid(anexo_id), criado_por=membro).first()
    if not anexo:
        raise Recusa('Anexo inválido. Carrega o ficheiro de novo.')
    return anexo


def pode_ver_resposta(membro, r: RespostaVideo) -> bool:
    if r.instituicao_id != membro.instituicao_id:
        return False
    if r.aluno_id == membro.pk or ensina_na_turma(membro, r.turma_id):
        return True
    if membro.papel == 'familia':
        return r.aluno_id in _contas_dos_filhos(membro)
    return False


def _contas_dos_filhos(membro) -> list[int]:
    return list(membro.criancas.filter(conta__isnull=False).values_list('conta_id', flat=True))


def ve_conteudo(membro, c: ConteudoEscola) -> bool:
    if c.instituicao_id != membro.instituicao_id:
        return False
    return c.turma_id is None or acede_turma(membro, c.turma_id)


def pode_ver_anexo(membro, anexo: AnexoEscola) -> bool:
    if anexo.criado_por_id == membro.pk:
        return True
    # Os gestos validados são de todas as escolas.
    for g in anexo.gestos.all():
        if g.estado == 'validado':
            return True
        if g.instituicao_id == membro.instituicao_id and (
            g.proposto_por_id == membro.pk or pode(membro.papel, 'validar_gestos')
        ):
            return True
    if anexo.instituicao_id != membro.instituicao_id:
        return False
    if any(acede_turma(membro, a.turma_id) for a in [*anexo.aulas.all(), *anexo.aulas_recurso.all()]):
        return True
    if any(pode_ver_resposta(membro, r) for r in [*anexo.respostas.all(), *anexo.feedbacks.all()]):
        return True
    return any(ve_conteudo(membro, c) for c in anexo.conteudos.all())


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser])
@com_membro()
def anexos(request, membro):
    instituicao = membro.instituicao
    if not any(
        pode(membro.papel, a)
        for a in ('publicar_aulas', 'responder_aulas', 'rever_respostas', 'propor_gestos', 'publicar_conteudos')
    ):
        raise _proibido('O teu papel não permite esta ação.')
    enviado = request.FILES.get('ficheiro')
    if not enviado:
        raise Recusa('Escolhe um ficheiro.')
    if not categoria_de(enviado.name):
        raise Recusa('Tipo de ficheiro não permitido. Aceitamos documentos, imagens, áudio e vídeo.')
    validar_quota(instituicao, enviado.size)
    duracao = request.data.get('duracaoSeg')
    anexo = AnexoEscola.objects.create(
        instituicao=instituicao, ficheiro=enviado, nome=enviado.name[:255], tamanho_bytes=enviado.size,
        duracao_seg=int(duracao) if str(duracao or '').isdigit() else None, criado_por=membro,
    )
    return Response(anexo_json(anexo, instituicao.pk), status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
@com_membro()
def anexo_conteudo(request, membro, anexo_id):
    anexo = AnexoEscola.objects.filter(pk=pid(anexo_id)).first()
    if not anexo or not pode_ver_anexo(membro, anexo):
        raise _proibido('Não tens acesso a este ficheiro.')
    return servir(request, anexo.ficheiro, anexo.nome)


# ── Turmas ───────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('ver_turmas_lga')
def turmas(request, membro):
    instituicao = membro.instituicao
    if request.method == 'GET':
        lista = []
        minhas = list(RespostaVideo.objects.filter(aluno=membro).values_list('aula_id', 'estado'))
        for t in instituicao.grupos.filter(tipo='turma_lga').exclude(lga_publico=''):
            if not acede_turma(membro, t.pk):
                continue
            quem = aprendizes(t)
            ids = {x.pk for x in quem}
            aulas_turma = list(t.aulas.all())
            pendentes = 0
            if membro.papel == 'aluno':
                feitas = {a for a, e in minhas if e != 'repetir'}
                pendentes = sum(1 for a in aulas_turma if a.pede_resposta and a.pk not in feitas)
            lista.append({
                **grupo_json(t),
                'aprendizes': len(quem),
                'professores': sum(1 for x in _membros_turma(t) if x.papel == 'educador' and x.pk not in ids),
                'aulas': len(aulas_turma),
                'porRever': t.respostas_video.filter(estado='por_rever').count() if ensina_na_turma(membro, t.pk) else 0,
                'pendentes': pendentes,
            })
        return Response(lista)

    _exigir(membro, 'gerir_turmas_lga')
    dados = request.data
    nome = (dados.get('nome') or '').strip()
    publico = dados.get('publico')
    if not nome:
        raise Recusa('Dá um nome à turma.')
    if publico not in ROTULO_PUBLICO or dados.get('nivel') not in ('iniciacao', 'intermedio', 'avancado'):
        raise Recusa('Turma inválida.')
    agora = timezone.now()

    def codigo(papel: str, grupo) -> ConviteInstituicao:
        # Os códigos das turmas duram o ano letivo inteiro (para entregar em papel).
        return ConviteInstituicao.objects.create(
            instituicao=instituicao, canal='codigo', codigo=gerar_codigo(TAMANHO_CODIGO_PARTILHADO), papel=papel,
            grupo=grupo, usos_max=60, criado_por=request.user, expira_em=fim_ano_letivo(agora),
        )

    with transaction.atomic():
        turma = GrupoInstituicao.objects.create(
            instituicao=instituicao, nome=nome, tipo='turma_lga', ano_letivo=(dados.get('anoLetivo') or '').strip(),
            lga_publico=publico, lga_nivel=dados['nivel'], lga_descricao=(dados.get('descricao') or '').strip(),
        )
        if publico != 'familias':
            turma.convite_alunos = codigo('educador' if publico == 'professores' else 'aluno', turma)
        if publico != 'professores':
            turma.convite_familias = codigo('familia', turma)
        turma.save(update_fields=['convite_alunos', 'convite_familias'])
        membro.grupos.add(turma)
        auditar(instituicao, 'turma_criada', f'«{turma.nome}» ({ROTULO_PUBLICO[publico]}).', _nome(membro))
    return Response(grupo_json(turma), status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
@com_membro()
def turma_detalhe(request, membro, turma_id):
    turma = _exigir_turma(membro, turma_id)
    membros = list(_membros_turma(turma))
    lista = aprendizes(turma)
    ids = {x.pk for x in lista}
    pode_codigos = _gere_turma(membro, turma.pk)

    def convite(c):
        return convite_json(c) if pode_codigos and c else None

    return Response({
        'turma': grupo_json(turma),
        'professores': [membro_json(x) for x in membros if x.papel == 'educador' and x.pk not in ids],
        'aprendizes': [] if membro.papel in ('aluno', 'familia') else [membro_json(x) for x in lista],
        'familias': [] if membro.papel == 'aluno' else [
            membro_json(x) for x in membros if x.papel == 'familia' and x.pk not in ids
        ],
        'codigos': {'alunos': convite(turma.convite_alunos), 'familias': convite(turma.convite_familias)},
        'ensino': ensina_na_turma(membro, turma.pk),
    })


# ── Aulas ────────────────────────────────────────────────────────────────────

def aula_json(a: Aula, instituicao_id: int) -> dict:
    return {
        'id': sid(a.id),
        'instituicaoId': sid(a.instituicao_id),
        'turmaId': sid(a.turma_id),
        'tipo': a.tipo,
        'titulo': a.titulo,
        'descricao': a.descricao,
        'video': anexo_json(a.video, instituicao_id),
        'legendaPt': a.legenda_pt,
        'gestosIds': a.gestos_ids,
        'recursos': [anexo_json(r, instituicao_id) for r in a.recursos.all()],
        'conteudo': a.conteudo,
        'prazo': a.prazo.isoformat() if a.prazo else None,
        'pedeResposta': a.pede_resposta,
        'enunciado': a.enunciado,
        'autor': a.autor_nome,
        'autorId': sid(a.autor_id),
        'publicadaEm': a.publicada_em.isoformat(),
    }


def resposta_json(r: RespostaVideo, instituicao_id: int) -> dict:
    feedback = None
    if r.feedback_em:
        feedback = {
            'texto': r.feedback_texto,
            'video': anexo_json(r.feedback_video, instituicao_id),
            'por': r.feedback_por,
            'em': r.feedback_em.isoformat(),
        }
    return {
        'id': sid(r.id),
        'instituicaoId': sid(r.instituicao_id),
        'turmaId': sid(r.turma_id),
        'aulaId': sid(r.aula_id),
        'alunoId': sid(r.aluno_id),
        'alunoNome': r.aluno_nome,
        'video': anexo_json(r.video, instituicao_id),
        'enviadaEm': r.enviada_em.isoformat(),
        'estado': r.estado,
        'feedback': feedback,
        'apagarEm': r.apagar_em.isoformat(),
        'tentativa': r.tentativa,
    }


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro()
def turma_aulas(request, membro, turma_id):
    instituicao = membro.instituicao
    if request.method == 'GET':
        turma = _exigir_turma(membro, turma_id)
        professor = ensina_na_turma(membro, turma.pk)
        lista = []
        for a in turma.aulas.select_related('video').prefetch_related('recursos', 'respostas'):
            daqui = list(a.respostas.all())
            minhas = [r for r in daqui if r.aluno_id == membro.pk]
            lista.append({
                **aula_json(a, instituicao.pk),
                'minhaResposta': resposta_json(minhas[0], instituicao.pk) if minhas else None,
                'respostas': {
                    'total': len({r.aluno_id for r in daqui}),
                    'porRever': sum(1 for r in daqui if r.estado == 'por_rever'),
                } if professor else None,
            })
        return Response(lista)

    _exigir(membro, 'publicar_aulas')
    turma = _turma(membro, turma_id)
    if not _gere_turma(membro, turma.pk):
        raise _proibido('Só quem ensina nesta turma pode publicar aulas.')
    d = request.data
    titulo = (d.get('titulo') or '').strip()
    tipo = d.get('tipo')
    video = _anexo_meu(membro, d.get('videoId'))
    pede_resposta = bool(d.get('pedeResposta'))
    enunciado = (d.get('enunciado') or '').strip()
    if tipo not in ('aula', 'atribuicao'):
        raise Recusa('Aula inválida.')
    if not titulo:
        raise Recusa('Dá um título à aula.')
    if tipo == 'aula' and not video:
        raise Recusa('Carrega o vídeo sinalizado da aula.')
    if tipo == 'atribuicao' and not d.get('conteudo'):
        raise Recusa('Escolhe o curso ou vídeo a atribuir.')
    if pede_resposta and not enunciado:
        raise Recusa('Escreve o que o aluno deve gravar.')
    prazo = parse_datetime(d['prazo']) if d.get('prazo') else None
    if prazo and timezone.is_naive(prazo):
        prazo = timezone.make_aware(prazo)
    aula = Aula.objects.create(
        instituicao=instituicao, turma=turma, tipo=tipo, titulo=titulo, descricao=(d.get('descricao') or '').strip(),
        video=video, legenda_pt=bool(d.get('legendaPt')), gestos_ids=[str(g) for g in d.get('gestosIds') or []],
        conteudo=d.get('conteudo'), prazo=prazo, pede_resposta=pede_resposta, enunciado=enunciado if pede_resposta else '',
        autor=membro, autor_nome=_nome(membro),
    )
    aula.recursos.set([_anexo_meu(membro, r) for r in d.get('recursosIds') or []])
    auditar(instituicao, 'aula_publicada', f'«{aula.titulo}» em {turma.nome}.', _nome(membro))
    return Response(aula_json(aula, instituicao.pk), status=status.HTTP_201_CREATED)


def conteudo_json(c: ConteudoEscola, instituicao_id: int) -> dict:
    ambito = {'tipo': 'instituicao', 'instituicaoId': sid(c.instituicao_id)}
    if c.turma_id:
        ambito = {'tipo': 'turma', 'instituicaoId': sid(c.instituicao_id), 'turmaId': sid(c.turma_id)}
    return {
        'id': sid(c.id),
        'instituicaoId': sid(c.instituicao_id),
        'tipo': c.tipo,
        'titulo': c.titulo,
        'descricao': c.descricao,
        'autor': c.autor_nome,
        'autorId': sid(c.autor_id),
        'ambito': ambito,
        'duracaoMin': c.duracao_min,
        'aulas': c.aulas,
        'temLegendas': c.tem_legendas,
        'emLga': c.em_lga,
        'video': anexo_json(c.video, instituicao_id),
        'publicadoEm': c.publicado_em.isoformat(),
        'vistas': c.vistas,
        'propostaPublica': c.proposta_publica,
    }


def gesto_json(g: Gesto, instituicao_id: int) -> dict:
    validacao = None
    if g.validacao_em:
        validacao = {'por': g.validacao_por, 'em': g.validacao_em.isoformat(), 'nota': g.validacao_nota}
    return {
        'id': sid(g.id),
        'palavra': g.palavra,
        'tema': g.tema,
        'variante': g.variante,
        'descricao': g.descricao,
        'glyph': g.glyph,
        'motion': 'static',
        'video': anexo_json(g.video, instituicao_id),
        'estado': g.estado,
        'instituicaoId': sid(g.instituicao_id),
        'propostoPor': g.proposto_por_nome,
        'propostoEm': g.proposto_em.isoformat(),
        'validacao': validacao,
    }


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
@com_membro()
def aula_detalhe(request, membro, aula_id):
    aula = membro.instituicao.aulas.select_related('video').filter(pk=pid(aula_id)).first()
    if not aula:
        raise Recusa('Aula não encontrada.', status.HTTP_404_NOT_FOUND)
    turma = _exigir_turma(membro, aula.turma_id)
    i = membro.instituicao_id
    conteudo = None
    if (aula.conteudo or {}).get('origem') == 'escola':
        c = membro.instituicao.conteudos.filter(pk=pid(aula.conteudo.get('id'))).first()
        conteudo = conteudo_json(c, i) if c else None
    ids = [pid(g) for g in aula.gestos_ids if str(g).startswith('srv-')]
    return Response({
        'aula': aula_json(aula, i),
        'turma': grupo_json(turma),
        # Os gestos da plataforma resolvem-se no frontend, a partir de gestosIds.
        'gestos': [gesto_json(g, i) for g in Gesto.objects.filter(pk__in=ids)],
        'conteudo': conteudo,
        'ensino': ensina_na_turma(membro, turma.pk),
    })


# ── Respostas em vídeo ───────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
@com_membro()
def respostas(request, membro):
    todas = membro.instituicao.respostas_video.select_related('video', 'feedback_video')
    if request.query_params.get('turmaId'):
        todas = todas.filter(turma_id=pid(request.query_params['turmaId']))
    if request.query_params.get('aulaId'):
        todas = todas.filter(aula_id=pid(request.query_params['aulaId']))
    return Response([resposta_json(r, membro.instituicao_id) for r in todas if pode_ver_resposta(membro, r)])


def _pode_responder(membro) -> tuple[bool, str | None]:
    if not pode(membro.papel, 'responder_aulas'):
        return False, 'Só os alunos enviam respostas.'
    perfil = PerfilAluno.objects.filter(conta=membro).first()
    if not perfil:
        return True, None
    consentimento = consentimentos_atuais(membro.instituicao).get(perfil.pk, {}).get('respostas_video')
    if not consentimento or not consentimento.aceite:
        return False, (
            'A tua família ainda não autorizou as respostas em vídeo. '
            'Pede-lhes para o fazer em Instituição → Consentimentos.'
        )
    return True, None


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
@com_membro()
def resposta_pode(request, membro):
    sim, motivo = _pode_responder(membro)
    return Response({'pode': sim, 'motivo': motivo})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro()
def aula_responder(request, membro, aula_id):
    sim, motivo = _pode_responder(membro)
    if not sim:
        raise _proibido(motivo or 'Não podes enviar respostas.')
    aula = membro.instituicao.aulas.filter(pk=pid(aula_id), pede_resposta=True).first()
    if not aula:
        raise Recusa('Esta aula não pede resposta.')
    if aula.turma_id not in _grupos(membro):
        raise _proibido('Não pertences a esta turma.')
    video = _anexo_meu(membro, request.data.get('videoId'))
    if not video:
        raise Recusa('Grava ou escolhe o vídeo da resposta.')
    if video.duracao_seg and video.duracao_seg > DURACAO_MAX_RESPOSTA_SEG:
        raise Recusa(f'A resposta pode ter até {DURACAO_MAX_RESPOSTA_SEG} segundos. Grava só o que foi pedido.')
    with transaction.atomic():
        anteriores = list(RespostaVideo.objects.select_for_update().filter(aula=aula, aluno=membro))
        if any(r.estado == 'por_rever' for r in anteriores):
            raise Recusa('A tua resposta ainda está à espera do professor.')
        if any(r.estado == 'correto' for r in anteriores):
            raise Recusa('Esta resposta já está correta.')
        r = RespostaVideo.objects.create(
            instituicao=membro.instituicao, turma=aula.turma, aula=aula, aluno=membro, aluno_nome=_nome(membro),
            video=video, apagar_em=fim_ano_letivo(timezone.now()), tentativa=len(anteriores) + 1,
        )
    return Response(resposta_json(r, membro.instituicao_id), status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('rever_respostas')
def resposta_feedback(request, membro, resposta_id):
    r = membro.instituicao.respostas_video.select_related('aluno__utilizador', 'video').filter(pk=pid(resposta_id)).first()
    if not r:
        raise Recusa('Resposta não encontrada.', status.HTTP_404_NOT_FOUND)
    if not ensina_na_turma(membro, r.turma_id):
        raise _proibido('Só quem ensina nesta turma corrige as respostas.')
    estado = request.data.get('estado')
    texto = (request.data.get('texto') or '').strip()
    video = _anexo_meu(membro, request.data.get('videoId'))
    if estado not in ('correto', 'repetir'):
        raise Recusa('Estado inválido.')
    if estado == 'repetir' and not texto and not video:
        raise Recusa('Explica ao aluno o que deve corrigir.')
    primeira_vez = r.estado != 'correto' and estado == 'correto'
    r.estado, r.feedback_texto, r.feedback_video = estado, texto, video
    r.feedback_por, r.feedback_em = _nome(membro), timezone.now()
    r.save()
    if primeira_vez:
        MembroInstituicao.objects.filter(pk=r.aluno_id).update(pontos=F('pontos') + PONTOS_RESPOSTA_CORRETA)
    auditar(
        membro.instituicao, 'resposta_revista', f'Resposta (tentativa {r.tentativa}) marcada como «{estado}».',
        _nome(membro),
    )
    notificar(
        r.aluno.utilizador, 'novidade', f'O professor reviu a tua resposta em «{r.aula.titulo}».',
        link=f'/instituicao/turmas/srv-{r.turma_id}/aulas/srv-{r.aula_id}', enviar_por_email=False,
    )
    return Response(resposta_json(r, membro.instituicao_id))


# ── Gestuário ────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def gestos_validados(request):
    """Contributos das escolas já validados, para a Biblioteca LGA."""
    return Response([
        {**gesto_json(g, g.instituicao_id), 'video': None}
        for g in Gesto.objects.select_related('video').filter(estado='validado')
    ])


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro()
def gestos(request, membro):
    instituicao = membro.instituicao
    if request.method == 'GET':
        visiveis = Q(estado='validado')
        if pode(membro.papel, 'validar_gestos'):
            visiveis |= Q(instituicao=instituicao)
        else:
            visiveis |= Q(instituicao=instituicao, proposto_por=membro)
        return Response([gesto_json(g, instituicao.pk) for g in Gesto.objects.select_related('video').filter(visiveis)])

    _exigir(membro, 'propor_gestos')
    d = request.data
    palavra = (d.get('palavra') or '').strip()
    descricao = (d.get('descricao') or '').strip()
    video = _anexo_meu(membro, d.get('videoId'))
    if not palavra:
        raise Recusa('Escreve a palavra ou frase.')
    if not video and not descricao:
        raise Recusa('Grava o gesto em vídeo ou descreve-o.')
    if d.get('tema') not in GLYPH_TEMA:
        raise Recusa('Tema inválido.')
    g = Gesto.objects.create(
        instituicao=instituicao, palavra=palavra, tema=d['tema'], variante=(d.get('variante') or '').strip() or 'Comum',
        descricao=descricao, glyph=GLYPH_TEMA[d['tema']], video=video, proposto_por=membro,
        proposto_por_nome=_nome(membro),
    )
    auditar(instituicao, 'gesto_proposto', f'«{g.palavra}» ({g.variante}).', _nome(membro))
    return Response(gesto_json(g, instituicao.pk), status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('validar_gestos')
def gesto_validar(request, membro, gesto_id):
    g = membro.instituicao.gestos.filter(pk=pid(gesto_id)).first()
    if not g:
        raise Recusa('Gesto não encontrado.', status.HTTP_404_NOT_FOUND)
    if g.estado != 'proposto':
        raise Recusa('Este gesto já foi revisto.')
    if g.proposto_por_id == membro.pk:
        raise _proibido('Outra pessoa tem de validar o gesto que propuseste.')
    aprovar = bool(request.data.get('aprovar'))
    nota = (request.data.get('nota') or '').strip()
    if not aprovar and not nota:
        raise Recusa('Explica porque rejeitas, para quem propôs poder corrigir.')
    g.estado = 'validado' if aprovar else 'rejeitado'
    g.validacao_por, g.validacao_em, g.validacao_nota = _nome(membro), timezone.now(), nota
    g.save()
    auditar(membro.instituicao, 'gesto_validado', f'«{g.palavra}» ({g.variante}) {g.estado}.', _nome(membro))
    return Response(gesto_json(g, membro.instituicao_id))


# ── Prática ──────────────────────────────────────────────────────────────────

def _mestria(recentes: list) -> int:
    return round(sum(1 for x in recentes if x) / len(recentes) * 100) if recentes else 0


def _nivel(p: ProgressoPratica | None) -> str:
    if not p or p.tentativas == 0:
        return 'por_comecar'
    m = _mestria(p.recentes)
    if m >= 80 and len(p.recentes) >= JANELA_MESTRIA:
        return 'dominado'
    return 'a_progredir' if m >= 50 else 'a_comecar'


def _progresso_desafio(d: Desafio, membro) -> int:
    registos = RegistoPratica.objects.filter(membro=membro, certo=True, competencia=d.competencia, em__gte=d.criado_em)
    if d.tema:
        registos = registos.filter(tema=d.tema)
    return registos.count()


def desafio_json(d: Desafio) -> dict:
    return {
        'id': sid(d.id),
        'instituicaoId': sid(d.instituicao_id),
        'turmaId': sid(d.turma_id),
        'titulo': d.titulo,
        'descricao': d.descricao,
        'competencia': d.competencia,
        'tema': d.tema or None,
        'meta': d.meta,
        'recompensa': d.recompensa,
        'terminaEm': d.termina_em.isoformat(),
        'criadoPor': d.criado_por,
    }


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('praticar')
def pratica(request, membro):
    competencia, tema = request.data.get('competencia'), request.data.get('tema')
    certo = bool(request.data.get('certo'))
    if competencia not in COMPETENCIAS or tema not in GLYPH_TEMA:
        raise Recusa('Exercício inválido.')
    pontos = PONTOS_ACERTO if certo else 0
    concluidos = []
    with transaction.atomic():
        prog, _ = ProgressoPratica.objects.select_for_update().get_or_create(membro=membro, competencia=competencia)
        prog.tentativas += 1
        prog.acertos += 1 if certo else 0
        prog.recentes = [*prog.recentes, certo][-JANELA_MESTRIA:]
        prog.save()
        RegistoPratica.objects.create(membro=membro, competencia=competencia, tema=tema, certo=certo)
        if certo:
            ativos = membro.instituicao.desafios.filter(termina_em__gte=timezone.now()).exclude(concluido_por=membro)
            for d in ativos:
                if d.turma_id and d.turma_id not in _grupos(membro):
                    continue
                if _progresso_desafio(d, membro) >= d.meta:
                    d.concluido_por.add(membro)
                    pontos += d.recompensa
                    concluidos.append(d)
        if pontos:
            MembroInstituicao.objects.filter(pk=membro.pk).update(pontos=F('pontos') + pontos)
    return Response({'pontos': pontos, 'desafiosConcluidos': [desafio_json(d) for d in concluidos]})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('praticar')
def meu_progresso(request, membro):
    prog = {p.competencia: p for p in membro.progresso.all()}

    def comp(c):
        p = prog.get(c)
        return {'mestria': _mestria(p.recentes) if p else 0, 'nivel': _nivel(p), 'tentativas': p.tentativas if p else 0}

    return Response({'competencias': {c: comp(c) for c in COMPETENCIAS}, 'pontos': membro.pontos})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
@com_membro()
def turma_progresso(request, membro, turma_id):
    turma = _exigir_turma(membro, turma_id)
    if not ensina_na_turma(membro, turma.pk) and not pode(membro.papel, 'ver_todos_grupos'):
        raise _proibido('Só quem ensina na turma vê o progresso de cada aluno.')
    alunos = []
    for a in aprendizes(turma):
        prog = {p.competencia: p for p in a.progresso.all()}
        alunos.append({
            'id': sid(a.id),
            'nome': _nome(a),
            'competencias': {c: _mestria(prog[c].recentes) if c in prog else 0 for c in COMPETENCIAS},
            'respostasCorretas': turma.respostas_video.filter(aluno=a, estado='correto').count(),
        })
    media = {
        c: round(sum(a['competencias'][c] for a in alunos) / len(alunos)) if alunos else 0 for c in COMPETENCIAS
    }
    return Response({'alunos': alunos, 'media': media})


# ── Conteúdos da escola ──────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro()
def conteudos(request, membro):
    instituicao = membro.instituicao
    if request.method == 'GET':
        todos = instituicao.conteudos.select_related('video')
        if request.query_params.get('tipo'):
            todos = todos.filter(tipo=request.query_params['tipo'])
        return Response([conteudo_json(c, instituicao.pk) for c in todos if ve_conteudo(membro, c)])

    _exigir(membro, 'publicar_conteudos')
    d = request.data
    titulo = (d.get('titulo') or '').strip()
    ambito = d.get('ambito') or {}
    if not titulo:
        raise Recusa('Dá um título ao conteúdo.')
    if d.get('tipo') not in ('curso', 'video') or pid(ambito.get('instituicaoId')) != instituicao.pk:
        raise Recusa('Âmbito inválido.')
    turma = None
    if ambito.get('tipo') == 'turma':
        turma = _turma(membro, ambito.get('turmaId'))
        if not _gere_turma(membro, turma.pk):
            raise _proibido('Só podes publicar para as turmas onde ensinas.')
    elif ambito.get('tipo') != 'instituicao':
        raise Recusa('Âmbito inválido.')
    c = ConteudoEscola.objects.create(
        instituicao=instituicao, tipo=d['tipo'], titulo=titulo, descricao=(d.get('descricao') or '').strip(), autor=membro,
        autor_nome=_nome(membro), turma=turma, duracao_min=max(int(d.get('duracaoMin') or 0), 0),
        aulas=max(int(d.get('aulas') or 0), 0), tem_legendas=bool(d.get('temLegendas')), em_lga=bool(d.get('emLga')),
        video=_anexo_meu(membro, d.get('videoId')),
    )
    onde = 'só a turma' if turma else 'toda a escola'
    auditar(instituicao, 'conteudo_publicado', f'«{c.titulo}» ({onde}).', _nome(membro))
    return Response(conteudo_json(c, instituicao.pk), status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
@com_membro()
def conteudo_detalhe(request, membro, conteudo_id):
    c = membro.instituicao.conteudos.select_related('video').filter(pk=pid(conteudo_id)).first()
    if not c or not ve_conteudo(membro, c):
        raise _proibido('Este conteúdo é só para os membros da escola ou da turma.')
    ConteudoEscola.objects.filter(pk=c.pk).update(vistas=F('vistas') + 1)
    c.vistas += 1
    return Response(conteudo_json(c, membro.instituicao_id))


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('publicar_conteudos')
def conteudo_propor(request, membro, conteudo_id):
    c = membro.instituicao.conteudos.select_related('video').filter(pk=pid(conteudo_id)).first()
    if not c:
        raise Recusa('Conteúdo não encontrado.', status.HTTP_404_NOT_FOUND)
    if c.autor_id != membro.pk and not pode(membro.papel, 'gerir_membros'):
        raise _proibido('Só quem publicou ou a administração pode propor.')
    if c.proposta_publica in ('pendente', 'aceite'):
        raise Recusa('Já foi proposto.')
    c.proposta_publica = 'pendente'
    c.save(update_fields=['proposta_publica'])
    return Response(conteudo_json(c, membro.instituicao_id))


@api_view(['GET'])
@permission_classes([permissions.IsAdminUser])
def admin_propostas(request):
    pendentes = ConteudoEscola.objects.select_related('instituicao', 'video').filter(proposta_publica='pendente')
    return Response([{**conteudo_json(c, c.instituicao_id), 'escola': c.instituicao.nome} for c in pendentes])


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def admin_proposta_decidir(request, conteudo_id):
    c = ConteudoEscola.objects.select_related('instituicao').filter(pk=conteudo_id, proposta_publica='pendente').first()
    if not c:
        raise Recusa('Proposta não encontrada ou já decidida.', status.HTTP_404_NOT_FOUND)
    aceitar = bool(request.data.get('aceitar'))
    c.proposta_publica = 'aceite' if aceitar else 'recusada'
    c.save(update_fields=['proposta_publica'])
    decisao = 'aceite' if aceitar else 'recusado'
    auditar(c.instituicao, 'conteudo_publicado', f'«{c.titulo}» {decisao} para a plataforma geral.', 'Equipa EYK', 'equipa_eyk')
    return Response({'ok': True})


# ── Comunidade da turma ──────────────────────────────────────────────────────

def _post_json(p: PostTurma) -> dict:
    return {
        'id': sid(p.id),
        'instituicaoId': sid(p.instituicao_id),
        'turmaId': sid(p.turma_id),
        'autorId': sid(p.autor_id),
        'autorNome': p.autor_nome,
        'papel': p.papel,
        'texto': p.texto,
        'gestoId': p.gesto_id or None,
        'criadoEm': p.criado_em.isoformat(),
        'estado': p.estado,
    }


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro()
def turma_posts(request, membro, turma_id):
    if request.method == 'GET':
        turma = _exigir_turma(membro, turma_id)
        todos = turma.posts.all()
        if not _gere_turma(membro, turma.pk):
            todos = todos.filter(Q(estado='visivel') | Q(autor=membro))
        return Response([_post_json(p) for p in todos])

    _exigir(membro, 'publicar_na_turma')
    turma = _turma(membro, turma_id)
    if turma.pk not in _grupos(membro):
        raise _proibido('Só os membros da turma publicam aqui.')
    texto = (request.data.get('texto') or '').strip()
    if not texto:
        raise Recusa('Escreve alguma coisa.')
    if len(texto) > 500:
        raise Recusa('No máximo 500 caracteres.')
    if membro.papel == 'aluno' and re.search(r'https?://', texto, re.IGNORECASE):
        raise Recusa('Os alunos não podem publicar links na turma.')
    p = PostTurma.objects.create(
        instituicao=membro.instituicao, turma=turma, autor=membro, autor_nome=_nome(membro), papel=membro.papel,
        texto=texto, gesto_id=str(request.data.get('gestoId') or '')[:40],
    )
    return Response(_post_json(p), status=status.HTTP_201_CREATED)


def _post(membro, post_id) -> PostTurma:
    p = membro.instituicao.posts_turma.filter(pk=pid(post_id)).first()
    if not p:
        raise Recusa('Publicação não encontrada.', status.HTTP_404_NOT_FOUND)
    return p


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro('moderar_turma')
def post_moderar(request, membro, post_id):
    p = _post(membro, post_id)
    if not _gere_turma(membro, p.turma_id):
        raise _proibido('Só quem ensina na turma modera as publicações.')
    visivel = bool(request.data.get('visivel'))
    p.estado = 'visivel' if visivel else 'oculto'
    p.save(update_fields=['estado'])
    if not visivel:
        auditar(membro.instituicao, 'post_turma_oculto', f'Publicação de {p.autor_nome} escondida.', _nome(membro))
    return Response({'ok': True})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro()
def post_denunciar(request, membro, post_id):
    """Qualquer membro denuncia: a publicação deixa de se ver até o professor rever."""
    p = _post(membro, post_id)
    if not acede_turma(membro, p.turma_id):
        raise Recusa('Publicação não encontrada.', status.HTTP_404_NOT_FOUND)
    if p.estado == 'visivel':
        p.estado = 'denunciado'
        p.save(update_fields=['estado'])
    return Response({'ok': True})


# ── Classificações, desafios e resumo ────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
@com_membro()
def classificacao(request, membro):
    if not membro.instituicao.ranking_visivel:
        raise Recusa('A escola desligou as classificações.')
    turma_id = request.query_params.get('turmaId')
    if turma_id:
        participantes = aprendizes(_exigir_turma(membro, turma_id))
    else:
        participantes = list(membro.instituicao.membros.filter(
            estado=MembroInstituicao.ATIVO, papel='aluno',
        ).select_related('utilizador'))
    linhas = sorted(
        ({'nome': _nome(x).split(' ')[0], 'pontos': x.pontos, 'eu': x.pk == membro.pk} for x in participantes),
        key=lambda l: (-l['pontos'], l['nome']),
    )
    return Response({
        'linhas': [{'posicao': i + 1, **l} for i, l in enumerate(linhas)],
        'participantes': len(participantes),
    })


def desafios_de(membro) -> list[dict]:
    feitos = set(membro.desafios_concluidos.values_list('pk', flat=True))
    return [
        {
            **desafio_json(d),
            'progresso': min(d.meta, _progresso_desafio(d, membro)),
            'concluido': d.pk in feitos,
            'turmaNome': d.turma.nome if d.turma else None,
        }
        for d in membro.instituicao.desafios.select_related('turma')
        if not d.turma_id or acede_turma(membro, d.turma_id)
    ]


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
@com_membro()
def desafios(request, membro):
    if request.method == 'GET':
        return Response(desafios_de(membro))
    _exigir(membro, 'criar_desafios')
    d = request.data
    titulo = (d.get('titulo') or '').strip()
    try:
        meta, recompensa, dias = int(d.get('meta') or 0), int(d.get('recompensa') or 0), int(d.get('dias') or 1)
    except (TypeError, ValueError):
        raise Recusa('Desafio inválido.') from None
    competencia, tema = d.get('competencia'), d.get('tema') or ''
    if not titulo:
        raise Recusa('Dá um título ao desafio.')
    if meta < 1 or meta > 200:
        raise Recusa('A meta tem de estar entre 1 e 200.')
    if competencia not in COMPETENCIAS:
        raise Recusa('Competência inválida.')
    if tema and competencia_do_tema(tema) != competencia:
        raise Recusa('O tema não pertence a esta competência.')
    turma = _turma(membro, d['turmaId']) if d.get('turmaId') else None
    if turma and not _gere_turma(membro, turma.pk):
        raise _proibido('Só para as turmas onde ensinas.')
    desafio = Desafio.objects.create(
        instituicao=membro.instituicao, turma=turma, titulo=titulo, descricao=(d.get('descricao') or '').strip(),
        competencia=competencia, tema=tema, meta=meta, recompensa=max(0, min(200, recompensa)),
        termina_em=timezone.now() + datetime.timedelta(days=max(1, min(30, dias))), criado_por=_nome(membro),
    )
    return Response(desafio_json(desafio), status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT'])
@permission_classes([permissions.IsAuthenticated])
@com_membro()
def ver_geral(request, membro):
    """O aluno vê só o que a escola publicou, a não ser que escolha ver também a plataforma geral."""
    if request.method == 'PUT':
        if membro.papel != 'aluno':
            raise Recusa('Esta opção é só para alunos.')
        membro.ver_geral = bool(request.data.get('ver'))
        membro.save(update_fields=['ver_geral'])
    return Response({'ver': membro.papel != 'aluno' or membro.ver_geral})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
@com_membro()
def resumo(request, membro):
    i = membro.instituicao_id
    agora = timezone.now()
    semana = agora - datetime.timedelta(days=7)
    turmas_minhas = list(membro.grupos.filter(tipo='turma_lga').exclude(lga_publico=''))
    nomes = {t.pk: t.nome for t in turmas_minhas}
    aulas = list(
        Aula.objects.select_related('video').prefetch_related('recursos').filter(turma__in=turmas_minhas)
    )
    minhas = list(membro.respostas_video.select_related('video', 'feedback_video'))
    tarefas = []
    if membro.papel == 'aluno':
        for a in aulas:
            if not a.pede_resposta:
                continue
            ultima = next((r for r in minhas if r.aula_id == a.pk), None)
            estado = 'por_fazer' if not ultima else ('repetir' if ultima.estado == 'repetir' else None)
            if estado:
                tarefas.append({'aula': aula_json(a, i), 'turma': nomes[a.turma_id], 'estado': estado})
    por_rever = 0
    if membro.papel == 'educador':
        por_rever = membro.instituicao.respostas_video.filter(estado='por_rever', turma__in=turmas_minhas).count()
    avisos = avisos_de(membro) if pode(membro.papel, 'ver_avisos') else []
    eventos = eventos_de(membro) if pode(membro.papel, 'ver_agenda') else []
    agora_txt = agora.isoformat()
    return Response({
        'tarefas': tarefas,
        'aulasNovas': [
            {'aula': aula_json(a, i), 'turma': nomes[a.turma_id]} for a in aulas if a.publicada_em >= semana
        ],
        'porRever': por_rever,
        'feedbackNovo': [resposta_json(r, i) for r in minhas if r.feedback_em and r.feedback_em >= semana],
        'desafios': [d for d in desafios_de(membro) if not d['concluido'] and d['terminaEm'] > agora_txt],
        'avisosPorLer': sum(1 for a in avisos if not a['lidoPorMim'] and a['autorId'] != sid(membro.pk)),
        'proximoEvento': next((e for e in eventos if not e['cancelado'] and e['inicio'] > agora_txt), None),
    })
