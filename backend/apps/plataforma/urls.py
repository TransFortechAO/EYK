from django.urls import path

from . import views

urlpatterns = [
    path('config/', views.config_publica, name='plataforma-config'),
    path('admin/config/', views.admin_config, name='plataforma-admin-config'),
    path('admin/anuncios/', views.admin_anuncios, name='plataforma-admin-anuncios'),
    path('admin/anuncios/<int:pk>/', views.admin_anuncio_cancelar, name='plataforma-admin-anuncio'),
    path('admin/lembrete-ofensiva/enviar/', views.admin_lembrete_ofensiva_enviar, name='plataforma-admin-lembrete'),
    path('admin/categorias/', views.admin_categorias, name='plataforma-admin-categorias'),
    path('admin/categorias/<int:pk>/', views.admin_categoria_detail, name='plataforma-admin-categoria'),
]
