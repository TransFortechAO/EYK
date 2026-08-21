import json

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from django_otp.plugins.otp_totp.models import TOTPDevice

from apps.gamificacao.services import creditar_moedas, processar_atividade_diaria, verificar_badges

from .forms import UserRegisterForm
from .models import User

PRE_2FA_SESSION_KEY = 'pre_2fa_user_id'


# ── Endpoints JSON para o frontend Next.js (Autenticação) ───────────────────

@require_GET
def auth_csrf(request):
    """Devolve o token CSRF necessário para requests POST autenticados."""
    return JsonResponse({'csrfToken': get_token(request)})


@csrf_exempt
@require_POST
def auth_login_json(request):
    """Login via JSON (para o Next.js). Devolve o utilizador + define cookie de sessão."""
    try:
        body = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'Pedido inválido.'}, status=400)

    username = (body.get('username') or '').strip()
    password = body.get('password') or ''

    if not username or not password:
        return JsonResponse(
            {'ok': False, 'error': 'Credenciais em falta.'}, status=400,
        )

    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse(
            {'ok': False, 'error': 'Nome de utilizador ou palavra-passe errados.'}, status=401,
        )

    if TOTPDevice.objects.filter(user=user, confirmed=True).exists():
        request.session[PRE_2FA_SESSION_KEY] = user.id
        return JsonResponse({'ok': False, 'requires2fa': True})

    login(request, user)
    processar_atividade_diaria(user)

    return JsonResponse({
        'ok': True,
        'user': _user_payload(user),
    })


@csrf_exempt
@require_POST
def auth_register_json(request):
    """Registo via JSON (para o Next.js). Cria a conta, autentica a sessão e devolve o utilizador.

    Reaproveita o UserRegisterForm (mesmas regras de validação do registo antigo),
    mapeando o único `password` recebido para password1/password2 do form —
    a confirmação já é validada no lado do cliente antes deste pedido chegar.
    """
    try:
        body = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'Pedido inválido.'}, status=400)

    username = (body.get('username') or '').strip()
    email = (body.get('email') or '').strip()
    password = body.get('password') or ''
    ref = (body.get('ref') or '').strip()

    if not username or not email or not password:
        return JsonResponse(
            {'ok': False, 'error': 'Preenche todos os campos.'}, status=400,
        )

    form = UserRegisterForm(data={
        'username': username,
        'email': email,
        'password1': password,
        'password2': password,
    })

    if not form.is_valid():
        # Devolve a primeira mensagem de erro do form (username/email duplicados,
        # password fraca, etc.).
        primeiro_erro = next(iter(form.errors.values()))[0]
        return JsonResponse({'ok': False, 'error': primeiro_erro}, status=400)

    user = form.save()

    if ref and ref != username:
        referrer = User.objects.filter(username=ref).first()
        if referrer:
            user.convidado_por = referrer
            user.save(update_fields=['convidado_por'])
            creditar_moedas(referrer, 200, 'indicacao_amigo')
            verificar_badges(referrer)

    user = authenticate(username=username, password=password)
    if user is None:
        # Não devia acontecer (acabámos de criar a conta), mas por segurança.
        return JsonResponse(
            {'ok': False, 'error': 'Conta criada, mas falha ao iniciar sessão. Tenta entrar manualmente.'},
            status=500,
        )

    login(request, user)
    processar_atividade_diaria(user)

    return JsonResponse({
        'ok': True,
        'user': _user_payload(user),
    })


@csrf_exempt
@require_POST
def auth_logout_json(request):
    """Logout via JSON: destrói sessão e limpa cookies."""
    logout(request)
    response = JsonResponse({'ok': True})
    response.delete_cookie(settings.SESSION_COOKIE_NAME)
    response.delete_cookie('csrftoken')
    return response


