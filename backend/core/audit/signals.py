import threading

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.utils.deprecation import MiddlewareMixin

from .models import AuditLog

# Thread local para armazenar o usuário atual
_thread_locals = threading.local()


def get_current_user():
    """Retorna o usuário atual armazenado na thread"""
    return getattr(_thread_locals, 'user', None)


def get_current_request():
    """Retorna a requisição atual"""
    return getattr(_thread_locals, 'request', None)


class AuditMiddleware(MiddlewareMixin):
    """
    Middleware que armazena o usuário e requisição atuais na thread
    para uso nos logs de auditoria
    """
    def process_request(self, request):
        _thread_locals.request = request
        if hasattr(request, 'user'):
            _thread_locals.user = request.user if request.user.is_authenticated else None

    def process_response(self, request, response):
        # Limpa os dados da thread após o processamento
        if hasattr(_thread_locals, 'request'):
            del _thread_locals.request
        if hasattr(_thread_locals, 'user'):
            del _thread_locals.user
        return response


def create_audit_log(instance, acao, request=None, usuario=None):
    """
    Função auxiliar para criar logs de auditoria
    """
    if not request:
        request = get_current_request()
    
    if not usuario:
        usuario = get_current_user()

    ip_address = None
    user_agent = None
    if request:
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip_address = x_forwarded_for.split(',')[0]
        else:
            ip_address = request.META.get('REMOTE_ADDR')
        user_agent = request.META.get('HTTP_USER_AGENT')

    AuditLog.objects.create(
        usuario=usuario,
        acao=acao,
        entidade=instance.__class__.__name__,
        entidade_id=str(instance.pk),
        ip_address=ip_address,
        user_agent=user_agent
    )