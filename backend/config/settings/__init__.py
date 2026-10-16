import os

from dotenv import load_dotenv

load_dotenv()

DJANGO_ENV = os.getenv('DJANGO_ENV', 'dev')

if DJANGO_ENV == 'prod':
    from .prod import *
else:
    from .dev import *