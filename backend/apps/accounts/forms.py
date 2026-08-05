from django import forms
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm

from apps.alunos.models import Aluno
from apps.professores.models import Professor

from .mixins import StyledFormMixin
from .models import User


class AlunoPerfilForm(forms.ModelForm):
    class Meta:
        model = Aluno
        fields = ['bio', 'foto']
        widgets = {
            'bio': forms.Textarea(attrs={'class': 'form-control', 'rows': 4, 'placeholder': 'Conta-nos um pouco sobre ti...'}),
            'foto': forms.ClearableFileInput(attrs={'class': 'form-control'}),
        }
        labels = {
            'bio': 'Biografia',
            'foto': 'Foto de Perfil',
        }


class ProfessorPerfilForm(forms.ModelForm):
    class Meta:
        model = Professor
        fields = ['nome_publico', 'bio', 'area', 'foto']
        widgets = {
            'nome_publico': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Nome que será exibido na plataforma'}),
            'bio': forms.Textarea(attrs={'class': 'form-control', 'rows': 4, 'placeholder': 'Descreve a tua experiência e especialidades...'}),
            'area': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Ex: Matemática, Programação, Idiomas...'}),
            'foto': forms.ClearableFileInput(attrs={'class': 'form-control'}),
        }
        labels = {
            'nome_publico': 'Nome Público',
            'bio': 'Biografia',
            'area': 'Área de Atuação',
            'foto': 'Foto de Perfil',
        }

class UserRegisterForm(StyledFormMixin, UserCreationForm):
    email = forms.EmailField(required=True)
    bio = forms.CharField(widget=forms.Textarea, required=False, label="Biografia")

    # ✅ Removidos: 'curso' e 'data_nascimento' não existem no modelo Aluno
    # Se precisares destes campos, adiciona-os primeiro ao modelo Aluno com uma migração

    class Meta:
        model = User
        fields = ['username', 'email', 'password1', 'password2']

    def save(self, commit=True):
        user = super().save(commit=False)
        user.is_student = True

        if commit:
            user.save()

            # Criar ou actualizar perfil do aluno
            from apps.alunos.models import Aluno
            aluno, created = Aluno.objects.get_or_create(profile=user)
            aluno.bio = self.cleaned_data.get('bio', '')
            # ✅ Removidos: aluno.curso e aluno.data_nascimento (campos não existem)
            aluno.save()

        return user

class UserLoginForm(StyledFormMixin, AuthenticationForm):
    default_input_class = 'form-control'

    username = forms.CharField(
        label='Nome de utilizador ou email',
        max_length=254,
        widget=forms.TextInput(attrs={'autofocus': True, 'placeholder': 'Introduz o teu username ou email'}),
    )

    error_messages = {
        'invalid_login': (
            'Credenciais inválidas. Verifica o nome de utilizador / email '
            'e a palavra-passe e tenta novamente.'
        ),
        'inactive': 'Esta conta está desativada. Contacta-nos para mais informações.',
    }

    def clean(self):
        username_or_email = self.cleaned_data.get('username')
        password = self.cleaned_data.get('password')

        if username_or_email and password:
            # 1) Tentar encontrar user por username OU por email (case-insensitive no email)
            UserModel = self.user_cache.__class__ if self.user_cache else User
            user = None
            try:
                user = UserModel._default_manager.get_by_natural_key(username_or_email)
            except UserModel.DoesNotExist:
                # Se não encontrou por username, tenta por email (case-insensitive)
                try:
                    user = UserModel._default_manager.get(email__iexact=username_or_email)
                except UserModel.DoesNotExist:
                    user = None

            if user is not None:
                # Usa a lógica standard do AuthenticationForm a partir do user encontrado
                self.user_cache = user
                self.cleaned_data['username'] = user.get_username()

        return super().clean()