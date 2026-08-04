from django.contrib.auth import get_user_model
from django.db import models

User = get_user_model()


class AuditLog(models.Model):
    """
    Log de auditoria para rastrear todas as ações importantes no sistema
    """
    ACAO_CHOICES = [
        ('CREATE', 'Criação'),
        ('UPDATE', 'Atualização'),
        ('DELETE', 'Exclusão'),
        ('LOGIN', 'Login'),
        ('LOGOUT', 'Logout'),
        ('PERMISSAO_ALTERADA', 'Permissão Alterada'),
        ('DADOS_SENSIVEIS_ACESSADOS', 'Dados Sensíveis Acessados'),
    ]

    usuario = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='audit_logs',
        verbose_name='Usuário'
    )
    acao = models.CharField(max_length=50, choices=ACAO_CHOICES, verbose_name='Ação')
    entidade = models.CharField(max_length=100, verbose_name='Entidade')
    entidade_id = models.CharField(max_length=100, null=True, blank=True, verbose_name='ID da Entidade')
    detalhes = models.JSONField(null=True, blank=True, verbose_name='Detalhes da Ação')
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name='Endereço IP')
    user_agent = models.TextField(null=True, blank=True, verbose_name='User Agent')
    data_criacao = models.DateTimeField(auto_now_add=True, verbose_name='Data de Criação')

    class Meta:
        verbose_name = 'Log de Auditoria'
        verbose_name_plural = 'Logs de Auditoria'
        ordering = ['-data_criacao']
        indexes = [
            models.Index(fields=['usuario', 'data_criacao']),
            models.Index(fields=['acao', 'entidade']),
        ]

    def __str__(self):
        return f"{self.usuario} - {self.acao} - {self.entidade} - {self.data_criacao}"