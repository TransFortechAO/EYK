import base64
import io

import qrcode
from django.conf import settings
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from django_otp import match_token
from django_otp.plugins.otp_static.models import StaticDevice, StaticToken
from django_otp.plugins.otp_totp.models import TOTPDevice

from apps.gamificacao.services import creditar_moedas, registrar_atividade_diaria

from .forms import AlunoPerfilForm, ProfessorPerfilForm, UserLoginForm, UserRegisterForm
from .models import User

PRE_2FA_SESSION_KEY = 'pre_2fa_user_id'


def redirect_next(path="/"):
    """Redireciona para uma rota do frontend Next.js (NEXT_PUBLIC_URL)."""
    base = settings.NEXT_PUBLIC_URL.rstrip("/")
    if not path.startswith("/"):
        path = "/" + path
    return redirect(base + path)


def register_view(request):
    """Registo de aluno — após registo vai para personalização do perfil"""
    if request.method == 'POST':
        form = UserRegisterForm(request.POST)
        if form.is_valid():
            user = form.save()

            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password1')
            user = authenticate(username=username, password=password)
            login(request, user)

            messages.success(request, f'Conta criada com sucesso! Completa o teu perfil, {username}!')
            return redirect('accounts:completar-perfil-aluno')
    else:
        form = UserRegisterForm()

    return render(request, 'accounts/register.html', {'form': form})


def _finalizar_login(request, user):
    """Termina o login (streak/moedas + redirect), depois de password (e 2FA, se ativo) confirmados."""
    login(request, user)

    if registrar_atividade_diaria(user):
        creditar_moedas(user, 5, 'login_diario')

    if not user.perfil_completo:
        if user.is_student:
            messages.info(request, f'Bem-vindo, {user.username}! Completa o teu perfil.')
            return redirect('accounts:completar-perfil-aluno')
        elif user.is_teacher:
            messages.info(request, f'Bem-vindo, {user.username}! Completa o teu perfil de professor.')
            return redirect('accounts:completar-perfil-professor')

    messages.success(request, f'Bem-vindo, {user.username}!')
    return redirect_next('/')


def login_view(request):
    if request.method == 'POST':
        form = UserLoginForm(request, data=request.POST)
        if form.is_valid():
            user = form.get_user()

            if TOTPDevice.objects.filter(user=user, confirmed=True).exists():
                request.session[PRE_2FA_SESSION_KEY] = user.id
                return redirect('accounts:verificar-2fa')

            return _finalizar_login(request, user)
        else:
            print(form.errors)
    else:
        form = UserLoginForm()
    return render(request, 'accounts/login.html', {'form': form})


def verificar_2fa(request):
    """Segundo passo do login quando o utilizador tem 2FA ativo."""
    user_id = request.session.get(PRE_2FA_SESSION_KEY)
    if not user_id:
        return redirect('accounts:login')
    user = get_object_or_404(User, id=user_id)

    if request.method == 'POST':
        codigo = request.POST.get('codigo', '').strip().replace(' ', '')
        device = match_token(user, codigo)
        if device:
            del request.session[PRE_2FA_SESSION_KEY]
            return _finalizar_login(request, user)
        messages.error(request, 'Código inválido. Tenta novamente.')

    return render(request, 'accounts/verificar_2fa.html', {'username': user.username})


def logout_view(request):
    logout(request)
    messages.info(request, 'Sessão terminada.')
    return redirect('index')


@login_required
def completar_perfil_aluno(request):
    """Página de personalização do perfil do aluno (bio + foto)"""
    from apps.alunos.models import Aluno
    aluno, _ = Aluno.objects.get_or_create(profile=request.user)

    if request.method == 'POST':
        form = AlunoPerfilForm(request.POST, request.FILES, instance=aluno)
        if form.is_valid():
            form.save()
            request.user.perfil_completo = True
            request.user.save()
            messages.success(request, 'Perfil atualizado com sucesso!')
            return redirect_next('/')
    else:
        form = AlunoPerfilForm(instance=aluno)

    return render(request, 'accounts/completar_perfil_aluno.html', {'form': form})


@login_required
def completar_perfil_professor(request):
    """Página de personalização do perfil do professor (1º login)"""
    from apps.professores.models import Professor
    try:
        professor = Professor.objects.get(user=request.user)
    except Professor.DoesNotExist:
        messages.error(request, 'Perfil de professor não encontrado.')
        return redirect_next('/')

    if request.method == 'POST':
        form = ProfessorPerfilForm(request.POST, request.FILES, instance=professor)
        if form.is_valid():
            form.save()
            request.user.perfil_completo = True
            request.user.save()
            messages.success(request, 'Perfil de professor atualizado com sucesso!')
            return redirect_next('/')
    else:
        form = ProfessorPerfilForm(instance=professor)

    return render(request, 'accounts/completar_perfil_professor.html', {'form': form})


