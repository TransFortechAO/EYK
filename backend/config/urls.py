import re

from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.shortcuts import redirect

from . import views

NEXT_URL = settings.NEXT_PUBLIC_URL if hasattr(settings, 'NEXT_PUBLIC_URL') else 'http://localhost:3000'

def redirect_to_next(request, path=''):
    """Redireciona rotas de UI para o frontend Next.js."""
    url = NEXT_URL.rstrip('/') + '/' + path.lstrip('/')
    qs = request.META.get('QUERY_STRING', '')
    if qs:
        url += '?' + qs
    return redirect(url, permanent=False)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('apps.accounts.urls', namespace='accounts')),
    path('api/', include('apps.cursos.urls')),
    path('aluno/', include('apps.alunos.urls', namespace='aluno')),
    path('health/', views.health_check, name='health_check'),
    path('', views.index, name='index'),
    re_path(r'^(?!admin|accounts|api|aluno|media|static|health).*$', lambda r: redirect_to_next(r, r.path.lstrip('/'))),
]

if settings.DEBUG or getattr(settings, 'SERVIR_MEDIA', False):
    # Igual a `static(MEDIA_URL, ...)`, mas com suporte a pedidos Range (vídeos).
    # Em produção só quando a media está num disco (no Render, sem bucket S3).
    urlpatterns += [
        re_path(
            r'^%s(?P<path>.*)$' % re.escape(settings.MEDIA_URL.lstrip('/')),
            views.media_com_range,
            {'document_root': settings.MEDIA_ROOT},
        ),
    ]