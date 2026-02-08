from django.urls import path
from .views import feed_home

urlpatterns = [
    path('', feed_home, name='feed-home'),
    
]