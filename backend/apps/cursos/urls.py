from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import usuario_atual

from .views import CursoViewSet

router = DefaultRouter()
router.register(r'cursos', CursoViewSet, basename='cursos')

urlpatterns = [
    path('usuario/', usuario_atual, name='usuario-atual'),
    path('', include(router.urls)),
]