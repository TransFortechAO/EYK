import os

from celery import Celery

# Defina a configuração padrão do Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('eyk')

# Carregue configurações do Django
app.config_from_object('django.conf:settings', namespace='CELERY')

# Descubra tasks automaticamente
app.autodiscover_tasks()