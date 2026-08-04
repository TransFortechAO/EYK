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

    ativo = models.BooleanField(default=True)
    publicado_em = models.DateField(null=True, blank=True)

    criado_em = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.titulo

    def total_inscritos(self):
        return self.inscricoes.count()

    def total_visualizacoes(self):
        return sum(e.visualizacoes for e in self.engajamentos.all())


class Inscricao(models.Model):
    """Regista quando um aluno se inscreve num curso"""
    aluno = models.ForeignKey(Aluno, on_delete=models.CASCADE, related_name='inscricoes')
    curso = models.ForeignKey(Curso, on_delete=models.CASCADE, related_name='inscricoes')
    inscrito_em = models.DateTimeField(auto_now_add=True)
    concluido = models.BooleanField(default=False)

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
