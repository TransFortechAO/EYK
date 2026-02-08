# Create your models here.
from django.db import models
from accounts.models import User

class Professor(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    nome_publico = models.CharField(max_length=150)
    bio = models.TextField(blank=True)
    area = models.CharField(max_length=100)
    foto = models.ImageField(upload_to='professores/', blank=True)
    ativo= models.BooleanField(default=True)
    criado_em= models.DateTimeField(auto_now_add=True)


    def __str__(self):
        return self.user.nome_publico
