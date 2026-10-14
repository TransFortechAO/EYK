from django.urls import path

from . import api_views

urlpatterns = [
    path('perfil/', api_views.professor_perfil, name='api-professor-perfil'),
    path('apagar-conta/', api_views.professor_apagar_conta, name='api-professor-apagar-conta'),

    path('cursos/', api_views.professor_cursos, name='api-professor-cursos'),
    path('cursos/<int:curso_id>/', api_views.professor_curso_detail, name='api-professor-curso-detail'),
    path('cursos/<int:curso_id>/engajamento/', api_views.professor_curso_engajamento, name='api-professor-curso-engajamento'),
    path('cursos/<int:curso_id>/videos/<int:video_id>/', api_views.professor_curso_video_delete, name='api-professor-curso-video-delete'),

    path('videos/', api_views.professor_videos, name='api-professor-videos'),
    path('videos/reordenar/', api_views.professor_videos_reordenar, name='api-professor-videos-reordenar'),
    path('videos/<int:video_id>/', api_views.professor_video_detail, name='api-professor-video-detail'),
    path('videos/<int:video_id>/engajamento/', api_views.professor_video_engajamento, name='api-professor-video-engajamento'),
    path('videos/<int:video_id>/recursos/<int:recurso_id>/', api_views.professor_video_recurso_delete, name='api-professor-video-recurso-delete'),
]
