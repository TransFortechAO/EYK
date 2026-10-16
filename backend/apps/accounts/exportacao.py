"""Exportação dos dados pessoais de um utilizador (Configurações →
Privacidade → Exportar os meus dados)."""
from django.conf import settings
from django.utils import timezone

from .models import User


def _iso(valor):
    return valor.isoformat() if valor else None


def exportar_dados(user: User) -> dict:
    from apps.alunos.models import Aluno
    from apps.cursos.models import AvaliacaoCurso, Inscricao
    from apps.feed.models import Comentario, Post, ReacaoPost
    from apps.gamificacao.models import AlunoBadge, Carteira, Ofensiva, TransacaoMoeda
    from apps.moderacao.models import AcaoModeracao, Bloqueio, Contestacao, Denuncia
    from apps.professores.models import ComentarioVideo, Professor, ReacaoVideo, Seguidor, VisualizacaoVideo

    aluno = Aluno.objects.filter(profile=user).first()
    professor = Professor.objects.filter(user=user).first()
    carteira = Carteira.objects.filter(utilizador=user).first()
    ofensiva = Ofensiva.objects.filter(utilizador=user).first()

    inscricoes = Inscricao.objects.filter(aluno=aluno).select_related('curso') if aluno else []

    return {
        'exportadoEm': timezone.now().isoformat(),
        'conta': {
            'id': user.id,
            'username': user.username,
            'nome': user.get_full_name(),
            'email': user.email,
            'emailVerificado': user.email_verificado,
            'telefone': user.phone_number,
            'morada': user.morada,
            'registadoEm': _iso(user.date_joined),
            'ultimoLogin': _iso(user.last_login),
            'aluno': user.is_student,
            'professor': user.is_teacher,
            'convidadoPor': user.convidado_por.username if user.convidado_por else None,
        },
        'preferencias': {
            'tema': user.tema_preferido,
            'emailNovidades': user.notif_email_novidades,
            'emailComunidade': user.notif_email_comunidade,
            'emailGamificacao': user.notif_email_gamificacao,
            'velocidadeReproducao': user.velocidade_reproducao,
            'autoplayProximaAula': user.autoplay_proxima_aula,
            'retomarPosicao': user.retomar_posicao,
            'legendasAtivas': user.legendas_ativas,
            'tamanhoTexto': user.tamanho_texto,
            'reduzirAnimacoes': user.reduzir_animacoes,
            'altoContraste': user.alto_contraste,
            'perfilVisibilidade': user.perfil_visibilidade,
            'aparecerRanking': user.aparecer_ranking,
        },
        'perfilAluno': {
            'bio': aluno.bio,
            'foto': aluno.foto.url if aluno.foto else None,
        } if aluno else None,
        'perfilProfessor': {
            'nomePublico': professor.nome_publico,
            'area': professor.area,
            'bio': professor.bio,
            'foto': professor.foto.url if professor.foto else None,
            'cursos': [
                {'id': c.id, 'titulo': c.titulo, 'criadoEm': _iso(c.criado_em)} for c in professor.curso_set.all()
            ],
            'videos': [
                {'id': v.id, 'titulo': v.titulo, 'criadoEm': _iso(v.criado_em)}
                for v in professor.videos.filter(curso__isnull=True)
            ],
        } if professor else None,
        'cursos': [
            {
                'curso': i.curso.titulo,
                'cursoId': i.curso_id,
                'inscritoEm': _iso(i.inscrito_em),
                'concluido': i.concluido,
                'concluidoEm': _iso(i.concluido_em),
                'certificado': (
                    f'{settings.NEXT_PUBLIC_URL}/certificados/{i.codigo_certificado}' if i.concluido else None
                ),
            }
            for i in inscricoes
        ],
        'avaliacoes': [
            {'curso': a.curso.titulo, 'estrelas': a.estrelas, 'comentario': a.comentario, 'em': _iso(a.atualizado_em)}
            for a in AvaliacaoCurso.objects.filter(aluno=aluno).select_related('curso')
        ] if aluno else [],
        'publicacoes': [
            {'id': p.id, 'conteudo': p.conteudo, 'em': _iso(p.criado_em)}
            for p in Post.objects.filter(autor=user)
        ],
        'comentariosComunidade': [
            {'id': c.id, 'postId': c.post_id, 'conteudo': c.conteudo, 'em': _iso(c.criado_em)}
            for c in Comentario.objects.filter(autor=user)
        ],
        'comentariosVideos': [
            {'id': c.id, 'video': c.video.titulo, 'conteudo': c.conteudo, 'em': _iso(c.criado_em)}
            for c in ComentarioVideo.objects.filter(autor=user).select_related('video')
        ],
        'gostos': {
            'publicacoes': ReacaoPost.objects.filter(utilizador=user).count(),
            'videos': ReacaoVideo.objects.filter(utilizador=user).count(),
        },
        'videosVistos': [
            {'video': v.video.titulo, 'vezes': v.count, 'ultimaVez': _iso(v.ultima_visualizacao)}
            for v in VisualizacaoVideo.objects.filter(utilizador=user).select_related('video')
        ],
        'professoresSeguidos': [s.professor.nome_publico for s in Seguidor.objects.filter(utilizador=user).select_related('professor')],
        'gamificacao': {
            'moedas': carteira.saldo if carteira else 0,
            'xp': carteira.xp if carteira else 0,
            'ofensivaAtual': ofensiva.dias_atual if ofensiva else 0,
            'maiorOfensiva': ofensiva.maior_sequencia if ofensiva else 0,
            'conquistas': [
                {'conquista': b.badge.nome, 'em': _iso(b.desbloqueado_em)}
                for b in AlunoBadge.objects.filter(utilizador=user).select_related('badge')
            ],
            'transacoes': [
                {'valor': t.valor, 'motivo': t.get_motivo_display(), 'em': _iso(t.criado_em)}
                for t in TransacaoMoeda.objects.filter(utilizador=user)
            ],
        },
        'notificacoes': [
            {'tipo': n.tipo, 'mensagem': n.mensagem, 'lida': n.lida, 'em': _iso(n.criado_em)}
            for n in user.notificacoes.all()[:500]
        ],
        'sessoesAtivas': [
            {'dispositivo': s.dispositivo, 'ip': s.ip, 'desde': _iso(s.criada_em)} for s in user.sessoes_ativas.all()
        ],
        'utilizadoresBloqueados': [b.bloqueado.username for b in Bloqueio.objects.filter(utilizador=user).select_related('bloqueado')],
        'denunciasFeitas': [
            {'tipo': d.get_tipo_display(), 'motivo': d.get_motivo_display(), 'estado': d.get_estado_display(), 'em': _iso(d.criada_em)}
            for d in Denuncia.objects.filter(denunciante=user)
        ],
        'decisoesDeModeracao': [
            {'tipo': a.get_tipo_display(), 'motivo': a.motivo, 'anulada': a.revertida, 'em': _iso(a.criada_em)}
            for a in AcaoModeracao.objects.filter(alvo=user)
        ],
        'contestacoes': [
            {'texto': c.texto, 'estado': c.get_estado_display(), 'resposta': c.resposta, 'em': _iso(c.criada_em)}
            for c in Contestacao.objects.filter(utilizador=user)
        ],
    }
