"""Listas de comentários (das publicações e dos vídeos) sem uma consulta por comentário:
gostos, "gostei", respostas e fotos dos autores vêm todos de uma vez."""
from django.db.models import Count, Exists, IntegerField, OuterRef, Prefetch, Q, Subquery, Value
from django.db.models.functions import Coalesce

from .serializers import fotos_de_autores


def anotar_comentarios(qs, modelo_reacao, user):
    gostos = (
        modelo_reacao.objects.filter(comentario=OuterRef('pk'))
        .order_by().values('comentario').annotate(c=Count('*')).values('c')
    )
    qs = qs.annotate(n_likes=Coalesce(Subquery(gostos, output_field=IntegerField()), Value(0)))
    if user.is_authenticated:
        qs = qs.annotate(eu_gostei=Exists(modelo_reacao.objects.filter(comentario=OuterRef('pk'), utilizador=user)))
    return qs


def preparar_comentarios(qs, modelo_reacao, user, ocultos):
    """Comentários de topo com as respostas visíveis já carregadas (`respostas_visiveis`),
    com as mesmas regras de get_respostas: ocultas só para o autor, sem bloqueados."""
    respostas = anotar_comentarios(qs.model.objects.select_related('autor').order_by('criado_em'), modelo_reacao, user)
    if user.is_authenticated:
        respostas = respostas.filter(Q(oculto=False) | Q(autor=user))
    if ocultos:
        respostas = respostas.exclude(autor_id__in=ocultos)
    qs = anotar_comentarios(qs, modelo_reacao, user)
    return qs.prefetch_related(Prefetch('respostas', queryset=respostas, to_attr='respostas_visiveis'))


def fotos_dos_comentarios(comentarios) -> dict:
    ids = set()
    for c in comentarios:
        ids.add(c.autor_id)
        ids.update(r.autor_id for r in getattr(c, 'respostas_visiveis', ()))
    return fotos_de_autores(ids)
