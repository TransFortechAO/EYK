from django.urls import path

from . import views

urlpatterns = [
    path('denuncias/', views.denuncias, name='moderacao-denuncias'),
    path('bloqueados/', views.bloqueados, name='moderacao-bloqueados'),
    path('bloquear/<int:user_id>/', views.alternar_bloqueio, name='moderacao-bloquear'),
    path('contestar/', views.contestar, name='moderacao-contestar'),

    path('admin/fila/', views.admin_fila, name='moderacao-admin-fila'),
    path('admin/resolver/', views.admin_resolver, name='moderacao-admin-resolver'),
    path('admin/registo/', views.admin_registo, name='moderacao-admin-registo'),
    path('admin/utilizadores/<int:user_id>/sancao/', views.admin_sancionar, name='moderacao-admin-sancionar'),
    path('admin/contestacoes/', views.admin_contestacoes, name='moderacao-admin-contestacoes'),
    path('admin/contestacoes/<int:pk>/responder/', views.admin_responder_contestacao, name='moderacao-admin-responder'),
    path('admin/palavras/', views.admin_palavras, name='moderacao-admin-palavras'),
    path('admin/palavras/<int:pk>/', views.admin_palavra_apagar, name='moderacao-admin-palavra-apagar'),
]
