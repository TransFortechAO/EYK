from django.urls import path

from . import views

urlpatterns = [
    path('config/', views.config_publica, name='plataforma-config'),
    path('gestos/', views.gestos_publicos, name='plataforma-gestos'),
    path('admin/gestos/', views.admin_gestos, name='plataforma-admin-gestos'),
    path('admin/gestos/<int:pk>/', views.admin_gesto, name='plataforma-admin-gesto'),
    path('amostras-lga/', views.amostras_lga, name='plataforma-amostras-lga'),
    path('amostras-lga/<int:pk>/', views.amostra_lga_detail, name='plataforma-amostra-lga'),
    path('admin/amostras-lga/', views.admin_amostras_lga, name='plataforma-admin-amostras-lga'),
    path('admin/amostras-lga/<int:pk>/', views.admin_amostra_lga_detail, name='plataforma-admin-amostra-lga'),
    path('admin/fontes-dataset-lga/', views.admin_fontes_dataset_lga, name='plataforma-admin-fontes-dataset-lga'),
    path('admin/fontes-dataset-lga/<int:pk>/', views.admin_fonte_dataset_lga_detail, name='plataforma-admin-fonte-dataset-lga'),
    path('admin/config/', views.admin_config, name='plataforma-admin-config'),
    path('admin/anuncios/', views.admin_anuncios, name='plataforma-admin-anuncios'),
    path('admin/anuncios/<int:pk>/', views.admin_anuncio_cancelar, name='plataforma-admin-anuncio'),
    path('admin/lembrete-ofensiva/enviar/', views.admin_lembrete_ofensiva_enviar, name='plataforma-admin-lembrete'),
    path('admin/categorias/', views.admin_categorias, name='plataforma-admin-categorias'),
    path('admin/categorias/<int:pk>/', views.admin_categoria_detail, name='plataforma-admin-categoria'),
]
