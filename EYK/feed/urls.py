from django.urls import path
from feed import views


app_name = 'feed'

urlpatterns = [
    path('', views.feed_home, name='home'),
    path('comunidade/', views.comunidade),
    path('cursos/', views.cursos),
    
]