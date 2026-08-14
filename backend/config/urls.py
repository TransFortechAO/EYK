from django.conf import settings
from django.conf.urls.static import static
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
    path('professor/', include('apps.professores.urls', namespace='professores')),
    path('api/', include('apps.cursos.urls')),
    path('feed/', include('apps.feed.urls', namespace='feed')),
    path('aluno/', include('apps.alunos.urls', namespace='aluno')),
    # Templates HTML legados da app gamificacao (usados só por outras páginas SSR legadas,
    # como /feed/ e /professor/, através dos partials _topbar/_sidebar). O caminho "/gamificacao/"
    # em si pertence ao frontend Next.js (que consome /api/gamificacao/ e /api/leaderboard/),
    # por isso a app fica montada num prefixo que não colide com as rotas do Next.
    path('legado/gamificacao/', include('apps.gamificacao.urls', namespace='gamificacao')),
    path('health/', views.health_check, name='health_check'),
    path('', views.index, name='index'),
    re_path(r'^(?P<path>comunidade|cursos|videos|notificacoes|leaderboard|gamificacao|biblioteca|configuracoes)(?P<rest>.*)$', lambda r, path, rest: redirect_to_next(r, path + rest)),
    re_path(r'^(?!admin|accounts|professor|api|feed|aluno|legado|media|static|health|__debug__).*$', lambda r: redirect_to_next(r, r.path.lstrip('/'))),
]

# Adiciona URLs do Django Debug Toolbar apenas em ambiente de desenvolvimento
if settings.DEBUG:
    import debug_toolbar
    urlpatterns += [
        path('__debug__/', include(debug_toolbar.urls)),
    ]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)