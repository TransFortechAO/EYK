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


class CandidaturaProfessor(models.Model):
    """Pedido de quem quer ser professor, feito na página pública
    "Quero ser professor". Fica guardado (para consulta e para tratar abusos
    mais tarde); a conta só é criada quando a pessoa confirma o email e
    escolhe a sua palavra-passe."""

    nome = models.CharField(max_length=120)
    email = models.EmailField()
    telefone = models.CharField(max_length=30, blank=True)
    area = models.CharField(max_length=100, blank=True)
    apresentacao = models.TextField(blank=True)
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


class Video(models.Model):
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
