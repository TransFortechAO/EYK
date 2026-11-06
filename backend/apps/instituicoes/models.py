from django.conf import settings
from django.db import models

from .armazenamento import caminho_ficheiro, storage_privado


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
    # Só nas Turmas LGA.
    lga_publico = models.CharField(max_length=12, blank=True)
    lga_nivel = models.CharField(max_length=12, blank=True)
    lga_descricao = models.TextField(blank=True)
    convite_alunos = models.ForeignKey(
        'ConviteInstituicao', on_delete=models.SET_NULL, null=True, blank=True, related_name='+',
    )
    convite_familias = models.ForeignKey(
        'ConviteInstituicao', on_delete=models.SET_NULL, null=True, blank=True, related_name='+',
    )
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
    # Preferência de avisos por email; None = o que a instituição tiver ligado.
    aviso_email = models.BooleanField(null=True, blank=True)
    pontos = models.PositiveIntegerField(default=0)
    # O aluno escolheu ver também a plataforma geral.
    ver_geral = models.BooleanField(default=False)
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
    """Convite por email ou código partilhável. O convite por email é pessoal: só serve
    à conta com o mesmo email."""
    PENDENTE, ACEITE, CANCELADO = 'pendente', 'aceite', 'cancelado'
    ESTADOS = [(PENDENTE, 'Pendente'), (ACEITE, 'Aceite'), (CANCELADO, 'Cancelado')]
    CANAIS = [('email', 'Email'), ('codigo', 'Código')]

    instituicao = models.ForeignKey(Instituicao, on_delete=models.CASCADE, related_name='convites')
    canal = models.CharField(max_length=6, choices=CANAIS, default='email')
    codigo = models.CharField(max_length=16, unique=True)
    email = models.EmailField(blank=True)
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


class ComDestino(models.Model):
    """A quem se dirige: toda a instituição, um grupo ou uma pessoa."""
    dest_tipo = models.CharField(max_length=12, default='instituicao')
    dest_grupo = models.ForeignKey(GrupoInstituicao, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    dest_membro = models.ForeignKey(MembroInstituicao, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')

    class Meta:
        abstract = True


class FicheiroInstituicao(ComDestino):
    CATEGORIAS = [('documento', 'Documento'), ('imagem', 'Imagem'), ('audio', 'Áudio'), ('video', 'Vídeo')]

    instituicao = models.ForeignKey(Instituicao, on_delete=models.CASCADE, related_name='ficheiros')
    ficheiro = models.FileField(storage=storage_privado, upload_to=caminho_ficheiro, max_length=300)
    nome = models.CharField(max_length=255)
    categoria = models.CharField(max_length=10, choices=CATEGORIAS)
    tamanho_bytes = models.BigIntegerField()
    tem_criancas = models.BooleanField(default=False)
    estado = models.CharField(max_length=12, default='disponivel')
    carregado_por = models.ForeignKey(MembroInstituicao, on_delete=models.SET_NULL, null=True, related_name='+')
    carregado_por_nome = models.CharField(max_length=200)
    carregado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-carregado_em', '-id']


class AnexoEscola(models.Model):
    """Vídeo ou recurso de uma aula, resposta, gesto ou conteúdo. Quem o pode ver decide-se
    pelo que o usa (ver views_lga.pode_ver_anexo)."""
    instituicao = models.ForeignKey(Instituicao, on_delete=models.CASCADE, related_name='anexos')
    ficheiro = models.FileField(storage=storage_privado, upload_to=caminho_ficheiro, max_length=300)
    nome = models.CharField(max_length=255)
    tamanho_bytes = models.BigIntegerField()
    duracao_seg = models.PositiveIntegerField(null=True, blank=True)
    criado_por = models.ForeignKey(MembroInstituicao, on_delete=models.SET_NULL, null=True, related_name='+')
    criado_em = models.DateTimeField(auto_now_add=True)


class Aviso(ComDestino):
    instituicao = models.ForeignKey(Instituicao, on_delete=models.CASCADE, related_name='avisos')
    titulo = models.CharField(max_length=200)
    mensagem = models.TextField()
    autor = models.ForeignKey(MembroInstituicao, on_delete=models.SET_NULL, null=True, related_name='+')
    autor_nome = models.CharField(max_length=200)
    publicado_em = models.DateTimeField(auto_now_add=True)
    pedir_confirmacao = models.BooleanField(default=False)
    anexos = models.ManyToManyField(FicheiroInstituicao, blank=True, related_name='avisos')

    class Meta:
        ordering = ['-publicado_em', '-id']


class LeituraAviso(models.Model):
    aviso = models.ForeignKey(Aviso, on_delete=models.CASCADE, related_name='leituras')
    membro = models.ForeignKey(MembroInstituicao, on_delete=models.CASCADE, related_name='+')
    confirmado = models.BooleanField(default=False)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['aviso', 'membro'], name='leitura_aviso_unica')]


