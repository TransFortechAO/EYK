# Create your views here.

from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from .forms import UserRegisterForm, UserLoginForm, UserUpdateForm


def register_view(request):
    if request.method == 'POST':
        form = UserRegisterForm(request.POST)
        if form.is_valid():
            user = form.save()
            
            messages.success(request, 'Conta criada con sucesso! Bem-vindo ao EYK.')
            return redirect('accounts:login')
        else:
            print(form.errors)
    else:
        form = UserRegisterForm()
    return render(request, 'accounts/register.html', {'form': form})


def login_view(request):
    if request.method == 'POST' : 
        form = UserLoginForm(request, data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)
            messages.sucess(request, f'Bem-vindo, {user.username}!')
            return redirect('accounts:dashboard_redirect')
    else:
        form = UserLoginForm()
    return render(request, 'accounts/login.html', {'form': form})


def logout_view(request):
    logout(request)
    messages.info(request, 'Sessão terminada.')
    return redirect('accounts:login')


def dashboard_redirect(request):
    user = request.user
    if user.is_teacher:
        return redirect('teacher:dashoard')
    elif user.is_student:
        return redirect('student:dashbosrd')
    elif user.is_staff:
        return redirect('admins:dashboard')
    return redirect('accounts:login')
