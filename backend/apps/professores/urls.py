from django.urls import path

from .views import (
    apagar_conta_professor,
    configuracoes_professor,
    criar_curso,
    deletar_curso,
    deletar_video,
    editar_curso,
    editar_video,
    engajamento_curso,
    engajamento_video,
    meus_cursos,
    meus_videos,
    perfil_professor,
    reagir_video,
    reordenar_videos,
    toggle_seguir,
    upload_video,
)

app_name = 'professores'

urlpatterns = [
    # Perfil e configurações
    path('perfil/', perfil_professor, name='perfil'),
    path('configuracoes/', configuracoes_professor, name='configuracoes'),
    path('apagar-conta/', apagar_conta_professor, name='apagar-conta'),

    # Cursos
    path('meus-cursos/', meus_cursos, name='meus-cursos'),
    path('criar-curso/', criar_curso, name='criar-curso'),
    path('editar-curso/<int:curso_id>/', editar_curso, name='editar-curso'),
    path('deletar-curso/<int:curso_id>/', deletar_curso, name='deletar-curso'),
    path('engajamento-curso/<int:curso_id>/', engajamento_curso, name='engajamento-curso'),

    # Vídeos
    path('meus-videos/', meus_videos, name='meus-videos'),
    path('upload-video/', upload_video, name='upload-video'),
    path('editar-video/<int:video_id>/', editar_video, name='editar-video'),
    path('deletar-video/<int:video_id>/', deletar_video, name='deletar-video'),
    path('engajamento-video/<int:video_id>/', engajamento_video, name='engajamento-video'),
    path('reagir-video/<int:video_id>/', reagir_video, name='reagir-video'),
    path('reordenar-videos/', reordenar_videos, name='reordenar-videos'),

    # Seguir
    path('seguir/<int:professor_id>/', toggle_seguir, name='seguir'),
]
