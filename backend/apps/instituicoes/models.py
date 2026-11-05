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
    # Pedidos feitos por código precisam de aprovação do administrador.
    aprovar_pedidos_por_codigo = models.BooleanField(default=True)
    canais_aviso = models.JSONField(default=list, blank=True)
    comunidade_publica_para_alunos = models.BooleanField(default=False)
    ranking_visivel = models.BooleanField(default=True)
    criada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='instituicoes_criadas',
    )
    criada_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['nome']

    def __str__(self):
        return self.nome


class GrupoInstituicao(models.Model):
    """Turma ou grupo. Arquivar no fim do ano letivo guarda o histórico."""
    TIPOS = [
        ('turma', 'Turma'),
        ('turma_lga', 'Turma LGA'),
        ('apoio', 'Grupo de apoio'),
        ('familias', 'Grupo de famílias'),
        ('outro', 'Outro'),
    ]

    instituicao = models.ForeignKey(Instituicao, on_delete=models.CASCADE, related_name='grupos')
    nome = models.CharField(max_length=200)
    tipo = models.CharField(max_length=12, choices=TIPOS, default='turma')
    ano_letivo = models.CharField(max_length=20, blank=True)
    arquivado = models.BooleanField(default=False)
    criado_em = models.DateTimeField(auto_now_add=True)

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
    ultimo_acesso = models.DateTimeField(null=True, blank=True)
    grupos = models.ManyToManyField(GrupoInstituicao, blank=True, related_name='membros')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['instituicao', 'utilizador'], name='membro_unico_por_instituicao'),
        ]

    def __str__(self):
        return f'{self.utilizador} · {self.instituicao} ({self.papel})'


class PerfilAluno(models.Model):
    """Perfil de uma criança com o mínimo de dados: nome ou alcunha e turma. Nasce à espera do
    consentimento do tutor; sem o consentimento de utilização fica inativo."""
    AGUARDA, ATIVO, RETIRADO = 'aguarda_consentimento', 'ativo', 'consentimento_retirado'
    ESTADOS = [(AGUARDA, 'À espera de consentimento'), (ATIVO, 'Ativo'), (RETIRADO, 'Consentimento retirado')]

    instituicao = models.ForeignKey(Instituicao, on_delete=models.CASCADE, related_name='alunos')
    nome = models.CharField(max_length=120)
    grupo = models.ForeignKey(GrupoInstituicao, on_delete=models.SET_NULL, null=True, blank=True, related_name='alunos')
    tutores = models.ManyToManyField(MembroInstituicao, blank=True, related_name='criancas')
    # Conta de aluno da criança, quando ela entra no EYK.
    conta = models.ForeignKey(
        MembroInstituicao, on_delete=models.SET_NULL, null=True, blank=True, related_name='perfil_de_aluno',
    )
    estado = models.CharField(max_length=24, choices=ESTADOS, default=AGUARDA)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['nome']

    def __str__(self):
        return self.nome


class ConviteInstituicao(models.Model):
    """Convite por email, SMS ou código partilhável. O convite por email é pessoal: só serve
    à conta com o mesmo email."""
    PENDENTE, ACEITE, CANCELADO = 'pendente', 'aceite', 'cancelado'
    ESTADOS = [(PENDENTE, 'Pendente'), (ACEITE, 'Aceite'), (CANCELADO, 'Cancelado')]
    CANAIS = [('email', 'Email'), ('sms', 'SMS'), ('codigo', 'Código')]

    instituicao = models.ForeignKey(Instituicao, on_delete=models.CASCADE, related_name='convites')
    canal = models.CharField(max_length=6, choices=CANAIS, default='email')
    codigo = models.CharField(max_length=16, unique=True)
    email = models.EmailField(blank=True)
    telefone = models.CharField(max_length=30, blank=True)
    papel = models.CharField(max_length=15, choices=MembroInstituicao.PAPEIS)
    grupo = models.ForeignKey(GrupoInstituicao, on_delete=models.SET_NULL, null=True, blank=True)
    aluno = models.ForeignKey(PerfilAluno, on_delete=models.SET_NULL, null=True, blank=True)
    usos = models.PositiveIntegerField(default=0)
    usos_max = models.PositiveIntegerField(default=1)
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


class PedidoAdesao(models.Model):
    """Adesão por código à espera de aprovação da administração."""
    PENDENTE, APROVADO, REJEITADO = 'pendente', 'aprovado', 'rejeitado'
    ESTADOS = [(PENDENTE, 'Pendente'), (APROVADO, 'Aprovado'), (REJEITADO, 'Rejeitado')]

    instituicao = models.ForeignKey(Instituicao, on_delete=models.CASCADE, related_name='pedidos_adesao')
    convite = models.ForeignKey(ConviteInstituicao, on_delete=models.SET_NULL, null=True, related_name='pedidos')
    utilizador = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='pedidos_adesao')
    papel = models.CharField(max_length=15, choices=MembroInstituicao.PAPEIS)
    grupo = models.ForeignKey(GrupoInstituicao, on_delete=models.SET_NULL, null=True, blank=True)
    pedido_em = models.DateTimeField(auto_now_add=True)
    estado = models.CharField(max_length=10, choices=ESTADOS, default=PENDENTE)

    class Meta:
        ordering = ['-pedido_em']


class Consentimento(models.Model):
    """Decisão do tutor sobre uma finalidade. Nunca se edita: cada decisão é um registo novo
    (quem, o quê, quando, versão do texto)."""
    instituicao = models.ForeignKey(Instituicao, on_delete=models.CASCADE, related_name='consentimentos')
    aluno = models.ForeignKey(PerfilAluno, on_delete=models.CASCADE, related_name='consentimentos')
    tutor = models.ForeignKey(MembroInstituicao, on_delete=models.SET_NULL, null=True, related_name='consentimentos')
    tutor_nome = models.CharField(max_length=200)
    finalidade = models.CharField(max_length=20)
    aceite = models.BooleanField()
    versao_texto = models.CharField(max_length=20)
    registado_em = models.DateTimeField(auto_now_add=True)
    com_apoio = models.BooleanField(default=False)

    class Meta:
        ordering = ['registado_em', 'id']


class RegistoAuditoria(models.Model):
    """O que aconteceu na instituição, por quem e quando."""
    ORIGENS = [('instituicao', 'Instituição'), ('equipa_eyk', 'Equipa EYK')]

    instituicao = models.ForeignKey(Instituicao, on_delete=models.CASCADE, related_name='auditoria')
    quando = models.DateTimeField(auto_now_add=True)
    quem = models.CharField(max_length=200)
    origem = models.CharField(max_length=12, choices=ORIGENS, default='instituicao')
    acao = models.CharField(max_length=40)
    detalhe = models.TextField()

    class Meta:
        ordering = ['-quando', '-id']
