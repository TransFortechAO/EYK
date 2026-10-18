from django.contrib import admin

from .models import CandidaturaProfessor, Seguidor


@admin.register(Seguidor)
class SeguidorAdmin(admin.ModelAdmin):
    list_display = ('utilizador', 'professor', 'criado_em')
    search_fields = ('utilizador__username', 'professor__nome_publico')


@admin.register(CandidaturaProfessor)
class CandidaturaProfessorAdmin(admin.ModelAdmin):
    list_display = ('nome', 'email', 'area', 'criado_em', 'concluida_em', 'user')
    list_filter = ('concluida_em',)
    search_fields = ('nome', 'email', 'telefone')
    readonly_fields = ('criado_em', 'atualizado_em')
