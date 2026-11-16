from django.db import models

from apps.accounts.models import User


class Professor(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    nome_publico = models.CharField(max_length=150)
    bio = models.TextField(blank=True)
    area = models.CharField(max_length=100, blank=True)
    foto = models.ImageField(upload_to='professores/', blank=True)
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    views_creditadas = models.PositiveIntegerField(
        default=0, help_text='Nº de blocos de 20 visualizações já pagos (evita pagar duas vezes o mesmo bloco).',
    )

    def __str__(self):
        return self.nome_publico


def _caminho_documento(instancia, nome: str) -> str:
    import os

    return f'candidaturas/{instancia.candidatura_id}/{os.path.basename(nome)}'


def _storage_privado():
    from apps.instituicoes.armazenamento import storage_privado

    return storage_privado()


class CandidaturaProfessor(models.Model):
    """Pedido de quem quer ser professor (separador "Professor" do registo).

    1. A pessoa deixa nome e email; recebe um link e escolhe a palavra-passe: a conta é
       criada como aluno e a candidatura fica `por_completar`.
    2. No primeiro login completa o formulário de competências e submete (`submetida`).
    3. A equipa EYK decide (Fase 2). Só `aprovada` dá as funções de professor.
    """
    POR_COMPLETAR, SUBMETIDA, EM_ANALISE = 'por_completar', 'submetida', 'em_analise'
    CORRECAO_PEDIDA, APROVADA, REJEITADA, SUSPENSA = 'correcao_pedida', 'aprovada', 'rejeitada', 'suspensa'
    ESTADOS = [
        (POR_COMPLETAR, 'Por completar'),
        (SUBMETIDA, 'Submetida'),
        (EM_ANALISE, 'Em análise'),
        (CORRECAO_PEDIDA, 'Correção pedida'),
        (APROVADA, 'Aprovada'),
        (REJEITADA, 'Rejeitada'),
        (SUSPENSA, 'Suspensa'),
    ]
    QUALIFICACOES = [('formal', 'Qualificação formal'), ('competencia', 'Competência demonstrada')]

    nome = models.CharField(max_length=120)
    email = models.EmailField()
    telefone = models.CharField(max_length=30, blank=True)
    area = models.CharField(max_length=100, blank=True)
    apresentacao = models.TextField(blank=True)
    estado = models.CharField(max_length=16, choices=ESTADOS, default=POR_COMPLETAR, db_index=True)
    tipo_qualificacao = models.CharField(max_length=12, choices=QUALIFICACOES, blank=True)
    experiencia = models.TextField(blank=True)
    portefolio_url = models.URLField(blank=True)
    submetida_em = models.DateTimeField(null=True, blank=True)
    decidida_em = models.DateTimeField(null=True, blank=True)
    decidida_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='candidaturas_decididas',
    )
    # Justificação da rejeição ou o que corrigir (mostrado ao candidato).
    mensagem_decisao = models.TextField(blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)
    concluida_em = models.DateTimeField(null=True, blank=True)
    user = models.OneToOneField(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='candidatura_professor',
    )

    class Meta:
        ordering = ['-criado_em']
        verbose_name = 'candidatura a professor'
        verbose_name_plural = 'candidaturas a professor'

    def __str__(self):
        return f'{self.nome} <{self.email}>'


class DocumentoCandidatura(models.Model):
    """Diploma, certificado, vídeo de demonstração ou outra evidência. Ficheiros privados
    (nunca em /media): só o candidato e a equipa EYK os abrem."""
    TIPOS = [
        ('diploma', 'Diploma'),
        ('certificado', 'Certificado'),
        ('video', 'Vídeo de demonstração'),
        ('portefolio', 'Portefólio'),
        ('outro', 'Outra evidência'),
    ]
    candidatura = models.ForeignKey(CandidaturaProfessor, on_delete=models.CASCADE, related_name='documentos')
    tipo = models.CharField(max_length=12, choices=TIPOS)
    titulo = models.CharField(max_length=150, blank=True)
    ficheiro = models.FileField(storage=_storage_privado, upload_to=_caminho_documento, max_length=300, blank=True)
    nome_ficheiro = models.CharField(max_length=255, blank=True)
    tamanho_bytes = models.BigIntegerField(default=0)
    link = models.URLField(blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['criado_em', 'id']


class NotaCandidatura(models.Model):
    """Nota interna da equipa EYK (ex: parecer de um especialista externo). O candidato não a vê."""
    candidatura = models.ForeignKey(CandidaturaProfessor, on_delete=models.CASCADE, related_name='notas')
    autor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='+')
    texto = models.TextField()
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['criado_em', 'id']


