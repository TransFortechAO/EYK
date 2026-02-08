from django.urls import path
from .views import (
    cursos_do_professor,
     curso_detalhado_professor,
      feed_aluno,
     )


app_name = 'cursos'

urlpatterns = [
    path('professor/cursos/', cursos_do_professor, name='cursos_do_professor'),
    path('professor/cursos/<int:curso_id>/', curso_detalhado_professor, name='curso_detalhado_professor'),
    path('aluno/feed/', feed_aluno),
]