from django.contrib import admin

from .models import AcaoModeracao, Bloqueio, Contestacao, Denuncia, PalavraProibida


@admin.register(Denuncia)
class DenunciaAdmin(admin.ModelAdmin):
    list_display = ('tipo', 'objeto_id', 'motivo', 'estado', 'denunciante', 'alvo', 'criada_em')
    list_filter = ('estado', 'tipo', 'motivo')


@admin.register(AcaoModeracao)
class AcaoModeracaoAdmin(admin.ModelAdmin):
    list_display = ('tipo', 'alvo', 'moderador', 'automatica', 'revertida', 'criada_em')
    list_filter = ('tipo', 'automatica', 'revertida')


@admin.register(Contestacao)
class ContestacaoAdmin(admin.ModelAdmin):
    list_display = ('utilizador', 'estado', 'criada_em', 'respondida_em')
    list_filter = ('estado',)


admin.site.register(Bloqueio)
admin.site.register(PalavraProibida)
