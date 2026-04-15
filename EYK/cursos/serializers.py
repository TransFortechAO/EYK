from rest_framework import serializers
from .models import Curso, Categoria


class CourseSerializer(serializers.ModelSerializer):

    class Meta:
        model = Curso
        fields = '__all__'  # ✅ Corrigido: era fields = 'all' (inválido no DRF)