from django.urls import path

from . import admin_api, api_perfil, perfis, views

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
    path('api/perfil/<int:user_id>/', perfis.perfil_publico, name='perfil-publico'),
    path('api/meu-perfil/', perfis.meu_perfil, name='meu-perfil'),
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
    path('api/seguranca/2fa/novos-codigos/', api_perfil.api_2fa_novos_codigos, name='api-2fa-novos-codigos'),
    path('api/seguranca/sessoes/', api_perfil.api_sessoes, name='api-sessoes'),
    path('api/seguranca/sessoes/terminar-outras/', api_perfil.api_sessoes_terminar_outras, name='api-sessoes-terminar-outras'),
    path('api/seguranca/sessoes/<int:sessao_id>/terminar/', api_perfil.api_sessao_terminar, name='api-sessao-terminar'),
    path('api/exportar-dados/', api_perfil.api_exportar_dados, name='api-exportar-dados'),

    # ══════════════ JSON Admin API (usado pelo frontend Next.js) ══════════════
    path('api/admin/metricas/', admin_api.api_metricas, name='api-admin-metricas'),
    path('api/admin/professores/', admin_api.api_listar_professores, name='api-admin-listar-professores'),
    path('api/admin/professores/criar/', admin_api.api_registar_professor, name='api-admin-registar-professor'),
    path('api/admin/administradores/criar/', admin_api.api_registar_administrador, name='api-admin-registar-administrador'),
    path('api/admin/utilizadores/', admin_api.api_listar_utilizadores, name='api-admin-listar-utilizadores'),
    path('api/admin/utilizadores/<int:user_id>/toggle/', admin_api.api_toggle_ativo_usuario, name='api-admin-toggle-ativo-usuario'),
    path('api/admin/utilizadores/<int:user_id>/apagar/', admin_api.api_apagar_usuario, name='api-admin-apagar-usuario'),
]
