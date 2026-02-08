# Create your models here.

from django.db import models

class Curso(models.Model):
    professor = models.ForeignKey(
        'professores.Professor',
        on_delete=models.CASCADE,
        related_name='cursos'
    )

    titulo = models.CharField(max_length=255)
    descricao = models.TextField()

    imagem = models.ImageField(
        upload_to='cursos/',
        blank=True,
        null=True
    )


    categoria = models.ForeignKey(
        'Categoria',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cursos'
    )

    publicdo = models.BooleanField(default=False)
    destaque = models.BooleanField(default=False)

    criado_em=models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.titulo
    

class Categoria(models.Model):
    nome = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
