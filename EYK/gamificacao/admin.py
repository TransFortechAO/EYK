from django.contrib import admin
from .models import Carteira, TransacaoMoeda, Ofensiva


@admin.register(Carteira)
class CarteiraAdmin(admin.ModelAdmin):
    list_display = ('utilizador', 'saldo', 'atualizado_em')
    search_fields = ('utilizador__username',)


@admin.register(TransacaoMoeda)
class TransacaoMoedaAdmin(admin.ModelAdmin):
    list_display = ('utilizador', 'valor', 'motivo', 'criado_em')
    list_filter = ('motivo',)
    search_fields = ('utilizador__username',)


@admin.register(Ofensiva)
class OfensivaAdmin(admin.ModelAdmin):
    list_display = ('utilizador', 'dias_atual', 'maior_sequencia', 'ultima_atividade')
    search_fields = ('utilizador__username',)