class Evento(ComDestino):
    instituicao = models.ForeignKey(Instituicao, on_delete=models.CASCADE, related_name='eventos')
    titulo = models.CharField(max_length=200)
    descricao = models.TextField(blank=True)
    inicio = models.DateTimeField()
    fim = models.DateTimeField()
    local = models.CharField(max_length=200, blank=True)
    ligacao = models.URLField(blank=True)
    recorrencia = models.CharField(max_length=10, default='nenhuma')
    lembretes = models.JSONField(default=list, blank=True)
    # Lembretes que já saíram, para o agendador não os repetir.
    lembretes_enviados = models.JSONField(default=list, blank=True)
    cancelado = models.BooleanField(default=False)
    criado_por = models.CharField(max_length=200)

    class Meta:
        ordering = ['inicio', 'id']


class RespostaEvento(models.Model):
    evento = models.ForeignKey(Evento, on_delete=models.CASCADE, related_name='respostas')
    membro = models.ForeignKey(MembroInstituicao, on_delete=models.CASCADE, related_name='+')
    resposta = models.CharField(max_length=8)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['evento', 'membro'], name='resposta_evento_unica')]


class PedidoDados(models.Model):
    instituicao = models.ForeignKey(Instituicao, on_delete=models.CASCADE, related_name='pedidos_dados')
    tipo = models.CharField(max_length=10)
    ambito = models.CharField(max_length=12)
    alvo = models.CharField(max_length=200)
    pedido_por = models.ForeignKey(MembroInstituicao, on_delete=models.SET_NULL, null=True, related_name='+')
    pedido_por_nome = models.CharField(max_length=200)
    pedido_em = models.DateTimeField(auto_now_add=True)
    estado = models.CharField(max_length=10, default='recebido')
    # A criança a que o pedido diz respeito (ambito 'crianca').
    aluno = models.ForeignKey(PerfilAluno, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    prazo = models.DateTimeField()
    nota = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['-pedido_em', '-id']


class AcessoDia(models.Model):
    """Um registo por pessoa e dia em que entrou: é daqui que saem os acessos dos relatórios."""
    instituicao = models.ForeignKey(Instituicao, on_delete=models.CASCADE, related_name='acessos')
    membro = models.ForeignKey(MembroInstituicao, on_delete=models.CASCADE, related_name='acessos')
    dia = models.DateField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=['membro', 'dia'], name='acesso_dia_unico')]


