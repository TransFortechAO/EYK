from django.urls import path
from . import views
from .admin_dashboard import (
    registar_professor, gerenciar_usuarios, toggle_ativo_usuario, apagar_usuario,
)

app_name = 'accounts'

urlpatterns = [
    path('register/', views.register_view, name='register'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('completar-perfil/', views.completar_perfil_aluno, name='completar-perfil-aluno'),
    path('completar-perfil-professor/', views.completar_perfil_professor, name='completar-perfil-professor'),
    path('verificar-2fa/', views.verificar_2fa, name='verificar-2fa'),
    path('preferencias/tema/', views.atualizar_tema, name='atualizar-tema'),
    path('preferencias/notificacoes/', views.atualizar_preferencias_notificacao, name='atualizar-preferencias-notificacao'),
    path('seguranca/2fa/', views.configurar_2fa, name='configurar-2fa'),
    path('seguranca/2fa/desativar/', views.desativar_2fa, name='desativar-2fa'),
    path('dashboard/professores/', registar_professor, name='dashboard-professores'),
    path('dashboard/usuarios/', gerenciar_usuarios, name='dashboard-usuarios'),
    path('dashboard/usuarios/<int:user_id>/toggle-ativo/', toggle_ativo_usuario, name='toggle-ativo-usuario'),
    path('dashboard/usuarios/<int:user_id>/apagar/', apagar_usuario, name='apagar-usuario'),
]