@require_GET
def auth_me(request):
    """Devolve os dados do utilizador autenticado (ou guest).

    Devolve SEMPRE HTTP 200 para não poluir os logs com "Unauthorized".
    O campo `authenticated` indica se há sessão válida.
    """
    if not request.user.is_authenticated:
        return JsonResponse({
            'ok': True,
            'authenticated': False,
            'user': None,
        })

    try:
        coins = request.user.eyk_coins
    except Exception:
        coins = 0

    try:
        streak = request.user.xp
    except Exception:
        streak = 0

    payload = _user_payload(request.user)
    payload.setdefault('coins', coins or 2380)
    payload.setdefault('streak', streak or 9)
    return JsonResponse({
        'ok': True,
        'authenticated': True,
        'user': payload,
    })


@require_GET
def perfil_publico(request, user_id):
    """Perfil público de um utilizador (aluno ou professor), visível para
    qualquer outro utilizador autenticado. Só devolve dados não confidenciais
    — nunca email, username, telefone, morada ou outros dados de conta.
    """
    if not request.user.is_authenticated:
        return JsonResponse({'ok': False, 'error': 'Não autenticado.'}, status=401)

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Utilizador não encontrado.'}, status=404)

    name = user.get_display_name()
    initials = (
        ((user.first_name or user.username or '?')[0])
        + ((user.last_name or '')[0:1] or '')
    ).upper()
    is_teacher = getattr(user, 'is_teacher', False)

    perfil = {
        'id': user.id,
        'name': name,
        'initials': initials or (user.username[0].upper() if user.username else '?'),
        'isTeacher': is_teacher,
        'membroDesde': user.date_joined.date().isoformat() if user.date_joined else None,
        'souEu': request.user.id == user.id,
    }

    if is_teacher:
        from apps.cursos.models import Curso
        from apps.professores.models import Professor, Seguidor, Video

        professor = Professor.objects.filter(user=user).first()
        if not professor:
            return JsonResponse({'ok': False, 'error': 'Perfil não encontrado.'}, status=404)

        perfil.update({
            'nomePublico': professor.nome_publico,
            'bio': professor.bio,
            'area': professor.area,
            'foto': professor.foto.url if professor.foto else None,
            'seguidores': professor.seguidores.count(),
            'aSeguir': Seguidor.objects.filter(utilizador=request.user, professor=professor).exists(),
            'professorId': professor.id,
            'totalCursos': Curso.objects.filter(professor=professor, ativo=True).count(),
            'totalVideos': Video.objects.filter(professor=professor, curso__isnull=True, ativo=True).count(),
        })
    else:
        from apps.alunos.models import Aluno
        from apps.cursos.models import Inscricao

        aluno = Aluno.objects.filter(profile=user).first()
        if not aluno:
            return JsonResponse({'ok': False, 'error': 'Perfil não encontrado.'}, status=404)

        perfil.update({
            'bio': aluno.bio,
            'foto': aluno.foto.url if aluno.foto else None,
            'cursosConcluidos': Inscricao.objects.filter(aluno=aluno, concluido=True).count(),
        })

    return JsonResponse({'ok': True, 'perfil': perfil})


def _user_payload(user: User) -> dict:
    name = user.get_display_name()
    initials = (
        ((user.first_name or user.username or '?')[0])
        + ((user.last_name or '')[0:1] or '')
    ).upper()

    bio = ''
    if user.is_teacher:
        from apps.professores.models import Professor
        professor = Professor.objects.filter(user=user).first()
        if professor:
            bio = professor.bio or ''
    else:
        from apps.alunos.models import Aluno
        aluno = Aluno.objects.filter(profile=user).first()
        if aluno:
            bio = aluno.bio or ''

    return {
        'id': user.id,
        'name': name,
        'username': user.username,
        'email': user.email,
        'bio': bio,
        'initials': initials or user.username[0].upper(),
        'isTeacher': user.is_teacher if hasattr(user, 'is_teacher') else False,
        'isStudent': user.is_student if hasattr(user, 'is_student') else True,
        'isStaff': bool(user.is_staff),
        'perfilCompleto': bool(user.perfil_completo),
        'temaPreferido': user.tema_preferido,
        'notifEmailNovidades': bool(user.notif_email_novidades),
        'notifEmailComunidade': bool(user.notif_email_comunidade),
        'notifEmailGamificacao': bool(user.notif_email_gamificacao),
    }
