from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from .forms import UserRegisterForm, UserLoginForm, AlunoPerfilForm, ProfessorPerfilForm
from .models import User


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


def login_view(request):
    if request.method == 'POST':
        form = UserLoginForm(request, data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)

            # Redireciona para personalização se o perfil ainda não foi completado
            if not user.perfil_completo:
                if user.is_student:
                    messages.info(request, f'Bem-vindo, {user.username}! Completa o teu perfil.')
                    return redirect('accounts:completar-perfil-aluno')
                elif user.is_teacher:
                    messages.info(request, f'Bem-vindo, {user.username}! Completa o teu perfil de professor.')
                    return redirect('accounts:completar-perfil-professor')

            messages.success(request, f'Bem-vindo, {user.username}!')
            return redirect('feed:home')
        else:
            print(form.errors)
    else:
        form = UserLoginForm()
    return render(request, 'accounts/login.html', {'form': form})


def logout_view(request):
    logout(request)
    messages.info(request, 'Sessão terminada.')
    return redirect('index')


@login_required
def completar_perfil_aluno(request):
    """Página de personalização do perfil do aluno (bio + foto)"""
    from alunos.models import Aluno
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
    from professores.models import Professor
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
