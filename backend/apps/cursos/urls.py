from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CursoViewSet,
    usuario_atual,
    categoria_list,
    video_list,
    video_detail,
)
from apps.feed.api_views import (
    comentario_create,
    comentario_list,
    post_create,
    post_list,
    post_react,
)
from apps.accounts.api_notificacoes import (
    notificacao_list,
    notificacao_marcar_lida,
)
from apps.gamificacao.api_views import (
    gamificacao_painel,
    leaderboard_list,
    badges_list,
    carteira_historico,
)

router = DefaultRouter()
router.register(r'cursos', CursoViewSet, basename='cursos')

urlpatterns = [
    path('usuario/', usuario_atual, name='usuario-atual'),
    path('categorias/', categoria_list, name='categoria-list'),
    path('videos/', video_list, name='video-list'),
    path('videos/<int:pk>/', video_detail, name='video-detail'),

    path('comunidade/posts/', post_list, name='api-post-list'),
    path('comunidade/posts/', post_create, name='api-post-create'),
    path('comunidade/posts/<int:post_id>/reagir/', post_react, name='api-post-react'),
    path('comunidade/posts/<int:post_id>/comentarios/', comentario_list, name='api-comentario-list'),
    path('comunidade/posts/<int:post_id>/comentarios/', comentario_create, name='api-comentario-create'),

    path('notificacoes/', notificacao_list, name='notificacao-list'),
    path('notificacoes/<int:pk>/marcar-lida/', notificacao_marcar_lida, name='notificacao-marcar-lida'),

    path('gamificacao/', gamificacao_painel, name='gamificacao-painel'),
    path('leaderboard/', leaderboard_list, name='leaderboard-list'),
    path('badges/', badges_list, name='badges-list'),
    path('carteira/', carteira_historico, name='carteira-historico'),

    path('', include(router.urls)),
]
