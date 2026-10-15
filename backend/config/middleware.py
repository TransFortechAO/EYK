from django.http import JsonResponse


class HealthCheckMiddleware:
    """Responde a /health/ antes de qualquer outro middleware: o health check
    do Render chega por HTTP interno, com um Host que não está em
    ALLOWED_HOSTS e sem X-Forwarded-Proto (seria 400 ou redirect para HTTPS)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path_info == '/health/':
            return JsonResponse({'status': 'ok', 'service': 'eyk-backend'})
        return self.get_response(request)
