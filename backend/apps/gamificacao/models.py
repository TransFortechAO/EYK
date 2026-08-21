from django.db import models

from apps.accounts.models import User


class Carteira(models.Model):
    utilizador = models.OneToOneField(User, on_delete=models.CASCADE, related_name='carteira')
    saldo = models.PositiveIntegerField(default=0)
    # XP nunca desce (nem quando o saldo de coins é gasto) — é a única base do nível.
    xp = models.PositiveIntegerField(default=0)
    atualizado_em = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.utilizador.username} — {self.saldo} moedas, {self.xp} XP'


class TransacaoMoeda(models.Model):
    MOTIVOS = [
        ('curso_concluido', 'Curso concluído'),
        ('streak_mensal', 'Streak de 30 dias'),
        ('indicacao_amigo', 'Amigo indicado'),
        ('views_professor', 'Visualizações (professor)'),
        ('ajuste_admin', 'Ajuste do administrador'),
    ]
    utilizador = models.ForeignKey(User, on_delete=models.CASCADE, related_name='transacoes_moeda')
    valor = models.IntegerField()
    motivo = models.CharField(max_length=30, choices=MOTIVOS)
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


class Badge(models.Model):
    """Definição de uma conquista. As condições reais estão em services.py
    (BADGES); esta tabela guarda só o texto/ícone/ordem para exibição."""
    slug = models.SlugField(max_length=50, unique=True)
    nome = models.CharField(max_length=100)
    descricao = models.CharField(max_length=255)
    icone = models.CharField(max_length=50, help_text='Nome do ícone lucide-react (ex: "Flame").')
    ordem = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['ordem']

    def __str__(self):
        return self.nome


class AlunoBadge(models.Model):
    utilizador = models.ForeignKey(User, on_delete=models.CASCADE, related_name='badges_conquistados')
    badge = models.ForeignKey(Badge, on_delete=models.CASCADE, related_name='conquistas')
    desbloqueado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('utilizador', 'badge')
        ordering = ['-desbloqueado_em']

    def __str__(self):
        return f'{self.utilizador.username} — {self.badge.nome}'
