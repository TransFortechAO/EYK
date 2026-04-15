from django.urls import path
from .views import feed_home


app_name = 'feed'

urlpatterns = [
    path('', feed_home, name='home'),
    
]