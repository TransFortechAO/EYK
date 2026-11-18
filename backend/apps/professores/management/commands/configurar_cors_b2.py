"""Deixa o browser enviar ficheiros direto para o bucket público (B2), a partir do site.

    python manage.py configurar_cors_b2            # aplica
    python manage.py configurar_cors_b2 --mostrar  # só mostra as regras

Sem estas regras, o B2 recusa o envio direto e o frontend volta a enviar pelo servidor
(funciona, mas mais devagar)."""
import json

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


def regras(origens: list[str]) -> list[dict]:
    return [{
        'AllowedOrigins': origens,
        'AllowedMethods': ['PUT', 'GET', 'HEAD'],
        'AllowedHeaders': ['content-type', 'content-length'],
        'ExposeHeaders': ['ETag'],
        'MaxAgeSeconds': 3600,
    }]


class Command(BaseCommand):
    help = 'Aplica no bucket público (B2) as regras CORS do envio direto de ficheiros.'

    def add_arguments(self, parser):
        parser.add_argument('--mostrar', action='store_true', help='Só mostra as regras, não as aplica.')
        parser.add_argument('--origem', action='append', default=[], help='Origem extra (pode repetir).')

    def handle(self, *args, **opcoes):
        bucket = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', '')
        origens = sorted({*getattr(settings, 'CORS_ALLOWED_ORIGINS', []), *opcoes['origem']})
        if not origens:
            raise CommandError('Sem origens: define NEXT_PUBLIC_URL (ou usa --origem https://o-teu-site).')
        cors = {'CORSRules': regras(origens)}
        if opcoes['mostrar'] or not bucket:
            self.stdout.write(json.dumps(cors, indent=2))
            if not bucket:
                self.stdout.write(self.style.WARNING('AWS_STORAGE_BUCKET_NAME não definido: nada aplicado.'))
            return
        from django.core.files.storage import default_storage

        cliente = default_storage.connection.meta.client
        try:
            cliente.put_bucket_cors(Bucket=bucket, CORSConfiguration=cors)
        except Exception as erro:
            raise CommandError(
                f'O B2 recusou as regras ({erro}). Se o bucket já tem regras CORS definidas no '
                'painel do Backblaze, apaga-as lá (Buckets → CORS Rules) ou cria-as no painel com '
                'as origens acima e as operações s3_put, s3_get e s3_head.'
            ) from erro
        self.stdout.write(self.style.SUCCESS(f'CORS aplicado ao bucket {bucket} para: {", ".join(origens)}'))
