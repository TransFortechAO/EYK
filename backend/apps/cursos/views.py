from rest_framework import permissions, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth import get_user_model

from .models import Curso
from .serializers import CourseSerializer

User = get_user_model()


class CursoViewSet(viewsets.ModelViewSet):
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # evita erro com AnonymousUser
        if self.request.user.is_authenticated:
            return Curso.objects.filter(user=self.request.user)
        return Curso.objects.none()

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def usuario_atual(request):
    """Retorna os dados do usuário autenticado"""
    user = request.user
    data = {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'is_staff': user.is_staff,
        'is_teacher': user.is_teacher,
        'is_student': user.is_student,
        'perfil_completo': user.perfil_completo,
        'tema_preferido': user.tema_preferido,
    }
    return Response(data)