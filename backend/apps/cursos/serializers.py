from django.utils.timesince import timesince
from rest_framework import serializers

from .models import Categoria, Curso
from apps.professores.models import ComentarioVideo, Video


def _tempo_desde(data):
    ts = timesince(data)
    partes = ts.split(', ')
    return 'há ' + partes[0]


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ['id', 'nome']


class CursoVideoSerializer(serializers.ModelSerializer):
    total_likes = serializers.SerializerMethodField()

    class Meta:
        model = Video
        fields = [
            'id', 'titulo', 'descricao', 'arquivo', 'url_externa', 'thumbnail', 'ordem',
            'duracao_segundos', 'total_likes',
        ]

    def get_total_likes(self, obj):
        return obj.total_likes()


class CourseSerializer(serializers.ModelSerializer):
    professor_nome = serializers.CharField(source='professor.nome_publico', read_only=True)
    professor_user_id = serializers.IntegerField(source='professor.user_id', read_only=True)
    professor_foto = serializers.SerializerMethodField()
    categoria_nome = serializers.CharField(source='categoria.nome', read_only=True, allow_null=True)
    total_inscritos = serializers.SerializerMethodField()
    total_visualizacoes = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()
    inscrito = serializers.SerializerMethodField()
    sou_o_professor = serializers.SerializerMethodField()
    duracao_total_segundos = serializers.SerializerMethodField()
    videos = serializers.SerializerMethodField()

    class Meta:
        model = Curso
        fields = '__all__'

    def get_professor_foto(self, obj):
        prof = obj.professor
        return prof.foto.url if prof and prof.foto else None

    def get_total_inscritos(self, obj):
        return obj.total_inscritos()

    def get_total_visualizacoes(self, obj):
        return obj.total_visualizacoes()

    def get_videos(self, obj):
        videos = obj.videos.filter(ativo=True).order_by('ordem', 'criado_em')
        return CursoVideoSerializer(videos, many=True, context=self.context).data

    def get_duracao_total_segundos(self, obj):
        return sum(obj.videos.filter(ativo=True).values_list('duracao_segundos', flat=True))

    def _get_inscricao(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        try:
            from apps.alunos.models import Aluno
            aluno = Aluno.objects.get(profile=request.user)
            return obj.inscricoes.filter(aluno=aluno).first()
        except Exception:
            return None

    def get_progress(self, obj):
        inscricao = self._get_inscricao(obj)
        if inscricao:
            return 100 if inscricao.concluido else 0
        return 0

    def get_inscrito(self, obj):
        return self._get_inscricao(obj) is not None

    def get_sou_o_professor(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.professor.user_id == request.user.id


class VideoSerializer(serializers.ModelSerializer):
    professor_nome = serializers.CharField(source='professor.nome_publico', read_only=True)
    professor_user_id = serializers.IntegerField(source='professor.user_id', read_only=True)
    professor_foto = serializers.SerializerMethodField()
    total_likes = serializers.SerializerMethodField()
    total_visualizacoes = serializers.SerializerMethodField()

    class Meta:
        model = Video
        fields = '__all__'

    def get_professor_foto(self, obj):
        prof = obj.professor
        return prof.foto.url if prof and prof.foto else None

    def get_total_likes(self, obj):
        return obj.total_likes()

    def get_total_visualizacoes(self, obj):
        return obj.total_visualizacoes()


class ComentarioVideoSerializer(serializers.ModelSerializer):
    autor_nome = serializers.SerializerMethodField()
    autor_initials = serializers.SerializerMethodField()
    autor_foto = serializers.SerializerMethodField()
    tempo = serializers.SerializerMethodField()
    total_likes = serializers.SerializerMethodField()
    liked = serializers.SerializerMethodField()
    pode_editar = serializers.SerializerMethodField()
    pode_apagar = serializers.SerializerMethodField()
    respostas = serializers.SerializerMethodField()

    class Meta:
        model = ComentarioVideo
        fields = [
            'id', 'autor', 'autor_nome', 'autor_initials', 'autor_foto', 'parent', 'conteudo',
            'criado_em', 'editado_em', 'tempo', 'total_likes', 'liked',
            'pode_editar', 'pode_apagar', 'respostas',
        ]
        read_only_fields = ['id', 'autor', 'criado_em', 'editado_em']

    def get_autor_nome(self, obj):
        return obj.autor.get_display_name()

    def get_autor_initials(self, obj):
        nome = obj.autor.get_display_name()
        partes = nome.strip().split()
        if len(partes) >= 2:
            return (partes[0][0] + partes[-1][0]).upper()
        return nome[:2].upper() if nome else '??'

    def get_autor_foto(self, obj):
        user = obj.autor
        try:
            if getattr(user, 'is_teacher', False):
                from apps.professores.models import Professor
                prof = Professor.objects.filter(user=user).first()
                if prof and prof.foto:
                    return prof.foto.url
            else:
                from apps.alunos.models import Aluno
                aluno = Aluno.objects.filter(profile=user).first()
                if aluno and aluno.foto:
                    return aluno.foto.url
        except Exception:
            pass
        return None

    def get_tempo(self, obj):
        return _tempo_desde(obj.criado_em)

    def get_total_likes(self, obj):
        return obj.total_likes()

    def get_liked(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.reacoes.filter(utilizador=request.user).exists()

    def get_pode_editar(self, obj):
        request = self.context.get('request')
        return bool(request and request.user.is_authenticated and obj.autor_id == request.user.id)

    def get_pode_apagar(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        if obj.autor_id == request.user.id:
            return True
        return obj.video.professor.user_id == request.user.id

    def get_respostas(self, obj):
        if obj.parent_id is not None:
            return []
        respostas = obj.respostas.select_related('autor').order_by('criado_em')
        return ComentarioVideoSerializer(respostas, many=True, context=self.context).data
