from django_otp.plugins.otp_totp.models import TOTPDevice
from rest_framework import serializers

from apps.cursos.models import Categoria, Curso

from .models import Professor, ReacaoVideo, Video


class ProfessorSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    tem_2fa = serializers.SerializerMethodField()
    seguidores = serializers.SerializerMethodField()

    class Meta:
        model = Professor
        fields = [
            'id', 'nome_publico', 'bio', 'area', 'foto', 'ativo', 'criado_em',
            'username', 'email', 'tem_2fa', 'seguidores',
        ]
        read_only_fields = ['id', 'ativo', 'criado_em', 'username', 'email', 'tem_2fa', 'seguidores']

    def get_tem_2fa(self, obj):
        return TOTPDevice.objects.filter(user=obj.user, confirmed=True).exists()

    def get_seguidores(self, obj):
        return obj.seguidores.count()


class ProfessorCursoVideoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Video
        fields = ['id', 'titulo', 'arquivo', 'url_externa', 'thumbnail', 'ordem']
        read_only_fields = fields


class ProfessorCursoSerializer(serializers.ModelSerializer):
    categoria_nome = serializers.CharField(write_only=True, required=False, allow_blank=True)
    categoria = serializers.CharField(source='categoria.nome', read_only=True, default=None)
    total_inscritos = serializers.SerializerMethodField()
    total_visualizacoes = serializers.SerializerMethodField()
    videos = ProfessorCursoVideoSerializer(many=True, read_only=True)

    class Meta:
        model = Curso
        fields = [
            'id', 'titulo', 'descricao', 'categoria', 'categoria_nome', 'preco',
            'duracao', 'thumbnail', 'ativo', 'publicado_em', 'criado_em',
            'total_inscritos', 'total_visualizacoes', 'videos',
        ]
        read_only_fields = ['id', 'criado_em', 'total_inscritos', 'total_visualizacoes', 'videos']

    def get_total_inscritos(self, obj):
        return obj.total_inscritos()

    def get_total_visualizacoes(self, obj):
        return obj.total_visualizacoes()

    def create(self, validated_data):
        categoria_nome = (validated_data.pop('categoria_nome', '') or '').strip()
        if categoria_nome:
            categoria, _ = Categoria.objects.get_or_create(nome=categoria_nome)
            validated_data['categoria'] = categoria
        return super().create(validated_data)

    def update(self, instance, validated_data):
        categoria_nome = validated_data.pop('categoria_nome', None)
        if categoria_nome is not None:
            categoria_nome = categoria_nome.strip()
            if categoria_nome:
                categoria, _ = Categoria.objects.get_or_create(nome=categoria_nome)
                validated_data['categoria'] = categoria
            else:
                validated_data['categoria'] = None
        return super().update(instance, validated_data)


class ProfessorVideoSerializer(serializers.ModelSerializer):
    total_likes = serializers.SerializerMethodField()
    total_visualizacoes = serializers.SerializerMethodField()

    class Meta:
        model = Video
        fields = [
            'id', 'titulo', 'descricao', 'arquivo', 'url_externa', 'thumbnail',
            'criado_em', 'ativo', 'ordem', 'total_likes', 'total_visualizacoes',
        ]
        read_only_fields = ['id', 'criado_em', 'total_likes', 'total_visualizacoes']

    def get_total_likes(self, obj):
        return obj.total_likes()

    def get_total_visualizacoes(self, obj):
        return obj.total_visualizacoes()

    def validate(self, attrs):
        arquivo = attrs.get('arquivo', getattr(self.instance, 'arquivo', None))
        url_externa = attrs.get('url_externa', getattr(self.instance, 'url_externa', ''))
        if not arquivo and not url_externa:
            raise serializers.ValidationError('Indica um ficheiro de vídeo ou um link externo.')
        return attrs


class ReacaoVideoSerializer(serializers.ModelSerializer):
    utilizador_nome = serializers.CharField(source='utilizador.username', read_only=True)

    class Meta:
        model = ReacaoVideo
        fields = ['id', 'utilizador_nome', 'tipo']
