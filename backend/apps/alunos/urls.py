from django.urls import path

from . import api_views

app_name = 'alunos'

urlpatterns = [
    path('api/perfil/', api_views.aluno_perfil_get, name='api-perfil-get'),
    path('api/perfil/atualizar/', api_views.aluno_perfil_atualizar, name='api-perfil-atualizar'),
    path('api/apagar-conta/', api_views.aluno_apagar_conta, name='api-apagar-conta'),
]
