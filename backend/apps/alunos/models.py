from django.db import models

from apps.accounts.models import User


class Aluno(models.Model):
    profile = models.OneToOneField(User, on_delete=models.CASCADE)
    bio = models.TextField(blank=True)
    foto = models.ImageField(upload_to='alunos/', blank=True, null=True)

    def __str__(self):
        return self.profile.username  # Corrigido: removido .user


class Salvo(models.Model):
    """Guardado para ver depois: um curso, um vídeo ou uma publicação."""
    utilizador = models.ForeignKey(User, on_delete=models.CASCADE, related_name='salvos')
    curso = models.ForeignKey('cursos.Curso', on_delete=models.CASCADE, null=True, blank=True, related_name='+')
    video = models.ForeignKey('professores.Video', on_delete=models.CASCADE, null=True, blank=True, related_name='+')
    post = models.ForeignKey('feed.Post', on_delete=models.CASCADE, null=True, blank=True, related_name='+')
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-criado_em', '-id']
        constraints = [
            models.UniqueConstraint(fields=['utilizador', 'curso'], condition=models.Q(curso__isnull=False), name='salvo_curso_unico'),
            models.UniqueConstraint(fields=['utilizador', 'video'], condition=models.Q(video__isnull=False), name='salvo_video_unico'),
            models.UniqueConstraint(fields=['utilizador', 'post'], condition=models.Q(post__isnull=False), name='salvo_post_unico'),
        ]
