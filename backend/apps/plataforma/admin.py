from django.contrib import admin

from .models import AmostraLGA, Anuncio, ConfiguracaoPlataforma, FonteDatasetLGA

admin.site.register(ConfiguracaoPlataforma)
admin.site.register(Anuncio)
admin.site.register(AmostraLGA)
admin.site.register(FonteDatasetLGA)
