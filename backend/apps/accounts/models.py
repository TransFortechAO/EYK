from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    TEMA_CHOICES = [
        ('auto', 'Automático (segue o sistema)'),
        ('claro', 'Claro'),
        ('escuro', 'Escuro'),
    ]

    is_student = models.BooleanField(default=False)
    is_teacher = models.BooleanField(default=False)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    morada = models.CharField(max_length=200, null=True, blank=True)
    perfil_completo = models.BooleanField(default=False)

    tema_preferido = models.CharField(max_length=10, choices=TEMA_CHOICES, default='auto')
    notif_email_novidades = models.BooleanField(default=True)
    notif_email_comunidade = models.BooleanField(default=True)
    notif_email_gamificacao = models.BooleanField(default=True)

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
