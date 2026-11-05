from django.urls import path

from . import views

urlpatterns = [
    path('minhas/', views.minhas_pertencas, name='instituicoes-minhas'),
    path('convites/<str:codigo>/', views.consultar_convite, name='instituicoes-convite'),
    path('convites/<str:codigo>/aceitar/', views.aceitar_convite, name='instituicoes-convite-aceitar'),
    path('admin/', views.admin_instituicoes, name='instituicoes-admin'),
    path('admin/<int:pk>/', views.admin_instituicao, name='instituicoes-admin-detalhe'),
    path('admin/<int:pk>/reenviar-convite/', views.admin_reenviar_convite, name='instituicoes-admin-reenviar'),
]