class HistoricoCandidatura(models.Model):
    """Cada mudança de estado: quem, quando, de → para e a mensagem. Nunca se edita."""
    candidatura = models.ForeignKey(CandidaturaProfessor, on_delete=models.CASCADE, related_name='historico')
    de = models.CharField(max_length=16, blank=True)
    para = models.CharField(max_length=16)
    por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    mensagem = models.TextField(blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['criado_em', 'id']


class Video(models.Model):
    categoria = models.ForeignKey(
        'cursos.Categoria', on_delete=models.SET_NULL, null=True, blank=True, related_name='videos',
    )
    professor = models.ForeignKey(Professor, on_delete=models.CASCADE, related_name='videos')
    curso = models.ForeignKey(
        'cursos.Curso', on_delete=models.CASCADE, related_name='videos', null=True, blank=True,
        help_text='Se preenchido, o vídeo pertence a este curso em vez de ser um vídeo avulso.',
    )
    titulo = models.CharField(max_length=255)
    descricao = models.TextField(blank=True)
    arquivo = models.FileField(upload_to='videos/', null=True, blank=True)
    url_externa = models.URLField(blank=True, help_text='Link do YouTube ou outro')
    thumbnail = models.ImageField(upload_to='videos/thumbs/', null=True, blank=True)
    duracao_segundos = models.PositiveIntegerField(
        default=0, help_text='Calculado automaticamente a partir do ficheiro enviado.',
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)
    # Preenchido quando o autor edita o conteúdo (mostra "editado" na plataforma).
    editado_em = models.DateTimeField(null=True, blank=True)
    # Consentimento opcional para eventual uso de vídeos públicos em investigação de IA LGA.
    uso_ia_lga = models.BooleanField(default=False)
    uso_ia_lga_em = models.DateTimeField(null=True, blank=True)
    uso_ia_lga_versao = models.CharField(max_length=30, blank=True)
    # Índice de propósito: `ativo=True` (combinado com `curso__isnull`) é o
    # filtro de TODAS as listagens públicas de vídeos — ver nota em Curso.ativo.
    ativo = models.BooleanField(default=True, db_index=True)
    ordem = models.PositiveIntegerField(default=0)
    # Ocultado pela moderação — distinto de `ativo`, que o professor controla
    # (o professor não consegue voltar a mostrar um vídeo oculto).
    oculto = models.BooleanField(default=False, db_index=True)
    # Legendas em WebVTT (os .srt são convertidos no upload).
    legenda = models.FileField(upload_to='videos/legendas/', null=True, blank=True)

    class Meta:
        ordering = ['ordem', '-criado_em']

    def __str__(self):
        return self.titulo

    def total_likes(self):
        # Usa `.all()` (em vez de `.filter().count()`) de propósito: quando o
        # vídeo vem de uma queryset com `prefetch_related('reacoes')` (ex: a
        # listagem de cursos/vídeos), isto reaproveita a cache do prefetch em
        # vez de disparar uma query SQL extra por vídeo (bug clássico de N+1).
        return sum(1 for r in self.reacoes.all() if r.tipo == 'like')

    def total_visualizacoes(self):
        return sum(v.count for v in self.visualizacoes.all())


class RecursoVideo(models.Model):
    """Recurso (PDF) anexado a um vídeo avulso — equivalente a RecursoCurso,
    mas para vídeos que não pertencem a nenhum curso. Qualquer utilizador
    autenticado pode ver/descarregar; só o professor dono pode gerir."""
    TIPO_PDF = 'pdf'
    TIPO_CHOICES = [
        (TIPO_PDF, 'PDF'),
    ]

    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='recursos')
    nome = models.CharField(max_length=200)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default=TIPO_PDF)
    arquivo = models.FileField(upload_to='videos/recursos/')
    tamanho_bytes = models.PositiveIntegerField(default=0)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-criado_em']

    def __str__(self):
        return f'{self.nome} ({self.get_tipo_display()}) · {self.video}'

    @property
    def tamanho_mb(self) -> float:
        return round(self.tamanho_bytes / (1024 * 1024), 2)


class ReacaoVideo(models.Model):
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='reacoes')
    utilizador = models.ForeignKey(User, on_delete=models.CASCADE)
    tipo = models.CharField(max_length=10, default='like')  # like / dislike

    class Meta:
        unique_together = ('video', 'utilizador')

    def __str__(self):
        return f'{self.utilizador} → {self.tipo} em {self.video}'


class VisualizacaoVideo(models.Model):
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='visualizacoes')
    utilizador = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    count = models.PositiveIntegerField(default=1)
    ultima_visualizacao = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('video', 'utilizador')


class PosicaoVisualizacao(models.Model):
    """Onde o utilizador parou num vídeo ("retomar onde ficaste"). Uma linha
    por utilizador+vídeo, atualizada pelo player a cada poucos segundos de
    reprodução — distinto de VisualizacaoVideo, que conta views (anti-fraude)."""
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='posicoes')
    utilizador = models.ForeignKey(User, on_delete=models.CASCADE, related_name='posicoes_video')
    segundos = models.PositiveIntegerField(default=0)
    atualizado_em = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        unique_together = ('video', 'utilizador')

    def __str__(self):
        return f'{self.utilizador} em {self.video} @ {self.segundos}s'


class ComentarioVideo(models.Model):
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='comentarios')
    autor = models.ForeignKey(User, on_delete=models.CASCADE)
    parent = models.ForeignKey(
        'self', on_delete=models.CASCADE, null=True, blank=True, related_name='respostas',
    )
    conteudo = models.TextField()
    criado_em = models.DateTimeField(auto_now_add=True)
    editado_em = models.DateTimeField(null=True, blank=True)
    oculto = models.BooleanField(default=False, db_index=True)  # ver feed.Post.oculto

    class Meta:
        ordering = ['criado_em']

    def __str__(self):
        return f'Comentário de {self.autor.username} em {self.video}'

    def total_likes(self):
        return self.reacoes.count()


class ReacaoComentarioVideo(models.Model):
    comentario = models.ForeignKey(ComentarioVideo, on_delete=models.CASCADE, related_name='reacoes')
    utilizador = models.ForeignKey(User, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('comentario', 'utilizador')

    def __str__(self):
        return f'{self.utilizador} gosta do comentário {self.comentario_id}'


class Seguidor(models.Model):
    """Regista quando um utilizador (aluno ou professor) segue um professor"""
    utilizador = models.ForeignKey(User, on_delete=models.CASCADE, related_name='professores_seguidos')
    professor = models.ForeignKey(Professor, on_delete=models.CASCADE, related_name='seguidores')
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('utilizador', 'professor')

    def __str__(self):
        return f'{self.utilizador} segue {self.professor}'
