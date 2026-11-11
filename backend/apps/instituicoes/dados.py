"""Direitos sobre os dados: exportação (ZIP gerado na hora, nunca guardado) e eliminação.
Eliminar é irreversível: só corre depois de alguém confirmar (ver views_dados)."""
import json
import logging
import os
import tempfile
import zipfile

from django.core.serializers.json import DjangoJSONEncoder
from django.utils import timezone

from .models import (
    AnexoEscola,
    ComentarioTurma,
    ConviteInstituicao,
    GostoTurma,
    MembroInstituicao,
    PedidoAdesao,
    PerfilAluno,
    RegistoAuditoria,
    RespostaEvento,
    RespostaVideo,
)

logger = logging.getLogger(__name__)

NOME_CRIANCA_ELIMINADA = 'Criança eliminada'
NOME_PESSOA_ELIMINADA = 'Pessoa eliminada'


def _tabela(consulta, *excluir: str) -> list[dict]:
    return [{k: v for k, v in linha.items() if k not in excluir} for linha in consulta.values()]


def _anexos_de_respostas(respostas) -> list[AnexoEscola]:
    anexos = []
    for r in respostas.select_related('video', 'feedback_video'):
        anexos.extend(a for a in (r.video, r.feedback_video) if a)
    return anexos


def _dados_membro(membro: MembroInstituicao) -> dict:
    return {
        'membro': {
            'nome': membro.utilizador.get_display_name(),
            'email': membro.utilizador.email,
            'papel': membro.papel,
            'desde': membro.desde,
            'ultimo_acesso': membro.ultimo_acesso,
            'grupos': list(membro.grupos.values_list('nome', flat=True)),
            'pontos': membro.pontos,
        },
        'publicacoes': _tabela(membro.posts_turma.all()),
        'comentarios': _tabela(membro.comentarios_turma.all()),
        'respostas_em_video': _tabela(membro.respostas_video.all()),
        'progresso': _tabela(membro.progresso.all()),
        'pratica': _tabela(membro.registos_pratica.all()),
        'presencas': _tabela(RespostaEvento.objects.filter(membro=membro)),
        'salvos': _tabela(membro.salvos.all()),
    }


def conteudo_da_exportacao(pedido) -> tuple[dict, list]:
    """Os dados (JSON) e os ficheiros de um pedido: [(caminho no ZIP, campo do ficheiro)]."""
    instituicao = pedido.instituicao
    if pedido.ambito == 'crianca':
        a = pedido.aluno
        dados: dict = {
            'crianca': {
                'nome': a.nome,
                'grupo': a.grupo.nome if a.grupo else None,
                'estado': a.estado,
                'criado_em': a.criado_em,
                'tutores': [t.utilizador.get_display_name() for t in a.tutores.select_related('utilizador')],
            },
            'consentimentos': _tabela(a.consentimentos.all()),
        }
        ficheiros = []
        if a.conta:
            dados['conta'] = _dados_membro(a.conta)
            ficheiros = [(f'videos/{x.pk}-{x.nome}', x.ficheiro) for x in _anexos_de_respostas(a.conta.respostas_video)]
        return dados, ficheiros
    if pedido.ambito == 'familia':
        m = pedido.pedido_por
        return {
            **_dados_membro(m),
            'criancas': list(m.criancas.values_list('nome', flat=True)),
            'consentimentos_dados': _tabela(m.consentimentos.all()),
        }, []
    dados = {
        'instituicao': _tabela(type(instituicao).objects.filter(pk=instituicao.pk)),
        'membros': [
            {'nome': m.utilizador.get_display_name(), 'email': m.utilizador.email, 'papel': m.papel, 'desde': m.desde}
            for m in instituicao.membros.select_related('utilizador')
        ],
        'grupos': _tabela(instituicao.grupos.all()),
        'alunos': _tabela(instituicao.alunos.all()),
        'consentimentos': _tabela(instituicao.consentimentos.all()),
        'convites': _tabela(instituicao.convites.all(), 'codigo'),
        'avisos': _tabela(instituicao.avisos.all()),
        'eventos': _tabela(instituicao.eventos.all()),
        'aulas': _tabela(instituicao.aulas.all()),
        'respostas_em_video': _tabela(instituicao.respostas_video.all()),
        'gestos': _tabela(instituicao.gestos.all()),
        'conteudos': _tabela(instituicao.conteudos.all()),
        'publicacoes': _tabela(instituicao.posts_turma.all()),
        'comentarios': _tabela(ComentarioTurma.objects.filter(post__instituicao=instituicao)),
        'desafios': _tabela(instituicao.desafios.all()),
        'auditoria': _tabela(instituicao.auditoria.all()),
    }
    ficheiros = [(f'ficheiros/{f.pk}-{f.nome}', f.ficheiro) for f in instituicao.ficheiros.all()]
    ficheiros += [(f'anexos/{a.pk}-{a.nome}', a.ficheiro) for a in instituicao.anexos.all()]
    return dados, ficheiros


