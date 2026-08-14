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
