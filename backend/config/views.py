import os
import re

from django.conf import settings
from django.http import FileResponse, HttpResponse, JsonResponse
from django.shortcuts import redirect
from django.utils._os import safe_join
from django.views.static import serve


def index(request):
    """Raiz do site: o backend não renderiza páginas — reencaminha para o frontend Next.js."""
    next_url = getattr(settings, 'NEXT_PUBLIC_URL', 'http://localhost:3000')
    return redirect(next_url.rstrip('/') + '/')


def health_check(request):
    """Health check simples para load balancers e orquestração."""
    return JsonResponse({'status': 'ok', 'service': 'eyk-backend'})

_RANGE_RE = re.compile(r'bytes=(\d*)-(\d*)')
# Pedidos "bytes=N-" (até ao fim) são respondidos aos bocados: o browser pede
# o resto a seguir, e um vídeo de centenas de MB nunca fica todo em memória.
_RANGE_BLOCO_MAX = 4 * 1024 * 1024


def media_com_range(request, path, document_root):
    """Serve ficheiros de media em desenvolvimento COM suporte a pedidos
    `Range` — o `django.views.static.serve` responde sempre com o ficheiro
    inteiro (200), e sem 206 o browser não consegue avançar/recuar num vídeo
    nem retomar a reprodução a meio. Em produção, o servidor web (nginx…) é
    que serve /media/ e já suporta Range."""
    response = serve(request, path, document_root=document_root)
    rango = _RANGE_RE.fullmatch(request.headers.get('Range', '').strip())
    if not rango or response.status_code != 200 or not isinstance(response, FileResponse):
        response['Accept-Ranges'] = 'bytes'
        return response

    caminho = safe_join(document_root, path)
    tamanho = os.path.getsize(caminho)
    inicio_txt, fim_txt = rango.groups()
    if inicio_txt:
        inicio = int(inicio_txt)
        fim = min(int(fim_txt), tamanho - 1) if fim_txt else min(inicio + _RANGE_BLOCO_MAX, tamanho) - 1
    elif fim_txt:  # "bytes=-500" → últimos 500 bytes
        inicio, fim = max(tamanho - int(fim_txt), 0), tamanho - 1
    else:
        inicio, fim = 0, tamanho - 1
    # Só fecha o ficheiro aberto pelo `serve` — `response.close()` dispararia
    # o sinal request_finished (fecha as ligações à BD) a meio do pedido.
    response.file_to_stream.close()
    if inicio >= tamanho or inicio > fim:
        nao_satisfaz = HttpResponse(status=416)
        nao_satisfaz['Content-Range'] = f'bytes */{tamanho}'
        return nao_satisfaz

    with open(caminho, 'rb') as f:
        f.seek(inicio)
        parte = f.read(fim - inicio + 1)
    parcial = HttpResponse(parte, status=206, content_type=response['Content-Type'])
    parcial['Content-Range'] = f'bytes {inicio}-{fim}/{tamanho}'
    parcial['Accept-Ranges'] = 'bytes'
    return parcial