class Aula(models.Model):
    instituicao = models.ForeignKey(Instituicao, on_delete=models.CASCADE, related_name='aulas')
    turma = models.ForeignKey(GrupoInstituicao, on_delete=models.CASCADE, related_name='aulas')
    tipo = models.CharField(max_length=10, default='aula')
    titulo = models.CharField(max_length=200)
    descricao = models.TextField(blank=True)
    video = models.ForeignKey(AnexoEscola, on_delete=models.SET_NULL, null=True, blank=True, related_name='aulas')
    legenda_pt = models.BooleanField(default=False)
    gestos_ids = models.JSONField(default=list, blank=True)
    recursos = models.ManyToManyField(AnexoEscola, blank=True, related_name='aulas_recurso')
    conteudo = models.JSONField(null=True, blank=True)
    prazo = models.DateTimeField(null=True, blank=True)
    pede_resposta = models.BooleanField(default=False)
    enunciado = models.TextField(blank=True)
    autor = models.ForeignKey(MembroInstituicao, on_delete=models.SET_NULL, null=True, related_name='+')
    autor_nome = models.CharField(max_length=200)
    publicada_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-publicada_em', '-id']


class RespostaVideo(models.Model):
    """Resposta de um aluno. Só a vêem o próprio, quem ensina na turma e a família."""
    instituicao = models.ForeignKey(Instituicao, on_delete=models.CASCADE, related_name='respostas_video')
    turma = models.ForeignKey(GrupoInstituicao, on_delete=models.CASCADE, related_name='respostas_video')
    aula = models.ForeignKey(Aula, on_delete=models.CASCADE, related_name='respostas')
    aluno = models.ForeignKey(MembroInstituicao, on_delete=models.CASCADE, related_name='respostas_video')
    aluno_nome = models.CharField(max_length=200)
    video = models.ForeignKey(AnexoEscola, on_delete=models.PROTECT, related_name='respostas')
    enviada_em = models.DateTimeField(auto_now_add=True)
    estado = models.CharField(max_length=10, default='por_rever')
    feedback_texto = models.TextField(blank=True)
    feedback_video = models.ForeignKey(AnexoEscola, on_delete=models.SET_NULL, null=True, blank=True, related_name='feedbacks')
    feedback_por = models.CharField(max_length=200, blank=True)
    feedback_em = models.DateTimeField(null=True, blank=True)
    apagar_em = models.DateTimeField()
    tentativa = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['-enviada_em', '-id']


class Gesto(models.Model):
    """Contributo de uma escola para o gestuário (os gestos da plataforma vêm do frontend)."""
    instituicao = models.ForeignKey(Instituicao, on_delete=models.CASCADE, related_name='gestos')
    palavra = models.CharField(max_length=120)
    tema = models.CharField(max_length=12)
    variante = models.CharField(max_length=80, default='Comum')
    descricao = models.TextField(blank=True)
    glyph = models.CharField(max_length=16)
    video = models.ForeignKey(AnexoEscola, on_delete=models.SET_NULL, null=True, blank=True, related_name='gestos')
    estado = models.CharField(max_length=10, default='proposto')
    proposto_por = models.ForeignKey(MembroInstituicao, on_delete=models.SET_NULL, null=True, related_name='+')
    proposto_por_nome = models.CharField(max_length=200)
    proposto_em = models.DateTimeField(auto_now_add=True)
    validacao_por = models.CharField(max_length=200, blank=True)
    validacao_em = models.DateTimeField(null=True, blank=True)
    validacao_nota = models.TextField(blank=True)

    class Meta:
        ordering = ['palavra', 'id']


class ProgressoPratica(models.Model):
    membro = models.ForeignKey(MembroInstituicao, on_delete=models.CASCADE, related_name='progresso')
    competencia = models.CharField(max_length=12)
    tentativas = models.PositiveIntegerField(default=0)
    acertos = models.PositiveIntegerField(default=0)
    recentes = models.JSONField(default=list, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['membro', 'competencia'], name='progresso_unico')]


class RegistoPratica(models.Model):
    membro = models.ForeignKey(MembroInstituicao, on_delete=models.CASCADE, related_name='registos_pratica')
    competencia = models.CharField(max_length=12)
    tema = models.CharField(max_length=12)
    certo = models.BooleanField()
    em = models.DateTimeField(auto_now_add=True)


