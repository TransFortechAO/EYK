from django.db import models

from apps.accounts.models import User


class Professor(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    nome_publico = models.CharField(max_length=150)
    bio = models.TextField(blank=True)
    area = models.CharField(max_length=100)
    foto = models.ImageField(upload_to='professores/', blank=True)
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nome_publico


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
    criado_em = models.DateTimeField(auto_now_add=True)
    ativo = models.BooleanField(default=True)
    ordem = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['ordem', '-criado_em']

    def __str__(self):
        return self.titulo

    def total_likes(self):
        return self.reacoes.filter(tipo='like').count()

    def total_visualizacoes(self):
        from django.db.models import Sum
        return self.visualizacoes.aggregate(total=Sum('count'))['total'] or 0


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


class ComentarioVideo(models.Model):
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='comentarios')
    autor = models.ForeignKey(User, on_delete=models.CASCADE)
    parent = models.ForeignKey(
        'self', on_delete=models.CASCADE, null=True, blank=True, related_name='respostas',
    )
    conteudo = models.TextField()
    criado_em = models.DateTimeField(auto_now_add=True)
    editado_em = models.DateTimeField(null=True, blank=True)

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
