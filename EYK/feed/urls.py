from django.urls import path
from feed import views

app_name = 'feed'

urlpatterns = [
    path('', views.feed_home, name='home'),
    path('cursos/', views.cursos_view, name='cursos'),
    path('videos/', views.videos_view, name='videos'),
    path('comunidade/', views.comunidade, name='comunidade'),
    path('comunidade/post/', views.criar_post, name='criar-post'),
    path('comunidade/reagir/<int:post_id>/', views.reagir_post, name='reagir-post'),
    path('comunidade/comentar/<int:post_id>/', views.comentar_post, name='comentar-post'),
    path('notificacoes/', views.notificacoes, name='notificacoes'),
    path('cursos/<int:curso_id>/', views.assistir_curso, name='assistir-curso'),
    path('cursos/<int:curso_id>/avaliar/', views.avaliar_curso, name='avaliar-curso'),
]
