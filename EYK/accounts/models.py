# Create your models here.

from django.db import models
from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    is_student = models.BooleanField(default=False)
    is_teacher = models.BooleanField(default=False)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    morada = models.CharField(max_length=200, null=True)
    perfil_completo = models.BooleanField(default=False)  # controla redirecionamento após 1º login


    def __str__(self):
        return self.username