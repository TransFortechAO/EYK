"""Estados da candidatura a professor e as passagens permitidas entre eles.
Ver o plano em docs (Fase 1: candidato; Fase 2: decisão da equipa EYK; Fase 3: suspensão)."""
from .models import CandidaturaProfessor as C
from .models import HistoricoCandidatura

TRANSICOES = {
    C.POR_COMPLETAR: {C.SUBMETIDA},
    C.SUBMETIDA: {C.EM_ANALISE, C.APROVADA, C.REJEITADA, C.CORRECAO_PEDIDA},
    C.EM_ANALISE: {C.APROVADA, C.REJEITADA, C.CORRECAO_PEDIDA},
    C.CORRECAO_PEDIDA: {C.SUBMETIDA},
    C.APROVADA: {C.SUSPENSA},
    C.SUSPENSA: {C.APROVADA},
    C.REJEITADA: set(),
}

# O candidato só mexe no formulário nestes estados.
EDITAVEIS = {C.POR_COMPLETAR, C.CORRECAO_PEDIDA}


class TransicaoInvalida(ValueError):
    pass


def mudar_estado(candidatura: C, para: str, por, mensagem: str = '', registar_apenas: bool = False) -> None:
    """Muda o estado (se a passagem for permitida) e acrescenta ao histórico.
    Com `registar_apenas`, só regista o estado em que a candidatura já está."""
    de = candidatura.estado
    if not registar_apenas:
        if para not in TRANSICOES.get(de, set()):
            raise TransicaoInvalida(f'Não é possível passar de «{de}» para «{para}».')
        candidatura.estado = para
        candidatura.save(update_fields=['estado', 'atualizado_em'])
    HistoricoCandidatura.objects.create(
        candidatura=candidatura, de='' if registar_apenas else de, para=para, por=por, mensagem=mensagem,
    )
