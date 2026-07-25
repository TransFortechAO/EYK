from django.urls import path
from .views import (
    meus_cursos, perfil_professor, criar_curso,
    editar_curso, deletar_curso, engajamento_curso,
    meus_videos, upload_video, editar_video, deletar_video, engajamento_video,
    reagir_video, configuracoes_professor, apagar_conta_professor,
    toggle_seguir,
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

    # Seguir
    path('seguir/<int:professor_id>/', toggle_seguir, name='seguir'),
]
