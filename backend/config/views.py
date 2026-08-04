from django.http import JsonResponse
from django.shortcuts import redirect, render


def index(request):
    """Landing page pública do projeto (template antigo preto)."""
    return render(request, 'index.html')


def health_check(request):
    """Health check simples para load balancers e orquestração."""
    return JsonResponse({'status': 'ok', 'service': 'eyk-backend'})