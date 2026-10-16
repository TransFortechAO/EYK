import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.alunos.models import Aluno
from apps.professores.models import Professor


class Categoria(models.Model):
    nome = models.CharField(max_length=100)

    def __str__(self):
        return self.nome


class Curso(models.Model):
    professor = models.ForeignKey(Professor, on_delete=models.CASCADE)
    titulo = models.CharField(max_length=255)
    descricao = models.TextField()

    categoria = models.ForeignKey(Categoria, on_delete=models.SET_NULL, null=True, blank=True)

    preco = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    duracao = models.CharField(max_length=50, null=True, blank=True)

    thumbnail = models.ImageField(upload_to='cursos/', null=True, blank=True)

    # Índice de propósito: todas as listagens públicas filtram por `ativo=True`
    # (CursoViewSet, inscrição, recursos…) — sem índice isso é um varrimento
    # completo da tabela em cada pedido, cada vez mais lento com o crescimento.
    ativo = models.BooleanField(default=True, db_index=True)
    oculto = models.BooleanField(default=False, db_index=True)  # ver Video.oculto
    publicado_em = models.DateField(null=True, blank=True)

    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.titulo

    def total_inscritos(self):
        # `len(self.inscricoes.all())` em vez de `.count()` de propósito: numa
        # queryset de cursos com `prefetch_related('inscricoes')` (listagens),
        # isto reaproveita a cache do prefetch em vez de uma query SQL extra
        # por curso (N+1). Para um curso isolado o custo é o mesmo (1 query).
        return len(self.inscricoes.all())

    def total_visualizacoes(self):
        return sum(e.visualizacoes for e in self.engajamentos.all())

    def conclusao_media(self):
        """Percentagem de inscritos que já concluíram o curso (0-100)."""
        inscricoes = self.inscricoes.all()
        total = len(inscricoes)
        if total == 0:
            return 0
        concluidos = sum(1 for i in inscricoes if i.concluido)
        return round((concluidos / total) * 100)


class Inscricao(models.Model):
    """Regista quando um aluno se inscreve num curso"""
    aluno = models.ForeignKey(Aluno, on_delete=models.CASCADE, related_name='inscricoes')
    curso = models.ForeignKey(Curso, on_delete=models.CASCADE, related_name='inscricoes')
    inscrito_em = models.DateTimeField(auto_now_add=True)
    concluido = models.BooleanField(default=False)
    concluido_em = models.DateTimeField(null=True, blank=True)
    # Código público do certificado de conclusão (impresso no PDF/QR) — permite
    # a terceiros confirmarem a autenticidade em /certificados/<codigo>.
    codigo_certificado = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    class Meta:
        unique_together = ('aluno', 'curso')

    def __str__(self):
        return f'{self.aluno} inscrito em {self.curso}'


class EngajamentoCurso(models.Model):
    """Regista visualizacoes por aluno num curso"""
    curso = models.ForeignKey(Curso, on_delete=models.CASCADE, related_name='engajamentos')
    aluno = models.ForeignKey(Aluno, on_delete=models.CASCADE, related_name='engajamentos_cursos', null=True, blank=True)
    visualizacoes = models.PositiveIntegerField(default=0)
    ultima_visualizacao = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('curso', 'aluno')

    def __str__(self):
        return f'Engajamento: {self.curso} - {self.aluno}'


class RecursoCurso(models.Model):
    """Recurso (ex: PDF) anexado a um curso, visível para alunos inscritos
    e para o próprio professor."""
    TIPO_PDF = 'pdf'
    TIPO_CHOICES = [
        (TIPO_PDF, 'PDF'),
    ]

    curso = models.ForeignKey(Curso, on_delete=models.CASCADE, related_name='recursos')
    nome = models.CharField(max_length=200)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default=TIPO_PDF)
    arquivo = models.FileField(upload_to='cursos/recursos/')
    tamanho_bytes = models.PositiveIntegerField(default=0)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-criado_em']

    def __str__(self):
        return f'{self.nome} ({self.get_tipo_display()}) · {self.curso}'

    @property
    def tamanho_mb(self) -> float:
        return round(self.tamanho_bytes / (1024 * 1024), 2)


class AvaliacaoCurso(models.Model):
    """Avaliação (1-5 estrelas + comentário opcional) de um aluno inscrito
    num curso. Uma por aluno+curso — avaliar de novo atualiza a existente."""
    curso = models.ForeignKey(Curso, on_delete=models.CASCADE, related_name='avaliacoes')
    aluno = models.ForeignKey(Aluno, on_delete=models.CASCADE, related_name='avaliacoes_cursos')
    estrelas = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comentario = models.TextField(blank=True)
    oculto = models.BooleanField(default=False, db_index=True)  # ver feed.Post.oculto
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('curso', 'aluno')
        ordering = ['-atualizado_em']

    def __str__(self):
        return f'{self.aluno} → {self.curso}: {self.estrelas}★'
