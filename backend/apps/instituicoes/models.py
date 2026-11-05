from django.conf import settings
from django.db import models


class Instituicao(models.Model):
    """Escola, centro ou organização parceira, criada pela equipa EYK."""
    TIPOS = [
        ('escola', 'Escola'),
        ('associacao', 'Associação'),
        ('universidade', 'Universidade'),
        ('entidade_publica', 'Entidade pública'),
        ('patrocinador', 'Patrocinador'),
        ('centro', 'Centro'),
    ]
    PREPARACAO, ATIVA, SUSPENSA, ENCERRADA = 'preparacao', 'ativa', 'suspensa', 'encerrada'
    ESTADOS = [
        (PREPARACAO, 'Em preparação'),
        (ATIVA, 'Ativa'),
        (SUSPENSA, 'Suspensa'),
        (ENCERRADA, 'Encerrada'),
    ]

    nome = models.CharField(max_length=200)
    tipo = models.CharField(max_length=20, choices=TIPOS, default='escola')
    provincia = models.CharField(max_length=60)
    estado = models.CharField(max_length=12, choices=ESTADOS, default=PREPARACAO, db_index=True)
    responsavel_nome = models.CharField(max_length=200)
    responsavel_email = models.EmailField()
    armazenamento_mb = models.PositiveIntegerField(default=1024)
    ficheiro_max_mb = models.PositiveIntegerField(default=50)
    utilizadores_max = models.PositiveIntegerField(default=100)
    criada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='instituicoes_criadas',
    )
    criada_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['nome']

    def __str__(self):
        return self.nome


class MembroInstituicao(models.Model):
    """Pertença de uma conta a uma instituição."""
    PAPEIS = [
        ('administrador', 'Administrador'),
        ('coordenador', 'Coordenador'),
        ('educador', 'Educador'),
        ('familia', 'Família'),
        ('aluno', 'Aluno'),
    ]
    ATIVO, REMOVIDO = 'ativo', 'removido'
    ESTADOS = [(ATIVO, 'Ativo'), (REMOVIDO, 'Removido')]

    instituicao = models.ForeignKey(Instituicao, on_delete=models.CASCADE, related_name='membros')
    utilizador = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='pertencas')
    papel = models.CharField(max_length=15, choices=PAPEIS)
    estado = models.CharField(max_length=10, choices=ESTADOS, default=ATIVO)
    desde = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['instituicao', 'utilizador'], name='membro_unico_por_instituicao'),
        ]

    def __str__(self):
        return f'{self.utilizador} · {self.instituicao} ({self.papel})'


class ConviteInstituicao(models.Model):
    """Convite por email. O código é secreto e só serve à conta com o mesmo email."""
    PENDENTE, ACEITE, CANCELADO = 'pendente', 'aceite', 'cancelado'
    ESTADOS = [(PENDENTE, 'Pendente'), (ACEITE, 'Aceite'), (CANCELADO, 'Cancelado')]

    instituicao = models.ForeignKey(Instituicao, on_delete=models.CASCADE, related_name='convites')
    codigo = models.CharField(max_length=16, unique=True)
    email = models.EmailField()
    papel = models.CharField(max_length=15, choices=MembroInstituicao.PAPEIS)
    estado = models.CharField(max_length=10, choices=ESTADOS, default=PENDENTE, db_index=True)
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='convites_criados',
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    expira_em = models.DateTimeField()
    email_enviado_em = models.DateTimeField(null=True, blank=True)
    aceite_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='convites_aceites',
    )
    aceite_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-criado_em']

    def __str__(self):
        return f'{self.instituicao} → {self.email} ({self.estado})'
