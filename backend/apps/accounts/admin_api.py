import json
from datetime import timedelta
from functools import wraps

from django.contrib.admin.views.decorators import staff_member_required
from django.contrib.auth.decorators import login_required
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncWeek
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from apps.professores.models import Professor

from .emails import enviar_email_boas_vindas_conta, gerar_senha_temporaria
from .models import User


def _json_response(data, status=200):
    return JsonResponse(data, json_dumps_params={'ensure_ascii': False}, status=status)


def _staff_json(view_func):
    """Wrapper: login_required + staff_required + @csrf_exempt + JSON error if not staff."""
    @csrf_exempt
    @login_required
    @staff_member_required
    def wrapper(request, *args, **kwargs):
        return view_func(request, *args, **kwargs)

    # Decorator order fix: staff_member_required usa HttpResponseRedirect para login.
    # Queremos JSON 403 em vez disso para chamadas JSON. Vamos reimplementar manualmente.
    return wrapper


def _staff_and_json(view_func):
    @csrf_exempt
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return _json_response({'ok': False, 'error': 'Não autenticado.'}, 401)
        if not request.user.is_staff:
            return _json_response({'ok': False, 'error': 'Permissões de administrador necessárias.'}, 403)
        return view_func(request, *args, **kwargs)
    return wrapped


def _superuser_and_json(view_func):
    """Como `_staff_and_json`, mas só deixa passar superutilizadores."""
    @csrf_exempt
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return _json_response({'ok': False, 'error': 'Não autenticado.'}, 401)
        if not request.user.is_superuser:
            return _json_response({'ok': False, 'error': 'Só um super administrador pode fazer isto.'}, 403)
        return view_func(request, *args, **kwargs)
    return wrapped


def _parse_body(request):
    try:
        return json.loads(request.body.decode('utf-8') or '{}')
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


# ─────────────────────────── Professores ────────────────────────────────────

@_staff_and_json
@require_GET
def api_listar_professores(request):
    """GET /accounts/api/admin/professores/  →  lista todos os professores"""
    qs = Professor.objects.select_related('user').order_by('-criado_em')
    data = []
    for p in qs:
        data.append({
            'id': p.id,
            'nome_publico': p.nome_publico,
            'area': p.area,
            'bio': p.bio or '',
            'foto': p.foto.url if p.foto else None,
            'ativo': p.ativo,
            'criado_em': p.criado_em.isoformat(),
            'user': {
                'id': p.user.id,
                'username': p.user.username,
                'email': p.user.email,
                'is_active': p.user.is_active,
                'perfil_completo': p.user.perfil_completo,
                'date_joined': p.user.date_joined.isoformat(),
            }
        })
    return _json_response({'ok': True, 'professores': data})


def _validar_username_email(username, email, errors):
    if not username:
        errors['username'] = 'O nome de utilizador é obrigatório.'
    elif User.objects.filter(username=username).exists():
        errors['username'] = 'Este nome de utilizador já existe.'

    if not email:
        errors['email'] = 'O email é obrigatório.'
    else:
        try:
            validate_email(email)
        except ValidationError:
            errors['email'] = 'Introduz um email válido.'
        if not errors.get('email') and User.objects.filter(email__iexact=email).exists():
            errors['email'] = 'Este email já está registado.'


def _resposta_conta_criada(user, mensagem, senha, email_enviado, extra=None):
    """Resposta comum à criação de professores e administradores. A senha só
    volta na resposta quando o email falhou: o administrador tem de a passar à
    pessoa por outra via (e só a vê desta vez)."""
    corpo = {
        'ok': True,
        'message': mensagem,
        'email_enviado': email_enviado,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'is_active': user.is_active,
            'perfil_completo': user.perfil_completo,
            'date_joined': user.date_joined.isoformat(),
        },
    }
    if not email_enviado:
        corpo['senha_temporaria'] = senha
    if extra:
        corpo.update(extra)
    return corpo


