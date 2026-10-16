"""Perfis: o público (como os outros me veem — respeita as definições de
privacidade) e o privado (como eu vejo e giro o meu)."""
from django.http import JsonResponse
from django.utils.timesince import timesince
from django.views.decorators.http import require_GET

from .models import User


def _json(data, status=200):
    return JsonResponse(data, json_dumps_params={'ensure_ascii': False}, status=status)


def _iniciais(user: User) -> str:
    iniciais = (
        ((user.first_name or user.username or '?')[0]) + ((user.last_name or '')[0:1] or '')
    ).upper()
    return iniciais or (user.username[0].upper() if user.username else '?')


def _tempo(data) -> str:
    return 'há ' + timesince(data).split(', ')[0]


def _cursos_de(user: User) -> set[int]:
    """Cursos onde o utilizador está inscrito ou que leciona."""
    from apps.cursos.models import Curso, Inscricao

    ids = set(Inscricao.objects.filter(aluno__profile=user).values_list('curso_id', flat=True))
    ids |= set(Curso.objects.filter(professor__user=user).values_list('id', flat=True))
    return ids


def pode_ver_perfil(visitante: User, alvo: User) -> bool:
    if visitante.id == alvo.id or visitante.is_staff:
        return True
    if alvo.perfil_visibilidade == 'todos':
        return True
    return bool(_cursos_de(visitante) & _cursos_de(alvo))


def _publicacoes(user: User, incluir_ocultas=False, limite=10) -> list[dict]:
    from apps.feed.models import Post

    posts = Post.objects.filter(autor=user)
    if not incluir_ocultas:
        posts = posts.filter(oculto=False)
    return [
        {
            'id': p.id,
            'conteudo': p.conteudo,
            'tempo': _tempo(p.criado_em),
            'criadoEm': p.criado_em.isoformat(),
            'gostos': p.reacoes.count(),
            'comentarios': p.comentarios.filter(oculto=False).count(),
            'oculto': p.oculto,
        }
        for p in posts.order_by('-criado_em')[:limite]
    ]


def _conquistas(user: User) -> list[dict]:
    from apps.gamificacao.models import AlunoBadge

    return [
        {'id': b.badge.slug, 'nome': b.badge.nome, 'descricao': b.badge.descricao, 'icone': b.badge.icone}
        for b in AlunoBadge.objects.filter(utilizador=user).select_related('badge')
    ]


def _nivel(user: User) -> int:
    from apps.gamificacao.services import nivel_info

    try:
        xp = user.carteira.xp
    except Exception:
        xp = 0
    return nivel_info(xp)['nivel']


def construir_perfil(alvo: User, visitante: User | None, como_visitante: bool = False) -> dict:
    """`visitante=None` (ou `como_visitante`) = ver como um utilizador
    qualquer, que não partilha cursos com o dono do perfil."""
    from apps.alunos.models import Aluno
    from apps.cursos.models import Curso, Inscricao
    from apps.moderacao.models import Bloqueio
    from apps.professores.models import Professor, Seguidor, Video

    sou_eu = bool(visitante and visitante.id == alvo.id)
    is_teacher = bool(alvo.is_teacher)
    professor = Professor.objects.filter(user=alvo).first() if is_teacher else None
    aluno = None if is_teacher else Aluno.objects.filter(profile=alvo).first()
    foto = (professor.foto.url if professor and professor.foto else None) if is_teacher else (
        aluno.foto.url if aluno and aluno.foto else None
    )

    if como_visitante or visitante is None:
        visivel = alvo.perfil_visibilidade == 'todos'
        bloqueei = bloqueou_me = False
    else:
        visivel = pode_ver_perfil(visitante, alvo)
        bloqueei = Bloqueio.objects.filter(utilizador=visitante, bloqueado=alvo).exists()
        bloqueou_me = Bloqueio.objects.filter(utilizador=alvo, bloqueado=visitante).exists()
        if (bloqueou_me or bloqueei) and not visitante.is_staff:
            visivel = False

    perfil = {
        'id': alvo.id,
        'name': alvo.get_display_name(),
        'initials': _iniciais(alvo),
        'isTeacher': is_teacher,
        'membroDesde': alvo.date_joined.date().isoformat() if alvo.date_joined else None,
        'souEu': sou_eu and not como_visitante,
        'foto': foto,
        'privado': not visivel,
        'bloqueado': bloqueei,
        'nomePublico': professor.nome_publico if professor else None,
    }
    if not visivel:
        return perfil

    perfil['bio'] = (professor.bio if professor else (aluno.bio if aluno else '')) or ''

    if professor:
        cursos = (
            Curso.objects.filter(professor=professor, ativo=True, oculto=False)
            .prefetch_related('inscricoes', 'avaliacoes').order_by('-criado_em')
        )
        videos = (
            Video.objects.filter(professor=professor, curso__isnull=True, ativo=True, oculto=False)
            .prefetch_related('visualizacoes').order_by('-criado_em')
        )
        lista_cursos = []
        for c in cursos:
            avaliacoes = [a for a in c.avaliacoes.all() if not a.oculto]
            lista_cursos.append({
                'id': c.id,
                'titulo': c.titulo,
                'thumbnail': c.thumbnail.url if c.thumbnail else None,
                'alunos': c.total_inscritos(),
                'media': round(sum(a.estrelas for a in avaliacoes) / len(avaliacoes), 1) if avaliacoes else None,
            })
        perfil.update({
            'area': professor.area,
            'seguidores': professor.seguidores.count(),
            'aSeguir': bool(visitante) and Seguidor.objects.filter(utilizador=visitante, professor=professor).exists(),
            'professorId': professor.id,
            'totalCursos': len(lista_cursos),
            'totalVideos': videos.count(),
            'cursos': lista_cursos,
            'videos': [
                {
                    'id': v.id,
                    'titulo': v.titulo,
                    'thumbnail': v.thumbnail.url if v.thumbnail else None,
                    'views': v.total_visualizacoes(),
                    'duracaoSegundos': v.duracao_segundos,
                }
                for v in videos[:24]
            ],
        })
    else:
        concluidas = (
            Inscricao.objects.filter(aluno=aluno, concluido=True).select_related('curso').order_by('-concluido_em')
            if aluno else Inscricao.objects.none()
        )
        perfil['cursosConcluidos'] = concluidas.count()
        if alvo.mostrar_cursos_perfil:
            perfil['listaCursosConcluidos'] = [
                {
                    'cursoId': i.curso_id,
                    'titulo': i.curso.titulo,
                    'concluidoEm': i.concluido_em.isoformat() if i.concluido_em else None,
                    # Link público de verificação — só para contas com o email
                    # confirmado (as mesmas que podem descarregar o certificado).
                    'certificado': str(i.codigo_certificado) if alvo.email_verificado else None,
                }
                for i in concluidas[:20]
            ]

    if alvo.mostrar_conquistas_perfil:
        perfil['conquistas'] = _conquistas(alvo)
        perfil['nivel'] = _nivel(alvo)
    if alvo.mostrar_publicacoes_perfil:
        perfil['publicacoes'] = _publicacoes(alvo)
    return perfil


