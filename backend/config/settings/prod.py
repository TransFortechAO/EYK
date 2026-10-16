import os
from urllib.parse import urlparse

from dotenv import load_dotenv

# Carregar .env ANTES de importar base.py, porque base.py lê SECRET_KEY e URLs.
load_dotenv()
import dj_database_url  # noqa: E402
from django.core.exceptions import ImproperlyConfigured  # noqa: E402

from .base import *  # noqa: E402,F401,F403
from .base import _split_origins  # noqa: E402


def _env_bool(nome, omissao=False):
    return os.getenv(nome, str(omissao)).strip().lower() in ('1', 'true', 'sim', 'yes')


def _lista(nome):
    return [v.strip() for v in os.getenv(nome, '').split(',') if v.strip()]


DEBUG = False

if SECRET_KEY.startswith('django-insecure'):  # noqa: F405
    raise ImproperlyConfigured('Define DJANGO_SECRET_KEY em produção.')

# Hosts aceites: os definidos + o endereço do Render (RENDER_EXTERNAL_HOSTNAME
# é definido pelo próprio Render) + o do frontend, porque o Next.js
# reencaminha /api, /accounts, /media… para aqui (ver frontend/next.config.ts)
# e o pedido chega com X-Forwarded-Host do frontend.
ALLOWED_HOSTS = _lista('ALLOWED_HOSTS')
for _host in (os.getenv('RENDER_EXTERNAL_HOSTNAME', ''), urlparse(NEXT_PUBLIC_URL).hostname or ''):  # noqa: F405
    if _host and _host not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(_host)
USE_X_FORWARDED_HOST = _env_bool('USE_X_FORWARDED_HOST', True)
# O HTTPS termina no proxy do Render; ele avisa com X-Forwarded-Proto.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Aceita DATABASE_URL (como no .env.example) ou as variáveis DB_* antigas.
database_url = os.getenv('DATABASE_URL', '').strip()
if database_url:
    DATABASES = {'default': dj_database_url.parse(database_url, conn_max_age=600, conn_health_checks=True)}
else:
    DATABASES = {'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME', ''),
        'USER': os.getenv('DB_USER', ''),
        'PASSWORD': os.getenv('DB_PASSWORD', ''),
        'HOST': os.getenv('DB_HOST', ''),
        'PORT': os.getenv('DB_PORT', '5432'),
    }}

# Cache partilhada entre processos (os limites de frequência dependem dela:
# com a LocMemCache por omissão, cada worker do gunicorn contaria à parte).
cache_url = os.getenv('CACHE_URL', '').strip()
if cache_url:
    CACHES = {'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': cache_url,
        'KEY_PREFIX': 'eyk',
    }}

SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = int(os.getenv('SECURE_HSTS_SECONDS', '31536000'))
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

CORS_ALLOWED_ORIGINS = _split_origins(NEXT_PUBLIC_URL, os.getenv('CORS_EXTRA'), os.getenv('CORS_ALLOWED_ORIGINS'))  # noqa: F405
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = _split_origins(*CORS_ALLOWED_ORIGINS, os.getenv('CSRF_TRUSTED_ORIGINS'))

MIDDLEWARE.insert(0, 'config.middleware.HealthCheckMiddleware')  # noqa: F405

# Ficheiros estáticos (admin do Django, DRF) servidos pelo próprio gunicorn.
MIDDLEWARE.insert(MIDDLEWARE.index('django.middleware.security.SecurityMiddleware') + 1,  # noqa: F405
                  'whitenoise.middleware.WhiteNoiseMiddleware')
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')  # noqa: F405
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}

# Media (vídeos, fotos, PDFs). Duas opções:
# - Disco persistente do Render montado em MEDIA_ROOT (ex: /var/data/media),
#   servido pelo Django (SERVIR_MEDIA, com suporte a Range para os vídeos);
# - Bucket S3-compatível (Cloudflare R2, AWS S3…) se AWS_STORAGE_BUCKET_NAME
#   estiver definido — recomendado com muitos alunos a ver vídeos ao mesmo tempo.
MEDIA_ROOT = os.getenv('MEDIA_ROOT', '').strip() or os.path.join(BASE_DIR, 'mediafiles')  # noqa: F405
AWS_STORAGE_BUCKET_NAME = os.getenv('AWS_STORAGE_BUCKET_NAME', '').strip()
if AWS_STORAGE_BUCKET_NAME:
    AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID', '')
    AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY', '')
    AWS_S3_ENDPOINT_URL = os.getenv('AWS_S3_ENDPOINT_URL') or None  # R2: https://<conta>.r2.cloudflarestorage.com
    AWS_S3_REGION_NAME = os.getenv('AWS_S3_REGION_NAME') or None   # R2: auto
    # Domínio público do bucket (ex: media.eyk.ao). Sem ele, os URLs são
    # assinados e expiram ao fim de AWS_QUERYSTRING_EXPIRE segundos.
    AWS_S3_CUSTOM_DOMAIN = os.getenv('AWS_S3_CUSTOM_DOMAIN') or None
    AWS_QUERYSTRING_AUTH = not AWS_S3_CUSTOM_DOMAIN
    AWS_QUERYSTRING_EXPIRE = 6 * 60 * 60
    AWS_DEFAULT_ACL = None
    AWS_S3_FILE_OVERWRITE = False
    AWS_S3_OBJECT_PARAMETERS = {'CacheControl': 'public, max-age=2592000'}
    STORAGES['default'] = {'BACKEND': 'storages.backends.s3.S3Storage'}
    SERVIR_MEDIA = False
else:
    SERVIR_MEDIA = _env_bool('SERVIR_MEDIA', True)

# Email. Com BREVO_API_KEY, envia pela API HTTP do Brevo — o plano free do
# Render bloqueia as portas SMTP (25, 465, 587). Sem ela, usa SMTP.
BREVO_API_KEY = os.getenv('BREVO_API_KEY', '').strip()
if BREVO_API_KEY:
    EMAIL_BACKEND = 'anymail.backends.brevo.EmailBackend'
    ANYMAIL = {'BREVO_API_KEY': BREVO_API_KEY}
else:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.getenv('EMAIL_HOST', '')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_USE_SSL = _env_bool('EMAIL_USE_SSL', EMAIL_PORT == 465)
EMAIL_USE_TLS = not EMAIL_USE_SSL and _env_bool('EMAIL_USE_TLS', True)
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
EMAIL_TIMEOUT = 20
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER)
SERVER_EMAIL = DEFAULT_FROM_EMAIL

# O Render guarda o que sai na consola (Logs do serviço).
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {'verbose': {
        'format': '{levelname} {asctime} {name} {message}',
        'style': '{',
    }},
    'handlers': {
        'console': {'level': 'INFO', 'class': 'logging.StreamHandler', 'formatter': 'verbose'},
    },
    'root': {'handlers': ['console'], 'level': 'WARNING'},
    'loggers': {
        'django': {'handlers': ['console'], 'level': 'INFO', 'propagate': False},
        'apps': {'handlers': ['console'], 'level': 'INFO', 'propagate': False},
        'celery': {'handlers': ['console'], 'level': 'INFO', 'propagate': False},
    },
}

# Erros enviados para o Sentry (opcional).
SENTRY_DSN = os.getenv('SENTRY_DSN', '').strip()
if SENTRY_DSN:
    import sentry_sdk  # noqa: E402

    sentry_sdk.init(dsn=SENTRY_DSN, send_default_pii=False, traces_sample_rate=0.0)
