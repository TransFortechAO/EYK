from django.conf import settings
from django.db import models

TIPOS_CONTEUDO = [
    ('post', 'Publicação na comunidade'),
    ('comentario', 'Comentário na comunidade'),
    ('comentario_video', 'Comentário num vídeo'),
    ('video', 'Vídeo'),
    ('curso', 'Curso'),
    ('avaliacao', 'Avaliação de curso'),
    ('utilizador', 'Perfil de utilizador'),
]

MOTIVOS = [
    ('assedio', 'Assédio ou bullying'),
    ('sexual', 'Conteúdo sexual'),
    ('odio', 'Discurso de ódio'),
    ('violencia', 'Violência ou ameaças'),
    ('spam', 'Spam ou publicidade'),
    ('falso', 'Informação falsa'),
    ('direitos_autor', 'Violação de direitos de autor'),
    ('outro', 'Outro'),
    ('filtro_automatico', 'Detetado automaticamente'),
]

# Peso de cada motivo na fila de moderação (mais alto = mais urgente). Os de
# peso 3 também alertam os administradores logo que chegam.
GRAVIDADE = {
    'sexual': 3, 'odio': 3, 'violencia': 3, 'assedio': 3,
    'spam': 2, 'falso': 2, 'direitos_autor': 2, 'filtro_automatico': 2,
    'outro': 1,
}


class Denuncia(models.Model):
    ESTADOS = [
        ('pendente', 'Pendente'),
        ('resolvida', 'Resolvida (tomámos medidas)'),
        ('rejeitada', 'Rejeitada (não viola as regras)'),
    ]

    # null = criada pelo sistema (filtro de palavras).
    denunciante = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='denuncias_feitas',
    )
    tipo = models.CharField(max_length=20, choices=TIPOS_CONTEUDO)
    objeto_id = models.PositiveBigIntegerField()
    # Autor do conteúdo denunciado — para o histórico e reincidência, mesmo
    # que o conteúdo venha a ser apagado.
    alvo = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='denuncias_recebidas',
    )
    motivo = models.CharField(max_length=20, choices=MOTIVOS)
    descricao = models.TextField(blank=True)
    # Cópia do texto no momento da denúncia (fica como prova se for apagado/editado).
    resumo_conteudo = models.TextField(blank=True)
    estado = models.CharField(max_length=10, choices=ESTADOS, default='pendente', db_index=True)
    criada_em = models.DateTimeField(auto_now_add=True)
    resolvida_em = models.DateTimeField(null=True, blank=True)
    resolvida_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+',
    )

    class Meta:
        ordering = ['-criada_em']
        indexes = [models.Index(fields=['tipo', 'objeto_id'])]
        constraints = [
            models.UniqueConstraint(
                fields=['denunciante', 'tipo', 'objeto_id'], name='denuncia_unica_por_pessoa',
                condition=models.Q(denunciante__isnull=False),
            ),
        ]

    def __str__(self):
        return f'{self.get_tipo_display()} #{self.objeto_id} — {self.get_motivo_display()}'


class AcaoModeracao(models.Model):
    """Registo de moderação: tudo o que foi feito, por quem e porquê."""
    TIPOS = [
        ('ocultar', 'Conteúdo ocultado'),
        ('restaurar', 'Conteúdo reposto'),
        ('apagar', 'Conteúdo apagado'),
        ('rejeitar', 'Denúncias rejeitadas'),
        ('aviso', 'Aviso'),
        ('suspensao', 'Suspensão'),
        ('banimento', 'Banimento'),
        ('levantar', 'Sanção levantada'),
    ]

    # null = ação automática do sistema.
    moderador = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='acoes_moderacao',
    )
    alvo = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='sancoes',
    )
    tipo = models.CharField(max_length=15, choices=TIPOS)
    motivo = models.TextField(blank=True)
    conteudo_tipo = models.CharField(max_length=20, choices=TIPOS_CONTEUDO, blank=True)
    conteudo_id = models.PositiveBigIntegerField(null=True, blank=True)
    resumo_conteudo = models.TextField(blank=True)
    duracao_dias = models.PositiveSmallIntegerField(null=True, blank=True)
    automatica = models.BooleanField(default=False)
    # Anulada depois de uma contestação aceite — deixa de contar para a reincidência.
    revertida = models.BooleanField(default=False)
    criada_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-criada_em']

    def __str__(self):
        return f'{self.get_tipo_display()} · {self.alvo}'


class Contestacao(models.Model):
    """Recurso do utilizador contra uma ação de moderação."""
    ESTADOS = [
        ('pendente', 'Pendente'),
        ('aceite', 'Aceite'),
        ('recusada', 'Recusada'),
    ]
    acao = models.OneToOneField(AcaoModeracao, on_delete=models.CASCADE, related_name='contestacao')
    utilizador = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='contestacoes')
    texto = models.TextField()
    estado = models.CharField(max_length=10, choices=ESTADOS, default='pendente', db_index=True)
    resposta = models.TextField(blank=True)
    criada_em = models.DateTimeField(auto_now_add=True)
    respondida_em = models.DateTimeField(null=True, blank=True)
    respondida_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+',
    )

    class Meta:
        ordering = ['-criada_em']

    def __str__(self):
        return f'Contestação de {self.utilizador} ({self.get_estado_display()})'


class Bloqueio(models.Model):
    """`utilizador` deixa de ver (e de ser incomodado por) `bloqueado` — nos
    dois sentidos: nenhum vê as publicações/comentários do outro."""
    utilizador = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bloqueios')
    bloqueado = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bloqueado_por')
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('utilizador', 'bloqueado')
        ordering = ['-criado_em']

    def __str__(self):
        return f'{self.utilizador} bloqueou {self.bloqueado}'


class PalavraProibida(models.Model):
    ACOES = [
        ('bloquear', 'Impedir a publicação'),
        ('sinalizar', 'Publicar, mas enviar para a fila de moderação'),
    ]
    termo = models.CharField(max_length=100, unique=True)
    acao = models.CharField(max_length=10, choices=ACOES, default='bloquear')
    criada_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['termo']

    def __str__(self):
        return self.termo
