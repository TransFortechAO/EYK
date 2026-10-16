from django import forms
from django.contrib.auth.forms import UserCreationForm

from .mixins import StyledFormMixin
from .models import User


class UserRegisterForm(StyledFormMixin, UserCreationForm):
    email = forms.EmailField(required=True)
    bio = forms.CharField(widget=forms.Textarea, required=False, label="Biografia")

    class Meta:
        model = User
        fields = ['username', 'email', 'password1', 'password2']

    def clean_email(self):
        # O login passou a aceitar o email (ver `auth_login_json`), que só é
        # seguro se o email identificar sempre UM único utilizador — por
        # isso a unicidade tem de ser garantida já aqui, no registo.
        email = self.cleaned_data.get('email', '').strip()
        if email and User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError('Já existe uma conta com este email.')
        return email

    def save(self, commit=True):
        user = super().save(commit=False)
        user.is_student = True

        if commit:
            user.save()

            # Criar ou actualizar perfil do aluno
            from apps.alunos.models import Aluno
            aluno, created = Aluno.objects.get_or_create(profile=user)
            aluno.bio = self.cleaned_data.get('bio', '')
            aluno.save()

        return user
