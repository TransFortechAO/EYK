from django.db import models

from apps.accounts.models import User


class Post(models.Model):
    autor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='posts')
    conteudo = models.TextField()
    imagem = models.ImageField(upload_to='posts/', null=True, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    # Preenchido quando o autor edita o conteúdo (mostra "editado" na plataforma).
    editado_em = models.DateTimeField(null=True, blank=True)
    # Ocultado pela moderação (denúncias): deixa de aparecer a terceiros, mas
    # não é apagado — fica como prova e pode ser reposto.
    oculto = models.BooleanField(default=False, db_index=True)

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
    parent = models.ForeignKey(
        'self', on_delete=models.CASCADE, null=True, blank=True, related_name='respostas',
    )
    conteudo = models.TextField()
    criado_em = models.DateTimeField(auto_now_add=True)
    editado_em = models.DateTimeField(null=True, blank=True)
    oculto = models.BooleanField(default=False, db_index=True)  # ver Post.oculto

    class Meta:
        ordering = ['criado_em']

    def __str__(self):
        return f'Comentário de {self.autor.username}'

    def total_likes(self):
        return self.reacoes.count()


class ReacaoComentario(models.Model):
    comentario = models.ForeignKey(Comentario, on_delete=models.CASCADE, related_name='reacoes')
    utilizador = models.ForeignKey(User, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('comentario', 'utilizador')

    def __str__(self):
        return f'{self.utilizador} gosta do comentário {self.comentario_id}'
