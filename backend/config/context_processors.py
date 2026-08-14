from django.conf import settings


def next_url(request):
    """Expõe o URL do frontend Next.js aos templates HTML legados,
    para linkarem para lá em vez de para outras páginas Django."""
    return {'NEXT_URL': settings.NEXT_PUBLIC_URL.rstrip('/')}
