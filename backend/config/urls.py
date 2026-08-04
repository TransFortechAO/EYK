from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from . import views
# Importa as views dos apps para criar rotas diretas
from apps.feed.views import comunidade, cursos_view, videos_view, notificacoes
from apps.gamificacao.views import leaderboard
from apps.alunos.views import configuracoes_aluno

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.index, name='index'),
    path('accounts/', include('apps.accounts.urls', namespace='accounts')),
    path('professor/', include('apps.professores.urls', namespace='professores')),
    path('api/', include('apps.cursos.urls')),
    path('feed/', include('apps.feed.urls', namespace='feed')),
    path('aluno/', include('apps.alunos.urls', namespace='aluno')),
    path('gamificacao/', include('apps.gamificacao.urls', namespace='gamificacao')),
    # Rotas diretas para as páginas que estão retornando 404
    path('comunidade/', comunidade, name='comunidade'),
    path('cursos/', cursos_view, name='cursos'),
    path('videos/', videos_view, name='videos'),
    path('notificacoes/', notificacoes, name='notificacoes'),
    path('leaderboard/', leaderboard, name='leaderboard'),
    path('configuracoes/', configuracoes_aluno, name='configuracoes'),
]

# Adiciona URLs do Django Debug Toolbar apenas em ambiente de desenvolvimento
if settings.DEBUG:
    import debug_toolbar
    urlpatterns += [
        path('__debug__/', include(debug_toolbar.urls)),
    ]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)