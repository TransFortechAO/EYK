from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.alunos.models import Aluno

from .models import User


@receiver(post_save, sender=User)
def create_aluno_profile(sender, instance, created, **kwargs):
    """Cria o perfil do aluno automaticamente quando um usuário student é criado"""
    if created and instance.is_student:
        Aluno.objects.create(profile=instance)
        print(f"Perfil de aluno criado para {instance.username}")

@receiver(post_save, sender=User)
def save_aluno_profile(sender, instance, **kwargs):
    """Salva o perfil do aluno quando o usuário é salvo"""
    if instance.is_student:
        Aluno.objects.get_or_create(profile=instance)