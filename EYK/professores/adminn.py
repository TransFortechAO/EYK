from django.contrib import admin
from .models import Professor

@admin.register(Professor)
class ProfessorAdmin(admin.ModelAdmin):
    list_display = ('nome_piblico', 'area', 'ativo')
    search_fields = ('nome_publico', 'area')