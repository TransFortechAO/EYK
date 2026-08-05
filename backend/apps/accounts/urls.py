from django.urls import path

from . import admin_api, views
from .admin_dashboard import (
    apagar_usuario,
    gerenciar_usuarios,
    registar_professor,
    toggle_ativo_usuario,
)

app_name = 'accounts'

urlpatterns = [
    path('register/', views.register_view, name='register'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('completar-perfil/', views.completar_perfil_aluno, name='completar-perfil-aluno'),
    path('completar-perfil/saltar/', views.saltar_perfil_aluno, name='saltar-perfil-aluno'),
    path('completar-perfil-professor/', views.completar_perfil_professor, name='completar-perfil-professor'),
    path('completar-perfil-professor/saltar/', views.saltar_perfil_professor, name='saltar-perfil-professor'),
    path('verificar-2fa/', views.verificar_2fa, name='verificar-2fa'),
    path('preferencias/tema/', views.atualizar_tema, name='atualizar-tema'),
    path('preferencias/notificacoes/', views.atualizar_preferencias_notificacao, name='atualizar-preferencias-notificacao'),
    path('seguranca/2fa/', views.configurar_2fa, name='configurar-2fa'),
    path('seguranca/2fa/desativar/', views.desativar_2fa, name='desativar-2fa'),
    path('dashboard/professores/', registar_professor, name='dashboard-professores'),
    path('dashboard/usuarios/', gerenciar_usuarios, name='dashboard-usuarios'),
    path('dashboard/usuarios/<int:user_id>/toggle-ativo/', toggle_ativo_usuario, name='toggle-ativo-usuario'),
    path('dashboard/usuarios/<int:user_id>/apagar/', apagar_usuario, name='apagar-usuario'),
    path('auth/csrf/', views.auth_csrf, name='auth-csrf'),
    path('auth/login/', views.auth_login_json, name='auth-login-json'),
    path('auth/logout/', views.auth_logout_json, name='auth-logout-json'),
    path('auth/me/', views.auth_me, name='auth-me'),

    # ══════════════ JSON Admin API (usado pelo frontend Next.js) ══════════════
    path('api/admin/professores/', admin_api.api_listar_professores, name='api-admin-listar-professores'),
    path('api/admin/professores/criar/', admin_api.api_registar_professor, name='api-admin-registar-professor'),
    path('api/admin/utilizadores/', admin_api.api_listar_utilizadores, name='api-admin-listar-utilizadores'),
    path('api/admin/utilizadores/<int:user_id>/toggle/', admin_api.api_toggle_ativo_usuario, name='api-admin-toggle-ativo-usuario'),
    path('api/admin/utilizadores/<int:user_id>/apagar/', admin_api.api_apagar_usuario, name='api-admin-apagar-usuario'),
]
