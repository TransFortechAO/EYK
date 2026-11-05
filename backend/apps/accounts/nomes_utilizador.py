"""Nome de utilizador criado a partir do nome da pessoa, com sugestões quando já existe."""
import re
import unicodedata

from .models import User

TAMANHO_MAX = 30
RESERVADOS = {'admin', 'administrador', 'eyk', 'suporte', 'apoio', 'moderador', 'sistema'}


def _partes(nome: str) -> list[str]:
    """"João da Silva" -> ["joao", "silva"] (sem acentos, sem partículas)."""
    texto = unicodedata.normalize('NFKD', nome or '').encode('ascii', 'ignore').decode().lower()
    partes = re.findall(r'[a-z0-9]+', texto)
    sem_particulas = [p for p in partes if p not in {'de', 'da', 'do', 'das', 'dos', 'e'}]
    return sem_particulas or partes


def _candidatos(nome: str):
    partes = _partes(nome) or ['utilizador']
    primeiro, ultimo = partes[0], partes[-1]
    if ultimo != primeiro:
        yield f'{primeiro}.{ultimo}'
        yield f'{primeiro}{ultimo}'
        yield f'{primeiro}_{ultimo}'
        yield f'{ultimo}.{primeiro}'
        yield f'{primeiro[0]}.{ultimo}'
        base = f'{primeiro}.{ultimo}'
    else:
        yield primeiro
        base = primeiro
    for numero in range(1, 1000):
        yield f'{base}{numero}'


def nome_principal(nome: str) -> str:
    """O nome de utilizador mais natural para este nome (pode já estar ocupado)."""
    return next(_candidatos(nome))[:TAMANHO_MAX]


def disponivel(username: str) -> bool:
    if not username or username.lower() in RESERVADOS:
        return False
    return not User.objects.filter(username__iexact=username).exists()


def sugestoes(nome: str, quantidade: int = 4) -> list[str]:
    """Nomes de utilizador livres, do mais natural para o menos."""
    livres: list[str] = []
    for candidato in _candidatos(nome):
        candidato = candidato[:TAMANHO_MAX]
        if candidato not in livres and disponivel(candidato):
            livres.append(candidato)
        if len(livres) == quantidade:
            break
    return livres


def separar_nome(nome: str) -> tuple[str, str]:
    """"Ana Maria Silva" -> ("Ana", "Maria Silva"), para first_name/last_name."""
    partes = ' '.join((nome or '').split()).split(' ', 1)
    return partes[0][:150], (partes[1] if len(partes) > 1 else '')[:150]
