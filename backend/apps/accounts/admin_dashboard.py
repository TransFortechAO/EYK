from django import forms
from django.contrib import messages
from django.contrib.admin.views.decorators import staff_member_required
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from apps.professores.models import Professor

from .models import User


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


# ── Gestão geral de utilizadores ────────────────────────────────────────────

@staff_member_required
def gerenciar_usuarios(request):
    """Dashboard exclusivo para admins listarem, pesquisarem e gerirem utilizadores"""
    usuarios = User.objects.all().order_by('-date_joined')

    q = request.GET.get('q', '').strip()
    if q:
        usuarios = usuarios.filter(Q(username__icontains=q) | Q(email__icontains=q))

    tipo = request.GET.get('tipo', '')
    if tipo == 'aluno':
        usuarios = usuarios.filter(is_student=True)
    elif tipo == 'professor':
        usuarios = usuarios.filter(is_teacher=True)
    elif tipo == 'staff':
        usuarios = usuarios.filter(is_staff=True)

    return render(request, 'accounts/dashboard_usuarios.html', {
        'usuarios': usuarios,
        'q': q,
        'tipo': tipo,
    })


@staff_member_required
@require_POST
def toggle_ativo_usuario(request, user_id):
    utilizador = get_object_or_404(User, id=user_id)

    if utilizador == request.user:
        messages.error(request, 'Não podes ativar/desativar a tua própria conta.')
    elif utilizador.is_staff or utilizador.is_superuser:
        messages.error(request, 'Não é possível ativar/desativar outra conta de administrador.')
    else:
        utilizador.is_active = not utilizador.is_active
        utilizador.save()
        estado = 'ativada' if utilizador.is_active else 'desativada'
        messages.success(request, f'Conta de "{utilizador.username}" {estado} com sucesso.')

    return redirect('accounts:dashboard-usuarios')


@staff_member_required
def apagar_usuario(request, user_id):
    utilizador = get_object_or_404(User, id=user_id)

    if utilizador == request.user:
        messages.error(request, 'Não podes apagar a tua própria conta por aqui.')
        return redirect('accounts:dashboard-usuarios')
    if utilizador.is_staff or utilizador.is_superuser:
        messages.error(request, 'Não é possível apagar outra conta de administrador.')
        return redirect('accounts:dashboard-usuarios')

    if request.method == 'POST':
        username = utilizador.username
        utilizador.delete()
        messages.success(request, f'Utilizador "{username}" apagado com sucesso.')
        return redirect('accounts:dashboard-usuarios')

    return render(request, 'accounts/confirmar_apagar_usuario.html', {'utilizador': utilizador})
