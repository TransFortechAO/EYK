from django.contrib import admin
from .models import Seguidor


@admin.register(Seguidor)
class SeguidorAdmin(admin.ModelAdmin):
    list_display = ('utilizador', 'professor', 'criado_em')
    search_fields = ('utilizador__username', 'professor__nome_publico')
