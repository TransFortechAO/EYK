from django.db import models

from apps.accounts.models import User


class Carteira(models.Model):
    utilizador = models.OneToOneField(User, on_delete=models.CASCADE, related_name='carteira')
    saldo = models.PositiveIntegerField(default=0)
    atualizado_em = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.utilizador.username} — {self.saldo} moedas'


class TransacaoMoeda(models.Model):
    MOTIVOS = [
        ('login_diario', 'Login diário'),
        ('post_comunidade', 'Post na comunidade'),
        ('ajuste_admin', 'Ajuste do administrador'),
    ]
    utilizador = models.ForeignKey(User, on_delete=models.CASCADE, related_name='transacoes_moeda')
    valor = models.IntegerField()
    motivo = models.CharField(max_length=20, choices=MOTIVOS)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-criado_em']

    def __str__(self):
        return f'{self.utilizador.username} {self.valor:+d} ({self.motivo})'


class Ofensiva(models.Model):
    utilizador = models.OneToOneField(User, on_delete=models.CASCADE, related_name='ofensiva')
    dias_atual = models.PositiveIntegerField(default=0)
    maior_sequencia = models.PositiveIntegerField(default=0)
    ultima_atividade = models.DateField(null=True, blank=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.utilizador.username} — {self.dias_atual} dias'
