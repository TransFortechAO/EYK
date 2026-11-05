from django.urls import path, register_converter

from . import views, views_escola
from .acesso import IdEscola

register_converter(IdEscola, 'sid')

urlpatterns = [
    path('minhas/', views.minhas_pertencas, name='instituicoes-minhas'),
    path('convites/<str:codigo>/', views.consultar_convite, name='instituicoes-convite'),
    path('convites/<str:codigo>/aceitar/', views.aceitar_convite, name='instituicoes-convite-aceitar'),
    path('admin/', views.admin_instituicoes, name='instituicoes-admin'),
    path('admin/<sid:pk>/', views.admin_instituicao, name='instituicoes-admin-detalhe'),
    path('admin/<sid:pk>/reenviar-convite/', views.admin_reenviar_convite, name='instituicoes-admin-reenviar'),
    # Vida interna de uma instituição
    path('<sid:instituicao_id>/definicoes/', views_escola.definicoes, name='escola-definicoes'),
    path('<sid:instituicao_id>/membros/', views_escola.membros, name='escola-membros'),
    path('<sid:instituicao_id>/membros/<sid:membro_id>/', views_escola.membro_detalhe, name='escola-membro'),
    path('<sid:instituicao_id>/convites/', views_escola.convites, name='escola-convites'),
    path('<sid:instituicao_id>/convites/<sid:convite_id>/', views_escola.convite_detalhe, name='escola-convite'),
    path('<sid:instituicao_id>/pedidos/', views_escola.pedidos_adesao, name='escola-pedidos'),
    path('<sid:instituicao_id>/pedidos/<sid:pedido_id>/decidir/', views_escola.pedido_decidir, name='escola-pedido-decidir'),
    path('<sid:instituicao_id>/grupos/', views_escola.grupos, name='escola-grupos'),
    path('<sid:instituicao_id>/grupos/<sid:grupo_id>/', views_escola.grupo_detalhe, name='escola-grupo'),
    path('<sid:instituicao_id>/grupos/<sid:grupo_id>/membros/', views_escola.grupo_membro, name='escola-grupo-membro'),
    path('<sid:instituicao_id>/alunos/', views_escola.alunos, name='escola-alunos'),
    path(
        '<sid:instituicao_id>/alunos/<sid:aluno_id>/tutores/<sid:tutor_id>/', views_escola.aluno_tutor,
        name='escola-aluno-tutor',
    ),
    path('<sid:instituicao_id>/consentimentos/', views_escola.consentimentos, name='escola-consentimentos'),
]
