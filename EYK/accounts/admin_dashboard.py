from django.shortcuts import render, redirect
from django.contrib.admin.views.decorators import staff_member_required
from django.contrib import messages
from django import forms
from .models import User
from professores.models import Professor


class RegistarProfessorForm(forms.Form):
    username = forms.CharField(
        max_length=150,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Nome de utilizador'})
    )
    email = forms.EmailField(
        widget=forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'Email do professor'})
    )
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'Senha temporária'}),
        label='Senha temporária'
    )
    nome_publico = forms.CharField(
        max_length=150,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Nome que aparece na plataforma'})
    )
    area = forms.CharField(
        max_length=100,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Ex: Matemática, Programação...'})
    )

    def clean_username(self):
        username = self.cleaned_data['username']
        if User.objects.filter(username=username).exists():
            raise forms.ValidationError('Este nome de utilizador já existe.')
        return username

    def clean_email(self):
        email = self.cleaned_data['email']
        if User.objects.filter(email=email).exists():
            raise forms.ValidationError('Este email já está registado.')
        return email


@staff_member_required
def registar_professor(request):
    """Dashboard exclusivo para admins registarem professores"""
    professores = Professor.objects.select_related('user').order_by('-criado_em')

    if request.method == 'POST':
        form = RegistarProfessorForm(request.POST)
        if form.is_valid():
            # Criar o utilizador
            user = User.objects.create_user(
                username=form.cleaned_data['username'],
                email=form.cleaned_data['email'],
                password=form.cleaned_data['password'],
                is_teacher=True,
                perfil_completo=False,  # forçar personalização no 1º login
            )
            # Criar o perfil de professor
            Professor.objects.create(
                user=user,
                nome_publico=form.cleaned_data['nome_publico'],
                area=form.cleaned_data['area'],
            )
            messages.success(request, f'Professor "{user.username}" registado com sucesso! No primeiro login será redirecionado para completar o perfil.')
            return redirect('accounts:dashboard-professores')
    else:
        form = RegistarProfessorForm()

    return render(request, 'accounts/dashboard_professores.html', {
        'form': form,
        'professores': professores,
    })
