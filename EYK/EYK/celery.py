from __future__ import absolute_import, unicode_literals
import os
from celery import Celery

"""Configuração da app Celery do projecto.

Corrige o DJANGO_SETTINGS_MODULE para apontar para o módulo de settings do Django.
"""
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'EYK.settings')

app = Celery('EYK')

app.config_from_object('django.conf:settings', namespace='CELERY')

app.autodiscover_tasks()