@_staff_and_json
@require_POST
def api_registar_professor(request):
    """POST /accounts/api/admin/professores/criar/  →  cria user professor + perfil.

    A área de atuação é opcional (o professor preenche-a no perfil). Se a senha
    vier vazia, gera-se uma temporária. A pessoa recebe um email de boas-vindas
    com os dados e é obrigada a trocar a senha no primeiro acesso."""
    body = _parse_body(request)
    if body is None:
        return _json_response({'ok': False, 'error': 'Corpo JSON inválido.'}, 400)

    username = (body.get('username') or '').strip()
    email = (body.get('email') or '').strip().lower()
    password = body.get('password') or ''
    nome_publico = (body.get('nome_publico') or '').strip()
    area = (body.get('area') or '').strip()

    errors = {}
    _validar_username_email(username, email, errors)

    if password and len(password) < 6:
        errors['password'] = 'A senha temporária deve ter pelo menos 6 caracteres.'

    if not nome_publico:
        errors['nome_publico'] = 'O nome público é obrigatório.'

    if errors:
        return _json_response({'ok': False, 'error': 'Há campos inválidos.', 'errors': errors}, 400)

    senha = password or gerar_senha_temporaria()
    user = User.objects.create_user(
        username=username,
        email=email,
        password=senha,
        is_teacher=True,
        perfil_completo=False,
        deve_alterar_senha=True,
    )
    prof = Professor.objects.create(
        user=user,
        nome_publico=nome_publico,
        area=area,
    )
    email_enviado = enviar_email_boas_vindas_conta(user, senha, 'professor')
    return _json_response(_resposta_conta_criada(
        user,
        f'Professor "{username}" registado com sucesso.',
        senha,
        email_enviado,
        extra={'professor': {
            'id': prof.id,
            'nome_publico': prof.nome_publico,
            'area': prof.area,
            'ativo': prof.ativo,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'is_active': user.is_active,
                'perfil_completo': user.perfil_completo,
                'date_joined': user.date_joined.isoformat(),
            },
        }},
    ), 201)


# ─────────────────────────── Administradores ────────────────────────────────

@_superuser_and_json
@require_POST
def api_registar_administrador(request):
    """POST /accounts/api/admin/administradores/criar/  →  cria outro super administrador.

    Só um super administrador pode criar outro. A conta nasce com senha
    temporária (gerada se vier vazia), recebe o email de boas-vindas e é
    obrigada a trocar a senha no primeiro acesso."""
    body = _parse_body(request)
    if body is None:
        return _json_response({'ok': False, 'error': 'Corpo JSON inválido.'}, 400)

    username = (body.get('username') or '').strip()
    email = (body.get('email') or '').strip().lower()
    password = body.get('password') or ''
    nome = (body.get('nome') or '').strip()

    errors = {}
    _validar_username_email(username, email, errors)

    if password:
        try:
            validate_password(password)
        except ValidationError as e:
            errors['password'] = e.messages[0]

    if errors:
        return _json_response({'ok': False, 'error': 'Há campos inválidos.', 'errors': errors}, 400)

    senha = password or gerar_senha_temporaria()
    user = User.objects.create_user(
        username=username,
        email=email,
        password=senha,
        first_name=nome,
        is_staff=True,
        is_superuser=True,
        perfil_completo=True,  # um administrador não passa pelo onboarding
        deve_alterar_senha=True,
    )
    email_enviado = enviar_email_boas_vindas_conta(user, senha, 'super administrador')
    return _json_response(_resposta_conta_criada(
        user,
        f'Super administrador "{username}" criado com sucesso.',
        senha,
        email_enviado,
    ), 201)


# ─────────────────────────── Utilizadores ───────────────────────────────────

@_staff_and_json
@require_GET
def api_listar_utilizadores(request):
    """
    GET /accounts/api/admin/utilizadores/?q=&tipo=
    tipo ∈ {aluno, professor, staff}  (vazio = todos)
    """
    q = (request.GET.get('q') or '').strip()
    tipo = (request.GET.get('tipo') or '').strip()

    qs = User.objects.select_related('carteira').order_by('-date_joined')

    if q:
        qs = qs.filter(Q(username__icontains=q) | Q(email__icontains=q))

    if tipo == 'aluno':
        qs = qs.filter(is_student=True)
    elif tipo == 'professor':
        qs = qs.filter(is_teacher=True)
    elif tipo == 'staff':
        qs = qs.filter(is_staff=True)

    users = []
    for u in qs:
        # `User` nunca teve um campo/propriedade `coins` — o saldo real vive
        # na Carteira (apps.gamificacao). `getattr(u, 'coins', 0)` devolvia
        # sempre 0 para todos os utilizadores nesta listagem.
        try:
            coins = u.carteira.saldo
        except Exception:
            coins = 0
        users.append({
            'id': u.id,
            'username': u.username,
            'email': u.email or '',
            'is_staff': u.is_staff,
            'is_superuser': u.is_superuser,
            'is_teacher': u.is_teacher,
            'is_student': u.is_student,
            'is_active': u.is_active,
            'perfil_completo': u.perfil_completo,
            'date_joined': u.date_joined.isoformat(),
            'coins': coins,
            'banido': u.banido,
            'suspenso_ate': u.suspenso_ate.isoformat() if u.esta_suspenso else None,
            'motivo_sancao': u.motivo_sancao if u.esta_sancionado else '',
        })

    return _json_response({'ok': True, 'users': users})


