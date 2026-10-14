from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CursoViewSet,
    usuario_atual,
    categoria_list,
    video_list,
    video_detail,
    video_react,
    video_registar_view,
    video_posicao,
    video_comentarios,
    video_comentario_detail,
    video_comentario_reagir,
    curso_inscrever,
    curso_recursos,
    curso_recurso_delete,
    curso_certificado,
    certificado_verificar,
    curso_avaliacoes,
)
from apps.feed.api_views import (
    comentario_detail,
    comentario_list,
    comentario_reagir,
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
    leaderboard_professores_mensal,
    badges_list,
    carteira_historico,
)
from apps.professores.api_views import professor_toggle_seguir

router = DefaultRouter()
router.register(r'cursos', CursoViewSet, basename='cursos')

urlpatterns = [
    path('usuario/', usuario_atual, name='usuario-atual'),
    path('categorias/', categoria_list, name='categoria-list'),
    path('videos/', video_list, name='video-list'),
    path('videos/<int:pk>/', video_detail, name='video-detail'),
    path('videos/<int:pk>/reagir/', video_react, name='video-react'),
    path('videos/<int:pk>/registar-view/', video_registar_view, name='video-registar-view'),
    path('videos/<int:pk>/posicao/', video_posicao, name='video-posicao'),
    path('videos/<int:pk>/comentarios/', video_comentarios, name='video-comentario-list'),
    path('videos/<int:pk>/comentarios/<int:comentario_id>/', video_comentario_detail, name='video-comentario-detail'),
    path('videos/<int:pk>/comentarios/<int:comentario_id>/reagir/', video_comentario_reagir, name='video-comentario-reagir'),
    path('cursos/<int:pk>/inscrever/', curso_inscrever, name='curso-inscrever'),
    path('cursos/<int:pk>/recursos/', curso_recursos, name='curso-recursos'),
    path('cursos/<int:pk>/recursos/<int:recurso_id>/', curso_recurso_delete, name='curso-recurso-delete'),
    path('cursos/<int:pk>/certificado/', curso_certificado, name='curso-certificado'),
    path('cursos/<int:pk>/avaliacoes/', curso_avaliacoes, name='curso-avaliacoes'),
    path('certificados/<uuid:codigo>/', certificado_verificar, name='certificado-verificar'),

    path('professor/', include('apps.professores.urls_api')),
    path('professores/<int:professor_id>/seguir/', professor_toggle_seguir, name='api-professor-seguir'),

    path('comunidade/posts/', post_list, name='api-post-list'),
    path('comunidade/posts/<int:post_id>/reagir/', post_react, name='api-post-react'),
    path('comunidade/posts/<int:post_id>/comentarios/', comentario_list, name='api-comentario-list'),
    path('comunidade/posts/<int:post_id>/comentarios/<int:comentario_id>/', comentario_detail, name='api-comentario-detail'),
    path('comunidade/posts/<int:post_id>/comentarios/<int:comentario_id>/reagir/', comentario_reagir, name='api-comentario-reagir'),

    path('notificacoes/', notificacao_list, name='notificacao-list'),
    path('notificacoes/<int:pk>/marcar-lida/', notificacao_marcar_lida, name='notificacao-marcar-lida'),

    path('gamificacao/', gamificacao_painel, name='gamificacao-painel'),
    path('leaderboard/', leaderboard_list, name='leaderboard-list'),
    path('leaderboard/professores/', leaderboard_professores_mensal, name='leaderboard-professores-mensal'),
    path('badges/', badges_list, name='badges-list'),
    path('carteira/', carteira_historico, name='carteira-historico'),

    path('', include(router.urls)),
]
