from django import forms
from django.contrib.auth.forms import UserCreationForm, UserChangeForm, AuthenticationForm
from .models import User
from .mixins import StyledFormMixin

class UserRegisterForm(StyledFormMixin, UserCreationForm):
    email = forms.EmailField(required=True)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'phone_number', 'password1', 'password2']

    def save(self, commit=True):
        user = super().save(commit=False)
        user.is_student = True
        if commit:
            user.save()
        return user

class UserUpdateForm(StyledFormMixin, UserChangeForm):
    class Meta:
        model = User
        fields = ['username', 'email', 'bio']

    default_input_class = 'form-control'


class UserLoginForm(StyledFormMixin, AuthenticationForm):
    default_input_class = 'form-control'
