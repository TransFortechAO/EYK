"""O que é cada tipo de conteúdo denunciável: como o encontrar, quem é o
autor, que texto mostrar na fila de moderação e para onde aponta o link."""
from dataclasses import dataclass
from typing import Callable

RESUMO_MAX = 500


def _cortar(texto: str) -> str:
    texto = (texto or '').strip()
    return texto if len(texto) <= RESUMO_MAX else texto[:RESUMO_MAX - 1] + '…'


@dataclass(frozen=True)
class TipoConteudo:
    obter: Callable
    autor: Callable
    resumo: Callable
    link: Callable
    # Pode ser ocultado/reposto (tem o campo `oculto`).
    ocultavel: bool = True
    # Pode ser apagado pela moderação. Vídeos/cursos não: são trabalho do
    # professor — ocultam-se até ele corrigir.
    apagavel: bool = False
    # Pode ser ocultado automaticamente ao fim de N denúncias (só texto de
    # utilizadores — vídeos/cursos ficam sempre para um administrador).
    ocultar_automaticamente: bool = False


def _post(pk):
    from apps.feed.models import Post
    return Post.objects.select_related('autor').filter(pk=pk).first()


def _comentario(pk):
    from apps.feed.models import Comentario
    return Comentario.objects.select_related('autor').filter(pk=pk).first()


def _comentario_video(pk):
    from apps.professores.models import ComentarioVideo
    return ComentarioVideo.objects.select_related('autor', 'video').filter(pk=pk).first()


def _video(pk):
    from apps.professores.models import Video
    return Video.objects.select_related('professor__user').filter(pk=pk).first()


def _curso(pk):
    from apps.cursos.models import Curso
    return Curso.objects.select_related('professor__user').filter(pk=pk).first()


def _avaliacao(pk):
    from apps.cursos.models import AvaliacaoCurso
    return AvaliacaoCurso.objects.select_related('aluno__profile', 'curso').filter(pk=pk).first()


def _utilizador(pk):
    from apps.accounts.models import User
    return User.objects.filter(pk=pk).first()


def _link_video(video) -> str:
    return f'/cursos/{video.curso_id}' if video.curso_id else f'/videos/{video.id}'


def _resumo_utilizador(user) -> str:
    from apps.alunos.models import Aluno
    from apps.professores.models import Professor

    bio = ''
    if user.is_teacher:
        prof = Professor.objects.filter(user=user).first()
        bio = prof.bio if prof else ''
    else:
        aluno = Aluno.objects.filter(profile=user).first()
        bio = aluno.bio if aluno else ''
    nome = user.get_display_name() or user.username
    return _cortar(f'{nome} — {bio}' if bio else nome)


TIPOS = {
    'post': TipoConteudo(
        obter=_post, autor=lambda o: o.autor, resumo=lambda o: _cortar(o.conteudo),
        link=lambda o: f'/comunidade?post={o.id}', apagavel=True, ocultar_automaticamente=True,
    ),
    'comentario': TipoConteudo(
        obter=_comentario, autor=lambda o: o.autor, resumo=lambda o: _cortar(o.conteudo),
        link=lambda o: f'/comunidade?post={o.post_id}', apagavel=True, ocultar_automaticamente=True,
    ),
    'comentario_video': TipoConteudo(
        obter=_comentario_video, autor=lambda o: o.autor, resumo=lambda o: _cortar(o.conteudo),
        link=lambda o: _link_video(o.video), apagavel=True, ocultar_automaticamente=True,
    ),
    'video': TipoConteudo(
        obter=_video, autor=lambda o: o.professor.user,
        resumo=lambda o: _cortar(f'{o.titulo}\n{o.descricao}'), link=_link_video,
    ),
    'curso': TipoConteudo(
        obter=_curso, autor=lambda o: o.professor.user,
        resumo=lambda o: _cortar(f'{o.titulo}\n{o.descricao}'), link=lambda o: f'/cursos/{o.id}',
    ),
    'avaliacao': TipoConteudo(
        obter=_avaliacao, autor=lambda o: o.aluno.profile,
        resumo=lambda o: _cortar(f'{o.estrelas}★ — {o.comentario}'),
        link=lambda o: f'/cursos/{o.curso_id}', apagavel=True, ocultar_automaticamente=True,
    ),
    'utilizador': TipoConteudo(
        obter=_utilizador, autor=lambda o: o, resumo=_resumo_utilizador,
        link=lambda o: f'/perfil/{o.id}', ocultavel=False,
    ),
}