def gerar_zip(pedido):
    """ZIP num ficheiro temporário: apaga-se sozinho quando a resposta o fechar."""
    dados, ficheiros = conteudo_da_exportacao(pedido)
    saida = tempfile.TemporaryFile(suffix='.zip')
    faltam = []
    # Vídeos e imagens já vêm comprimidos: guardar sem voltar a comprimir poupa memória e tempo.
    with zipfile.ZipFile(saida, 'w', zipfile.ZIP_STORED, allowZip64=True) as z:
        for caminho, campo in ficheiros:
            try:
                with campo.storage.open(campo.name, 'rb') as origem, z.open(caminho, 'w', force_zip64=True) as destino:
                    while bloco := origem.read(1024 * 1024):
                        destino.write(bloco)
            except Exception:
                logger.warning('Ficheiro em falta na exportação do pedido %s: %s', pedido.pk, campo.name)
                faltam.append(caminho)
        z.writestr('dados.json', json.dumps(
            {
                'gerado_em': timezone.now(), 'instituicao': pedido.instituicao.nome, 'sobre': pedido.alvo,
                'ficheiros_em_falta': faltam, 'dados': dados,
            },
            cls=DjangoJSONEncoder, ensure_ascii=False, indent=2,
        ))
    saida.seek(0)
    return saida


def _apagar_anexo(anexo: AnexoEscola) -> None:
    anexo.ficheiro.delete(save=False)
    anexo.delete()


def _tirar_nome(instituicao, nome: str, substituto: str) -> None:
    """Os registos ficam (provam o que aconteceu), mas sem o nome da pessoa."""
    if not nome:
        return
    for r in instituicao.auditoria.filter(detalhe__contains=nome) | instituicao.auditoria.filter(quem__contains=nome):
        RegistoAuditoria.objects.filter(pk=r.pk).update(
            detalhe=r.detalhe.replace(nome, substituto), quem=r.quem.replace(nome, substituto),
        )
    for p in instituicao.pedidos_dados.filter(alvo__contains=nome):
        type(p).objects.filter(pk=p.pk).update(alvo=p.alvo.replace(nome, substituto))
    instituicao.pedidos_dados.filter(pedido_por_nome=nome).update(pedido_por_nome=substituto)


def eliminar_membro(membro: MembroInstituicao) -> None:
    """Tira a pessoa da instituição com o que publicou. A conta EYK continua a existir."""
    instituicao = membro.instituicao
    nome = membro.utilizador.get_display_name()
    respostas = RespostaVideo.objects.filter(aluno=membro)
    anexos = _anexos_de_respostas(respostas)
    fotos = [p.foto for p in membro.posts_turma.select_related('foto') if p.foto]
    respostas.delete()
    for anexo in {a.pk: a for a in [*anexos, *fotos]}.values():
        _apagar_anexo(anexo)
    # Sem outro tutor, a criança fica sem quem consinta: o perfil deixa de estar ativo.
    for crianca in membro.criancas.filter(estado=PerfilAluno.ATIVO):
        if crianca.tutores.exclude(pk=membro.pk).count() == 0:
            crianca.estado = PerfilAluno.RETIRADO
            crianca.save(update_fields=['estado'])
    membro.consentimentos.update(tutor_nome=NOME_PESSOA_ELIMINADA)
    PedidoAdesao.objects.filter(instituicao=instituicao, utilizador=membro.utilizador).delete()
    GostoTurma.objects.filter(membro=membro).delete()
    _tirar_nome(instituicao, nome, NOME_PESSOA_ELIMINADA)
    membro.delete()


def eliminar_crianca(aluno: PerfilAluno) -> None:
    instituicao = aluno.instituicao
    if aluno.conta:
        eliminar_membro(aluno.conta)
    ConviteInstituicao.objects.filter(aluno=aluno, estado=ConviteInstituicao.PENDENTE).update(
        estado=ConviteInstituicao.CANCELADO,
    )
    _tirar_nome(instituicao, aluno.nome, NOME_CRIANCA_ELIMINADA)
    aluno.delete()


def eliminar_instituicao(instituicao) -> None:
    logger.warning('A eliminar a instituição %s (%s) a pedido', instituicao.pk, instituicao.nome)
    instituicao.respostas_video.all().delete()
    for f in instituicao.ficheiros.all():
        f.ficheiro.delete(save=False)
    for a in instituicao.anexos.all():
        a.ficheiro.delete(save=False)
    instituicao.delete()
