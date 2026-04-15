from django import forms
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from .models import User
from .mixins import StyledFormMixin
from alunos.models import Aluno
from professores.models import Professor


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
            from alunos.models import Aluno
            aluno, created = Aluno.objects.get_or_create(profile=user)
            aluno.bio = self.cleaned_data.get('bio', '')
            # ✅ Removidos: aluno.curso e aluno.data_nascimento (campos não existem)
            aluno.save()

        return user

class UserLoginForm(StyledFormMixin, AuthenticationForm):
    default_input_class = 'form-control'