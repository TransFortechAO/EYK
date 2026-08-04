from django.urls import path

from . import views

app_name = 'gamificacao'

urlpatterns = [
    path('', views.painel, name='painel'),
    path('leaderboard/', views.leaderboard, name='leaderboard'),
]