@login_required
@require_POST
def saltar_perfil_aluno(request):
    """Salta a personalização do perfil de aluno — marca como completo e redireciona ao dashboard."""
    from apps.alunos.models import Aluno
    Aluno.objects.get_or_create(profile=request.user)
    request.user.perfil_completo = True
    request.user.save()
    messages.info(request, 'Personalização do perfil guardada para mais tarde.')
    return redirect_next('/')


@login_required
@require_POST
def saltar_perfil_professor(request):
    """Salta a personalização do perfil de professor — marca como completo e redireciona ao dashboard."""
    request.user.perfil_completo = True
    request.user.save()
    messages.info(request, 'Personalização do perfil guardada para mais tarde.')
    return redirect_next('/')


# ── Preferências (tema + notificações) ──────────────────────────────────────

@login_required
@require_POST
def atualizar_tema(request):
    """Chamado via fetch() pelo alternador de tema na topbar -- persiste a escolha na conta."""
    tema = request.POST.get('tema', '')
    if tema in dict(User.TEMA_CHOICES):
        request.user.tema_preferido = tema
        request.user.save(update_fields=['tema_preferido'])
        return JsonResponse({'ok': True})
    return JsonResponse({'ok': False}, status=400)


@login_required
@require_POST
def atualizar_preferencias_notificacao(request):
    user = request.user
    user.notif_email_novidades = 'notif_email_novidades' in request.POST
    user.notif_email_comunidade = 'notif_email_comunidade' in request.POST
    user.notif_email_gamificacao = 'notif_email_gamificacao' in request.POST
    user.save(update_fields=['notif_email_novidades', 'notif_email_comunidade', 'notif_email_gamificacao'])
    messages.success(request, 'Preferências de notificação atualizadas.')
    return redirect_next('/configuracoes')


# ── Autenticação de dois fatores (2FA) ──────────────────────────────────────

@login_required
def configurar_2fa(request):
    device_confirmado = TOTPDevice.objects.filter(user=request.user, confirmed=True).first()
    if device_confirmado:
        return render(request, 'accounts/configurar_2fa.html', {'ativo': True})

    device, _ = TOTPDevice.objects.get_or_create(
        user=request.user, confirmed=False, defaults={'name': 'default'}
    )

    if request.method == 'POST':
        codigo = request.POST.get('codigo', '').strip().replace(' ', '')
        if device.verify_token(codigo):
            device.confirmed = True
            device.save()

            StaticDevice.objects.filter(user=request.user).delete()
            static_device = StaticDevice.objects.create(user=request.user, name='backup')
            codigos_backup = []
            for _ in range(10):
                token = StaticToken.random_token()
                StaticToken.objects.create(device=static_device, token=token)
                codigos_backup.append(token)

            return render(request, 'accounts/configurar_2fa.html', {
                'ativo': True,
                'recem_ativado': True,
                'codigos_backup': codigos_backup,
            })
        messages.error(request, 'Código inválido. Confirma a hora do teu telemóvel e tenta novamente.')

    qr_img = qrcode.make(device.config_url)
    buffer = io.BytesIO()
    qr_img.save(buffer, format='PNG')
    qr_base64 = base64.b64encode(buffer.getvalue()).decode('ascii')

    return render(request, 'accounts/configurar_2fa.html', {
        'ativo': False,
        'qr_base64': qr_base64,
        'secret': base64.b32encode(device.bin_key).decode('utf-8'),
    })


@login_required
@require_POST
def desativar_2fa(request):
    TOTPDevice.objects.filter(user=request.user).delete()
    StaticDevice.objects.filter(user=request.user).delete()
    messages.success(request, 'Autenticação de dois fatores desativada.')
    return redirect_next('/configuracoes')


# ── Endpoints JSON para o frontend Next.js (Autenticação) ───────────────────

@require_GET
def auth_csrf(request):
    """Devolve o token CSRF necessário para requests POST autenticados."""
    return JsonResponse({'csrfToken': get_token(request)})


@csrf_exempt
@require_POST
def auth_login_json(request):
    """Login via JSON (para o Next.js). Devolve o utilizador + define cookie de sessão."""
    import json
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
        return JsonResponse(
            {'ok': False, 'error': '2FA ativo — ainda não suportado neste endpoint.', 'requires2fa': True},
            status=401,
        )

    login(request, user)
    if registrar_atividade_diaria(user):
        creditar_moedas(user, 5, 'login_diario')

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


def _user_payload(user: User) -> dict:
    name = f"{user.first_name or user.username}"
    if user.last_name:
        name = f"{name} {user.last_name}".strip()
    initials = (
        ((user.first_name or user.username or '?')[0])
        + ((user.last_name or '')[0:1] or '')
    ).upper()
    return {
        'id': user.id,
        'name': name,
        'username': user.username,
        'email': user.email,
        'initials': initials or user.username[0].upper(),
        'isTeacher': user.is_teacher if hasattr(user, 'is_teacher') else False,
        'isStudent': user.is_student if hasattr(user, 'is_student') else True,
    }