class ConteudoEscola(models.Model):
    """Curso ou vídeo da escola: para toda a escola, ou só para uma turma (`turma`)."""
    instituicao = models.ForeignKey(Instituicao, on_delete=models.CASCADE, related_name='conteudos')
    tipo = models.CharField(max_length=6)
    titulo = models.CharField(max_length=200)
    descricao = models.TextField(blank=True)
    autor = models.ForeignKey(MembroInstituicao, on_delete=models.SET_NULL, null=True, related_name='+')
    autor_nome = models.CharField(max_length=200)
    turma = models.ForeignKey(GrupoInstituicao, on_delete=models.CASCADE, null=True, blank=True, related_name='conteudos')
    duracao_min = models.PositiveIntegerField(default=0)
    aulas = models.PositiveIntegerField(default=0)
    tem_legendas = models.BooleanField(default=False)
    em_lga = models.BooleanField(default=False)
    video = models.ForeignKey(AnexoEscola, on_delete=models.SET_NULL, null=True, blank=True, related_name='conteudos')
    publicado_em = models.DateTimeField(auto_now_add=True)
    vistas = models.PositiveIntegerField(default=0)
    proposta_publica = models.CharField(max_length=10, null=True, blank=True)

    class Meta:
        ordering = ['-publicado_em', '-id']


class PostTurma(models.Model):
    instituicao = models.ForeignKey(Instituicao, on_delete=models.CASCADE, related_name='posts_turma')
    turma = models.ForeignKey(GrupoInstituicao, on_delete=models.CASCADE, related_name='posts')
    autor = models.ForeignKey(MembroInstituicao, on_delete=models.CASCADE, related_name='posts_turma')
    autor_nome = models.CharField(max_length=200)
    papel = models.CharField(max_length=15)
    texto = models.CharField(max_length=500, blank=True)
    gesto_id = models.CharField(max_length=40, blank=True)
    foto = models.ForeignKey(AnexoEscola, on_delete=models.SET_NULL, null=True, blank=True, related_name='posts_turma')
    tem_criancas = models.BooleanField(default=False)
    criado_em = models.DateTimeField(auto_now_add=True)
    estado = models.CharField(max_length=10, default='visivel')

    class Meta:
        ordering = ['-criado_em', '-id']


class ComentarioTurma(models.Model):
    post = models.ForeignKey(PostTurma, on_delete=models.CASCADE, related_name='comentarios')
    autor = models.ForeignKey(MembroInstituicao, on_delete=models.CASCADE, related_name='comentarios_turma')
    autor_nome = models.CharField(max_length=200)
    papel = models.CharField(max_length=15)
    texto = models.CharField(max_length=300)
    criado_em = models.DateTimeField(auto_now_add=True)
    estado = models.CharField(max_length=10, default='visivel')

    class Meta:
        ordering = ['criado_em', 'id']


class GostoTurma(models.Model):
    post = models.ForeignKey(PostTurma, on_delete=models.CASCADE, related_name='gostos')
    membro = models.ForeignKey(MembroInstituicao, on_delete=models.CASCADE, related_name='+')

    class Meta:
        constraints = [models.UniqueConstraint(fields=['post', 'membro'], name='gosto_turma_unico')]


class Desafio(models.Model):
    instituicao = models.ForeignKey(Instituicao, on_delete=models.CASCADE, related_name='desafios')
    turma = models.ForeignKey(GrupoInstituicao, on_delete=models.CASCADE, null=True, blank=True, related_name='desafios')
    titulo = models.CharField(max_length=200)
    descricao = models.TextField(blank=True)
    competencia = models.CharField(max_length=12)
    tema = models.CharField(max_length=12, blank=True)
    meta = models.PositiveIntegerField()
    recompensa = models.PositiveIntegerField(default=0)
    criado_em = models.DateTimeField(auto_now_add=True)
    termina_em = models.DateTimeField()
    criado_por = models.CharField(max_length=200)
    concluido_por = models.ManyToManyField(MembroInstituicao, blank=True, related_name='desafios_concluidos')

    class Meta:
        ordering = ['termina_em', 'id']
