from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import redirect


def index(request):
    """Raiz do site: o backend não renderiza páginas — reencaminha para o frontend Next.js."""
    next_url = getattr(settings, 'NEXT_PUBLIC_URL', 'http://localhost:3000')
    return redirect(next_url.rstrip('/') + '/')


def health_check(request):
    """Health check simples para load balancers e orquestração."""
    return JsonResponse({'status': 'ok', 'service': 'eyk-backend'})