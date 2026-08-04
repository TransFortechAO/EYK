from django.db import models

from apps.accounts.models import User


class Post(models.Model):
    autor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='posts')
    conteudo = models.TextField()
    imagem = models.ImageField(upload_to='posts/', null=True, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-criado_em']

    def __str__(self):
        return f'Post de {self.autor.username}'

    def total_likes(self):
        return self.reacoes.filter(tipo='like').count()

    def total_comentarios(self):
        return self.comentarios.count()


class ReacaoPost(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='reacoes')
    utilizador = models.ForeignKey(User, on_delete=models.CASCADE)
    tipo = models.CharField(max_length=10, default='like')

    class Meta:
        unique_together = ('post', 'utilizador')

    def __str__(self):
        return f'{self.utilizador} → {self.tipo}'


class Comentario(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comentarios')
    autor = models.ForeignKey(User, on_delete=models.CASCADE)
    conteudo = models.TextField()
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['criado_em']

    def __str__(self):
        return f'Comentário de {self.autor.username}'
