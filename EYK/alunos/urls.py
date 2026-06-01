from django.urls import path
from . import views

app_name = 'alunos'

urlpatterns = [
    path('configuracoes/', views.configuracoes_aluno, name='configuracoes'),
    path('apagar-conta/', views.apagar_conta_aluno, name='apagar-conta'),
]
