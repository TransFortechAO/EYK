import os
from .base import *

# Apenas para desenvolvimento local/rede privada. Não usar estas permissões em produção.
DEBUG = True
ALLOWED_HOSTS = ['*']

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# CORS permissivo apenas no ambiente de desenvolvimento.
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# O endereço IP tem de ser o do computador onde o Django está a correr.
# Pode ser definido sem alterar o código: LAN_IP=192.168.1.50
LAN_IP = os.getenv('LAN_IP', '192.168.1.122').strip()
CSRF_TRUSTED_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
]
if LAN_IP:
    CSRF_TRUSTED_ORIGINS.extend([f'http://{LAN_IP}:3000', f'http://{LAN_IP}:8000'])

for origem in os.getenv('CSRF_TRUSTED_ORIGINS_EXTRA', '').split(','):
    origem = origem.strip().rstrip('/')
    if origem and origem not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(origem)

# Email aparece na consola do terminal durante o desenvolvimento.
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
STATIC_URL = '/static/'
MEDIA_URL = '/media/'
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
