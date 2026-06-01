from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from . import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.index, name='index'),
    path('accounts/', include('accounts.urls', namespace='accounts')),
    path('professor/', include('professores.urls', namespace='professores')),
    path('api/', include('cursos.urls')),
    path('feed/', include('feed.urls', namespace='feed')),
    path('aluno/', include('alunos.urls', namespace='alunos')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
