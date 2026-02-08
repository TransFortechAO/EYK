# Create your models here.

from django.db import models
from accounts.models import User


class Aluno(models.Model):
    profile = models.OneToOneField(User, on_delete=models.CASCADE)
    bio = models.TextField(blank=True)
    foto = models.ImageField(upload_to='alunos/', blank=True, null=True)

    def __str__(self):
        return self.profile.user.username