@_staff_and_json
@require_POST
def api_toggle_ativo_usuario(request, user_id):
    """POST /accounts/api/admin/usuarios/<id>/toggle/  →  ativa/desativa conta"""
    try:
        target = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return _json_response({'ok': False, 'error': 'Utilizador não encontrado.'}, 404)

    if target == request.user:
        return _json_response({'ok': False, 'error': 'Não podes ativar/desativar a tua própria conta.'}, 400)
    if target.is_staff or target.is_superuser:
        return _json_response({'ok': False, 'error': 'Não é possível ativar/desativar outra conta de administrador.'}, 400)

    target.is_active = not target.is_active
    target.save()
    estado = 'ativada' if target.is_active else 'desativada'
    return _json_response({
        'ok': True,
        'message': f'Conta de "{target.username}" {estado} com sucesso.',
        'is_active': target.is_active,
    })


@_staff_and_json
@require_POST
def api_apagar_usuario(request, user_id):
    """POST /accounts/api/admin/usuarios/<id>/apagar/  →  apaga a conta"""
    try:
        target = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return _json_response({'ok': False, 'error': 'Utilizador não encontrado.'}, 404)

    if target == request.user:
        return _json_response({'ok': False, 'error': 'Não podes apagar a tua própria conta por aqui.'}, 400)
    if target.is_staff or target.is_superuser:
        return _json_response({'ok': False, 'error': 'Não é possível apagar outra conta de administrador.'}, 400)

    username = target.username
    target.delete()
    return _json_response({
        'ok': True,
        'message': f'Utilizador "{username}" apagado com sucesso.',
    })


# ─────────────────────────── Métricas da plataforma ─────────────────────────

SEMANAS_CRESCIMENTO = 12
SEMANAS_COORTES = 8


def _inicio_semana(data):
    """Segunda-feira (data local) da semana de `data`."""
    return data - timedelta(days=data.weekday())


def _serie_semanal(queryset, campo, semanas):
    """Contagem por semana (TruncWeek) das últimas `semanas`, incluindo as
    semanas sem registos (a 0), da mais antiga para a mais recente."""
    hoje = timezone.localdate()
    primeira = _inicio_semana(hoje) - timedelta(weeks=semanas - 1)
    contagens = {
        linha['semana'].date() if hasattr(linha['semana'], 'date') else linha['semana']: linha['n']
        for linha in (
            queryset.filter(**{f'{campo}__date__gte': primeira})
            .annotate(semana=TruncWeek(campo))
            .values('semana')
            .annotate(n=Count('id'))
        )
    }
    return [
        {'semana': (primeira + timedelta(weeks=i)).isoformat(), 'n': contagens.get(primeira + timedelta(weeks=i), 0)}
        for i in range(semanas)
    ]


def _ids_ativos_desde(desde):
    """Utilizadores com atividade real desde `desde`: login, progresso num
    vídeo (posição de reprodução) ou uma view registada."""
    from apps.professores.models import PosicaoVisualizacao, VisualizacaoVideo

    ids = set(User.objects.filter(last_login__gte=desde).values_list('id', flat=True))
    ids.update(PosicaoVisualizacao.objects.filter(atualizado_em__gte=desde).values_list('utilizador_id', flat=True))
    ids.update(
        VisualizacaoVideo.objects.filter(ultima_visualizacao__gte=desde, utilizador__isnull=False)
        .values_list('utilizador_id', flat=True)
    )
    return ids


