from rest_framework import serializers

from .models import Categoria, Curso
from apps.professores.models import Video


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ['id', 'nome']


class CourseSerializer(serializers.ModelSerializer):
    professor_nome = serializers.CharField(source='professor.nome_publico', read_only=True)
    categoria_nome = serializers.CharField(source='categoria.nome', read_only=True, allow_null=True)
    total_inscritos = serializers.SerializerMethodField()
    total_visualizacoes = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()

    class Meta:
        model = Curso
        fields = '__all__'

    def get_total_inscritos(self, obj):
        return obj.total_inscritos()

    def get_total_visualizacoes(self, obj):
        return obj.total_visualizacoes()

    def get_progress(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
        try:
            from apps.alunos.models import Aluno
            aluno = Aluno.objects.get(user=request.user)
            inscricao = obj.inscricoes.filter(aluno=aluno).first()
            if inscricao:
                return 100 if inscricao.concluido else 0
        except Exception:
            pass
        return 0


class VideoSerializer(serializers.ModelSerializer):
    professor_nome = serializers.CharField(source='professor.nome_publico', read_only=True)
    total_likes = serializers.SerializerMethodField()
    total_visualizacoes = serializers.SerializerMethodField()

    class Meta:
        model = Video
        fields = '__all__'

    def get_total_likes(self, obj):
        return obj.total_likes()

    def get_total_visualizacoes(self, obj):
        return obj.total_visualizacoes()
