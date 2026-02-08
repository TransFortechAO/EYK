# Create your models here.

from django.db import models


class conteudos(models.Model):
    curso = models.ForeignKey(
        'cursos.Curso',
        on_delete=models.CASCADE,
        related_name='aulas'
    )

    titulo = models.CharField(max_length=255)
    descricao= models.TextField(blank=True)

    video_url = models.URLField()
    ordem = models.PositiveIntegerField()

    publicado = models.BooleanField(default=True)
    criada_em = models.DateTimeField(auto_now_add=True)


    class Meta:
        ordering = ['ordem']

    def __str__(self):
        return f'{self.ordem} - {self.titulo}'
    
    
    