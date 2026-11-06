"""Ficheiros privados da escola: nunca ficam em /media (público). Só saem por views que
verificam quem pede. Com PRIVADO_BUCKET vão para um bucket PRIVADO (Backblaze B2), separado
do bucket público dos cursos; sem ele, para o disco em PRIVADO_ROOT."""
import os
import re

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.http import FileResponse, HttpResponse, HttpResponseRedirect
from django.utils.http import content_disposition_header

_RANGE = re.compile(r'bytes=(\d*)-(\d*)')
_BLOCO_MAX = 4 * 1024 * 1024
# O link assinado só serve para abrir o ficheiro agora; não é uma forma de o partilhar.
VALIDADE_LINK_SEG = 5 * 60

# Só estes tipos abrem no browser; tudo o resto descarrega, para um ficheiro carregado
# nunca correr como página do site.
TIPO_SEGURO = {
    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif', 'webp': 'image/webp',
    'mp3': 'audio/mpeg', 'm4a': 'audio/mp4', 'wav': 'audio/wav', 'ogg': 'audio/ogg', 'aac': 'audio/aac',
    'mp4': 'video/mp4', 'mov': 'video/quicktime', 'webm': 'video/webm', 'm4v': 'video/x-m4v',
    'pdf': 'application/pdf',
}
EXTENSOES = {
    'documento': {'pdf', 'doc', 'docx', 'odt', 'txt', 'xls', 'xlsx', 'ppt', 'pptx', 'zip'},
    'imagem': {'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'},
    'audio': {'mp3', 'm4a', 'wav', 'ogg', 'aac'},
    'video': {'mp4', 'mov', 'webm', 'm4v'},
}


def storage_privado():
    bucket = getattr(settings, 'PRIVADO_BUCKET', '')
    if bucket:
        from storages.backends.s3 import S3Storage

        opcoes = {
            'bucket_name': bucket,
            'custom_domain': None,
            'querystring_auth': True,
            'querystring_expire': VALIDADE_LINK_SEG,
            'file_overwrite': False,
            # O B2 só aceita assinaturas v4.
            'signature_version': 's3v4',
            'object_parameters': {'CacheControl': 'private, no-store'},
        }
        # Chave própria do bucket privado, se a do bucket público não lhe chegar.
        if settings.PRIVADO_ACCESS_KEY_ID:
            opcoes.update(access_key=settings.PRIVADO_ACCESS_KEY_ID, secret_key=settings.PRIVADO_SECRET_ACCESS_KEY)
        return S3Storage(**opcoes)
    return FileSystemStorage(location=settings.PRIVADO_ROOT)


def extensao(nome: str) -> str:
    return os.path.splitext(nome or '')[1].lstrip('.').lower()


def categoria_de(nome: str) -> str | None:
    """Decide pela extensão, não pelo tipo que o browser declara."""
    ext = extensao(nome)
    return next((c for c, lista in EXTENSOES.items() if ext in lista), None)


def caminho_ficheiro(instancia, nome: str) -> str:
    return f'escola-{instancia.instituicao_id}/{instancia.__class__.__name__.lower()}/{os.path.basename(nome)}'


def servir(request, campo, nome: str) -> HttpResponse:
    """Entrega o ficheiro já autorizado, com suporte a Range (vídeos)."""
    tipo = TIPO_SEGURO.get(extensao(nome))
    disposicao = content_disposition_header(not tipo, nome)
    if getattr(settings, 'PRIVADO_BUCKET', ''):
        # Num bucket, ler um trecho por aqui descarregaria o ficheiro inteiro a cada pedido. A
        # autorização já foi feita: o browser recebe um link que expira e fala com o B2.
        resposta = HttpResponseRedirect(campo.storage.url(campo.name, expire=VALIDADE_LINK_SEG, parameters={
            'ResponseContentDisposition': disposicao,
            'ResponseContentType': tipo or 'application/octet-stream',
        }))
        resposta['Cache-Control'] = 'private, no-store'
        return resposta
    tamanho = campo.size
    rango = _RANGE.fullmatch(request.headers.get('Range', '').strip())
    if rango and tipo:
        ini, fim = rango.groups()
        if ini:
            inicio = int(ini)
            ultimo = min(int(fim), tamanho - 1) if fim else min(inicio + _BLOCO_MAX, tamanho) - 1
        elif fim:
            inicio, ultimo = max(tamanho - int(fim), 0), tamanho - 1
        else:
            inicio, ultimo = 0, tamanho - 1
        if inicio >= tamanho or inicio > ultimo:
            resposta = HttpResponse(status=416)
            resposta['Content-Range'] = f'bytes */{tamanho}'
            return resposta
        ultimo = min(ultimo, inicio + _BLOCO_MAX - 1)
        with campo.storage.open(campo.name, 'rb') as f:
            f.seek(inicio)
            parte = f.read(ultimo - inicio + 1)
        resposta = HttpResponse(parte, status=206, content_type=tipo)
        resposta['Content-Range'] = f'bytes {inicio}-{ultimo}/{tamanho}'
    else:
        resposta = FileResponse(campo.storage.open(campo.name, 'rb'), content_type=tipo or 'application/octet-stream')
        resposta['Content-Length'] = tamanho
    resposta['Accept-Ranges'] = 'bytes'
    resposta['Content-Disposition'] = disposicao
    resposta['X-Content-Type-Options'] = 'nosniff'
    resposta['Cache-Control'] = 'private, no-store'
    return resposta
