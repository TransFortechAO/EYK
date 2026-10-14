from django.urls import path

from . import admin_api, api_perfil, views

app_name = 'accounts'

urlpatterns = [
    path('auth/csrf/', views.auth_csrf, name='auth-csrf'),
    path('auth/register/', views.auth_register_json, name='auth-register-json'),
    path('auth/login/', views.auth_login_json, name='auth-login-json'),
    path('auth/logout/', views.auth_logout_json, name='auth-logout-json'),
    path('auth/me/', views.auth_me, name='auth-me'),
    path('auth/password-reset/', views.auth_password_reset, name='auth-password-reset'),
    path('auth/password-reset/validar/', views.auth_password_reset_validar, name='auth-password-reset-validar'),
    path('auth/password-reset/confirmar/', views.auth_password_reset_confirmar, name='auth-password-reset-confirmar'),
    path('auth/verificar-email/', views.auth_verificar_email, name='auth-verificar-email'),
    path('auth/reenviar-verificacao/', views.auth_reenviar_verificacao, name='auth-reenviar-verificacao'),
    path('api/pesquisar-utilizadores/', views.pesquisar_utilizadores, name='pesquisar-utilizadores'),
    path('api/perfil/<int:user_id>/', views.perfil_publico, name='perfil-publico'),
    path('auth/verificar-2fa/', api_perfil.auth_verificar_2fa_json, name='auth-verificar-2fa-json'),

    # ══════════════ JSON: onboarding, preferências, segurança (usado pelo Next.js) ═════
    path('api/perfil/completar/', api_perfil.perfil_completar, name='api-perfil-completar'),
    path('api/preferencias/', api_perfil.preferencias_atualizar, name='api-preferencias-atualizar'),
    path('api/seguranca/alterar-senha/', api_perfil.alterar_senha, name='api-alterar-senha'),
    path('api/seguranca/alterar-email/', api_perfil.alterar_email, name='api-alterar-email'),
    path('api/seguranca/2fa/status/', api_perfil.api_2fa_status, name='api-2fa-status'),
    path('api/seguranca/2fa/iniciar/', api_perfil.api_2fa_iniciar, name='api-2fa-iniciar'),
    path('api/seguranca/2fa/confirmar/', api_perfil.api_2fa_confirmar, name='api-2fa-confirmar'),
    path('api/seguranca/2fa/desativar/', api_perfil.api_2fa_desativar, name='api-2fa-desativar-json'),

    # ══════════════ JSON Admin API (usado pelo frontend Next.js) ══════════════
    path('api/admin/metricas/', admin_api.api_metricas, name='api-admin-metricas'),
    path('api/admin/professores/', admin_api.api_listar_professores, name='api-admin-listar-professores'),
    path('api/admin/professores/criar/', admin_api.api_registar_professor, name='api-admin-registar-professor'),
    path('api/admin/utilizadores/', admin_api.api_listar_utilizadores, name='api-admin-listar-utilizadores'),
    path('api/admin/utilizadores/<int:user_id>/toggle/', admin_api.api_toggle_ativo_usuario, name='api-admin-toggle-ativo-usuario'),
    path('api/admin/utilizadores/<int:user_id>/apagar/', admin_api.api_apagar_usuario, name='api-admin-apagar-usuario'),
]
