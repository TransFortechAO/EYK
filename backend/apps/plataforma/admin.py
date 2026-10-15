from django.contrib import admin

from .models import Anuncio, ConfiguracaoPlataforma

admin.site.register(ConfiguracaoPlataforma)
admin.site.register(Anuncio)
