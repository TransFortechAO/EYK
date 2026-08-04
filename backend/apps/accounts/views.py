import base64
import io

import qrcode
from django.conf import settings
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST
from django_otp import match_token
from django_otp.plugins.otp_static.models import StaticDevice, StaticToken
from django_otp.plugins.otp_totp.models import TOTPDevice

from apps.gamificacao.services import creditar_moedas, registrar_atividade_diaria

from .forms import AlunoPerfilForm, ProfessorPerfilForm, UserLoginForm, UserRegisterForm
from .models import User

PRE_2FA_SESSION_KEY = 'pre_2fa_user_id'


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
    return redirect('feed:home')


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
            return redirect('feed:home')
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
        return redirect('feed:home')

    if request.method == 'POST':
        form = ProfessorPerfilForm(request.POST, request.FILES, instance=professor)
        if form.is_valid():
            form.save()
            request.user.perfil_completo = True
            request.user.save()
            messages.success(request, 'Perfil de professor atualizado com sucesso!')
            return redirect('feed:home')
    else:
        form = ProfessorPerfilForm(instance=professor)

    return render(request, 'accounts/completar_perfil_professor.html', {'form': form})


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
    if user.is_teacher:
        return redirect('professores:configuracoes')
    return redirect('alunos:configuracoes')


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
    if request.user.is_teacher:
        return redirect('professores:configuracoes')
    return redirect('alunos:configuracoes')
