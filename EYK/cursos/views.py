from rest_framework import viewsets, permissions
from .models import Curso
from .serializers import CourseSerializer

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