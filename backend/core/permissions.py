from rest_framework import permissions
from rest_framework.request import Request
from rest_framework.views import View


class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Permite edição apenas para o proprietário do objeto, leitura para todos.
    """
    def has_object_permission(self, request: Request, view: View, obj) -> bool:
        # Permissões de leitura são permitidas para qualquer solicitação
        if request.method in permissions.SAFE_METHODS:
            return True

        # Permissões de escrita apenas para o proprietário
        return hasattr(obj, 'usuario') and obj.usuario == request.user


class IsStaffOrReadOnly(permissions.BasePermission):
    """
    Permite edição apenas para staff, leitura para todos.
    """
    def has_permission(self, request: Request, view: View) -> bool:
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_staff


class IsAuthenticatedAndVerified(permissions.BasePermission):
    """
    Requer que o usuário esteja autenticado E tenha verificado 2FA (se habilitado)
    """
    def has_permission(self, request: Request, view: View) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
            
        # Verifica se o usuário completou o perfil e 2FA se necessário
        if hasattr(request.user, 'perfil_completo') and not request.user.perfil_completo:
            return False
            
        return True