from django.db import models
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    is_student = models.BooleanField(default=False)
    is_teacher = models.BooleanField(default=False)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    morada = models.CharField(max_length=200, null=True, blank=True)
    perfil_completo = models.BooleanField(default=False)

    def __str__(self):
        return self.username


class Notificacao(models.Model):
    TIPOS = [
        ('novidade', 'Novidade da Plataforma'),
        ('conquista', 'Conquista'),
        ('saque', 'Saque'),
        ('lancamento', 'Lançamento'),
    ]
    utilizador = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notificacoes')
    tipo = models.CharField(max_length=20, choices=TIPOS, default='novidade')
    mensagem = models.TextField()
    lida = models.BooleanField(default=False)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-criado_em']

    def __str__(self):
        return f'[{self.tipo}] {self.utilizador.username}'
