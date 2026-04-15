from django.urls import path
from .views import meus_cursos, perfil_professor, criar_curso

app_name = 'professores'

urlpatterns = [
    path('meus-cursos/', meus_cursos, name='meus-cursos'),
    path('perfil/', perfil_professor, name='perfil'),
    path('criar-curso/', criar_curso, name='criar-curso'),
]