@require_GET
def perfil_publico(request, user_id):
    """Perfil público de um utilizador. Nunca devolve email, username,
    telefone, morada ou outros dados de conta. `?como_visitante=1` (no
    próprio perfil) mostra-o como um visitante qualquer o veria."""
    if not request.user.is_authenticated:
        return _json({'ok': False, 'error': 'Não autenticado.'}, 401)

    alvo = User.objects.filter(id=user_id, is_active=True).first()
    if alvo is None or (alvo.banido and not request.user.is_staff):
        return _json({'ok': False, 'error': 'Utilizador não encontrado.'}, 404)

    como_visitante = request.GET.get('como_visitante') == '1' and alvo.id == request.user.id
    return _json({'ok': True, 'perfil': construir_perfil(alvo, request.user, como_visitante)})


@require_GET
def meu_perfil(request):
    """O meu perfil (privado): dados da conta, estatísticas, certificados,
    publicações (incluindo as ocultadas pela moderação) e as definições de
    privacidade que controlam o perfil público."""
    if not request.user.is_authenticated:
        return _json({'ok': False, 'error': 'Não autenticado.'}, 401)

    from apps.cursos.models import AvaliacaoCurso, Inscricao
    from apps.feed.models import Comentario
    from apps.professores.models import ComentarioVideo

    user = request.user
    inscricoes = list(
        Inscricao.objects.filter(aluno__profile=user).select_related('curso__professor').order_by('-inscrito_em')
    )
    try:
        coins, xp = user.carteira.saldo, user.carteira.xp
    except Exception:
        coins = xp = 0
    try:
        ofensiva = user.ofensiva.dias_atual
    except Exception:
        ofensiva = 0

    return _json({
        'ok': True,
        'perfil': construir_perfil(user, user),
        'conta': {
            'username': user.username,
            'email': user.email,
            'emailVerificado': user.email_verificado,
            'membroDesde': user.date_joined.date().isoformat() if user.date_joined else None,
        },
        'estatisticas': {
            'moedas': coins,
            'xp': xp,
            'nivel': _nivel(user),
            'ofensiva': ofensiva,
            'cursosInscritos': len(inscricoes),
            'cursosConcluidos': sum(1 for i in inscricoes if i.concluido),
            'publicacoes': user.posts.count(),
            'comentarios': Comentario.objects.filter(autor=user).count() + ComentarioVideo.objects.filter(autor=user).count(),
        },
        'certificados': [
            {
                'cursoId': i.curso_id,
                'curso': i.curso.titulo,
                'professor': i.curso.professor.nome_publico,
                'concluidoEm': i.concluido_em.isoformat() if i.concluido_em else None,
                'codigo': str(i.codigo_certificado),
            }
            for i in inscricoes if i.concluido
        ],
        'emCurso': [
            {'cursoId': i.curso_id, 'curso': i.curso.titulo, 'inscritoEm': i.inscrito_em.isoformat()}
            for i in inscricoes if not i.concluido
        ],
        'publicacoes': _publicacoes(user, incluir_ocultas=True, limite=50),
        'avaliacoes': [
            {
                'cursoId': a.curso_id,
                'curso': a.curso.titulo,
                'estrelas': a.estrelas,
                'comentario': a.comentario,
                'oculto': a.oculto,
                'tempo': _tempo(a.atualizado_em),
            }
            for a in AvaliacaoCurso.objects.filter(aluno__profile=user).select_related('curso')
        ],
    })