@_staff_and_json
@require_GET
def api_metricas(request):
    """GET /accounts/api/admin/metricas/  →  visão agregada da plataforma:
    totais, crescimento semanal, utilizadores ativos, retenção por coorte
    e cursos/vídeos mais vistos."""
    from apps.cursos.models import AvaliacaoCurso, Curso, Inscricao
    from apps.professores.models import Video

    agora = timezone.now()
    ativos_7d = _ids_ativos_desde(agora - timedelta(days=7))
    ativos_30d = _ids_ativos_desde(agora - timedelta(days=30))
    ativos_hoje = _ids_ativos_desde(agora - timedelta(days=1))

    utilizadores = User.objects.filter(is_staff=False, is_superuser=False)
    total_utilizadores = utilizadores.count()
    total_inscricoes = Inscricao.objects.count()
    total_concluidas = Inscricao.objects.filter(concluido=True).count()
    avaliacoes = AvaliacaoCurso.objects.aggregate(media=Avg('estrelas'), total=Count('id'))

    # Retenção por coorte: dos utilizadores registados em cada semana, quantos
    # tiveram atividade nos últimos 7 dias.
    hoje = timezone.localdate()
    semana_atual = _inicio_semana(hoje)
    coortes = []
    for i in range(SEMANAS_COORTES - 1, -1, -1):
        inicio = semana_atual - timedelta(weeks=i)
        fim = inicio + timedelta(weeks=1)
        ids = set(
            utilizadores.filter(date_joined__date__gte=inicio, date_joined__date__lt=fim)
            .values_list('id', flat=True)
        )
        retidos = len(ids & ativos_7d)
        coortes.append({
            'semana': inicio.isoformat(),
            'novos': len(ids),
            'ativos7d': retidos,
            'taxa': round(retidos / len(ids) * 100) if ids else None,
        })

    # Retenção a 30 dias: dos que se registaram há mais de 30 dias, quantos
    # continuam ativos no último mês.
    antigos = set(utilizadores.filter(date_joined__lt=agora - timedelta(days=30)).values_list('id', flat=True))
    retencao_30d = round(len(antigos & ativos_30d) / len(antigos) * 100) if antigos else None

    top_cursos = (
        Curso.objects.filter(ativo=True)
        .select_related('professor')
        .annotate(
            inscritos=Count('inscricoes', distinct=True),
            concluidos=Count('inscricoes', filter=Q(inscricoes__concluido=True), distinct=True),
            media_estrelas=Avg('avaliacoes__estrelas'),
        )
        .order_by('-inscritos', '-concluidos')[:10]
    )
    top_videos = (
        Video.objects.filter(ativo=True)
        .select_related('professor', 'curso')
        .annotate(views=Sum('visualizacoes__count'), espectadores=Count('visualizacoes', distinct=True))
        .filter(views__gt=0)
        .order_by('-views')[:10]
    )

    return _json_response({
        'ok': True,
        'geradoEm': agora.isoformat(),
        'totais': {
            'utilizadores': total_utilizadores,
            'alunos': utilizadores.filter(is_student=True).count(),
            'professores': utilizadores.filter(is_teacher=True).count(),
            'cursos': Curso.objects.filter(ativo=True).count(),
            'videos': Video.objects.filter(ativo=True).count(),
            'inscricoes': total_inscricoes,
            'conclusoes': total_concluidas,
            'taxaConclusao': round(total_concluidas / total_inscricoes * 100) if total_inscricoes else 0,
            'avaliacoes': avaliacoes['total'],
            'mediaAvaliacoes': round(avaliacoes['media'], 1) if avaliacoes['media'] is not None else None,
            'emailsPorVerificar': utilizadores.filter(email_verificado=False).count(),
        },
        'ativos': {
            'hoje': len(ativos_hoje),
            'semana': len(ativos_7d),
            'mes': len(ativos_30d),
            'retencao30d': retencao_30d,
        },
        'crescimento': {
            'utilizadores': _serie_semanal(utilizadores, 'date_joined', SEMANAS_CRESCIMENTO),
            'inscricoes': _serie_semanal(Inscricao.objects.all(), 'inscrito_em', SEMANAS_CRESCIMENTO),
            'conclusoes': _serie_semanal(
                Inscricao.objects.filter(concluido=True), 'concluido_em', SEMANAS_CRESCIMENTO,
            ),
        },
        'coortes': coortes,
        'topCursos': [
            {
                'id': c.id,
                'titulo': c.titulo,
                'professor': c.professor.nome_publico,
                'inscritos': c.inscritos,
                'concluidos': c.concluidos,
                'taxaConclusao': round(c.concluidos / c.inscritos * 100) if c.inscritos else 0,
                'mediaAvaliacoes': round(c.media_estrelas, 1) if c.media_estrelas is not None else None,
            }
            for c in top_cursos
        ],
        'topVideos': [
            {
                'id': v.id,
                'titulo': v.titulo,
                'professor': v.professor.nome_publico,
                'curso': v.curso.titulo if v.curso else None,
                'cursoId': v.curso_id,
                'views': v.views or 0,
                'espectadores': v.espectadores,
            }
            for v in top_videos
        ],
    })
