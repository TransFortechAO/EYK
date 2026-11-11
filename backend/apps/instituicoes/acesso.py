"""Quem pode fazer o quê numa instituição. Espelho de frontend/app/lib/instituicoes/permissoes.ts:
o frontend usa-o só para esconder botões; é aqui que as regras valem."""
from functools import wraps

from rest_framework import status
from rest_framework.exceptions import APIException

from .models import Instituicao, MembroInstituicao

ENSINAR_LGA = {
    'ver_turmas_lga', 'gerir_turmas_lga', 'publicar_aulas', 'rever_respostas', 'propor_gestos', 'praticar',
    'publicar_conteudos', 'publicar_na_turma', 'moderar_turma', 'criar_desafios',
}

PERMISSOES = {
    'administrador': {
        'ver_painel', 'gerir_membros', 'convidar', 'aprovar_pedidos', 'gerir_definicoes', 'ver_todos_grupos',
        'gerir_grupos', 'gerir_alunos', 'publicar_avisos', 'ver_avisos', 'criar_eventos', 'ver_agenda',
        'carregar_ficheiros', 'ver_ficheiros', 'ver_consentimentos', 'ver_relatorios', 'ver_auditoria', 'pedir_dados',
        'gerir_pedidos_dados',
        # Abre turmas e publica conteúdos, mas não vê os vídeos das crianças.
        'ver_turmas_lga', 'gerir_turmas_lga', 'publicar_aulas', 'praticar', 'publicar_conteudos', 'moderar_turma',
        'criar_desafios',
    },
    'coordenador': {
        'ver_painel', 'ver_todos_grupos', 'ver_avisos', 'ver_agenda', 'ver_ficheiros', 'ver_relatorios',
        'ver_turmas_lga', 'propor_gestos', 'validar_gestos', 'praticar',
    },
    'educador': {
        'ver_painel', 'convidar', 'gerir_grupos', 'gerir_alunos', 'publicar_avisos', 'ver_avisos', 'criar_eventos',
        'ver_agenda', 'carregar_ficheiros', 'ver_ficheiros', 'validar_gestos', *ENSINAR_LGA,
    },
    'familia': {
        'ver_painel', 'ver_avisos', 'ver_agenda', 'ver_ficheiros', 'dar_consentimento', 'pedir_dados',
        'ver_turmas_lga', 'praticar',
    },
    'aluno': {
        'ver_painel', 'ver_avisos', 'ver_agenda', 'ver_ficheiros', 'ver_turmas_lga', 'responder_aulas', 'praticar',
        'publicar_na_turma',
    },
}


class Recusa(APIException):
    """Erro com a mensagem pronta a mostrar à pessoa."""
    status_code = status.HTTP_400_BAD_REQUEST

    def __init__(self, mensagem: str, codigo: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(mensagem)
        self.status_code = codigo


def pode(papel: str | None, acao: str) -> bool:
    return bool(papel) and acao in PERMISSOES.get(papel, ())


def sid(valor) -> str | None:
    """Id tal como o frontend o usa: "srv-12" (distingue-o dos dados de demonstração)."""
    return None if valor is None else f'srv-{valor}'


def pid(valor) -> int | None:
    """Id recebido do frontend ("srv-12" ou 12)."""
    if valor in (None, ''):
        return None
    try:
        return int(str(valor).removeprefix('srv-'))
    except ValueError:
        raise Recusa('Identificador inválido.') from None


class IdEscola:
    """Conversor de URL: aceita srv-12 e 12."""
    regex = r'(?:srv-)?[0-9]+'

    def to_python(self, valor):
        return int(valor.removeprefix('srv-'))

    def to_url(self, valor):
        return str(valor)


def membro_ativo(request, instituicao_id: int) -> MembroInstituicao:
    """O membro autenticado nesta instituição — e a garantia de que pode aceder-lhe."""
    instituicao = Instituicao.objects.filter(pk=instituicao_id).first()
    if not instituicao:
        raise Recusa('Instituição não encontrada.', status.HTTP_404_NOT_FOUND)
    membro = instituicao.membros.filter(utilizador=request.user, estado=MembroInstituicao.ATIVO).first()
    if not membro:
        raise Recusa('Não pertences a esta instituição.', status.HTTP_403_FORBIDDEN)
    if instituicao.estado == Instituicao.SUSPENSA:
        raise Recusa(
            'O acesso a esta instituição está suspenso. Os dados continuam guardados.', status.HTTP_403_FORBIDDEN,
        )
    if instituicao.estado == Instituicao.ENCERRADA:
        raise Recusa('Esta instituição foi encerrada.', status.HTTP_403_FORBIDDEN)
    membro.instituicao = instituicao
    return membro


def com_membro(acao: str | None = None):
    """Decorador das views de uma instituição: passa o `membro`; com `acao`, exige a permissão."""
    def decorador(view):
        @wraps(view)
        def embrulho(request, instituicao_id, *args, **kwargs):
            membro = membro_ativo(request, instituicao_id)
            if acao and not pode(membro.papel, acao):
                raise Recusa('O teu papel não permite esta ação.', status.HTTP_403_FORBIDDEN)
            return view(request, membro, *args, **kwargs)
        return embrulho
    return decorador
