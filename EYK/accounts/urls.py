from django.urls import path
from . import views
from .admin_dashboard import registar_professor

app_name = 'accounts'

urlpatterns = [
    path('register/', views.register_view, name='register'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('completar-perfil/', views.completar_perfil_aluno, name='completar-perfil-aluno'),
    path('completar-perfil-professor/', views.completar_perfil_professor, name='completar-perfil-professor'),
    path('dashboard/professores/', registar_professor, name='dashboard-professores'),
]
