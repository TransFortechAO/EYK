from django.http import JsonResponse
from django.shortcuts import redirect, render


def index(request):
    return redirect('http://localhost:3000/', permanent=False)


def health_check(request):
    """Health check simples para load balancers e orquestração."""
    return JsonResponse({'status': 'ok', 'service': 'eyk-backend'})