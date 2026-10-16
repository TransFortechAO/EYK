from django.utils.timesince import timesince
from rest_framework import serializers

from .models import Comentario, Post, ReacaoComentario, ReacaoPost


def _get_initials(nome):
    partes = nome.strip().split()
    if len(partes) >= 2:
        return (partes[0][0] + partes[-1][0]).upper()
    return nome[:2].upper() if nome else '??'


def _format_time_ago(data):
    ts = timesince(data)
    partes = ts.split(', ')
    return 'há ' + partes[0]


class PostSerializer(serializers.ModelSerializer):
    autor_nome = serializers.SerializerMethodField()
    autor_initials = serializers.SerializerMethodField()
    autor_foto = serializers.SerializerMethodField()
    time_ago = serializers.SerializerMethodField()
    likes = serializers.SerializerMethodField()
    comentarios = serializers.SerializerMethodField()
    liked = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id', 'autor', 'autor_nome', 'autor_initials', 'autor_foto',
            'conteudo', 'imagem', 'criado_em', 'time_ago',
            'likes', 'comentarios', 'liked', 'oculto',
        ]

    def get_autor_nome(self, obj):
        return obj.autor.get_display_name()

    def get_autor_initials(self, obj):
        nome = obj.autor.get_full_name() or obj.autor.username
        return _get_initials(nome)

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

    def get_time_ago(self, obj):
        return _format_time_ago(obj.criado_em)

    def get_likes(self, obj):
        return obj.total_likes()

    def get_comentarios(self, obj):
        return obj.comentarios.filter(oculto=False).count()

    def get_liked(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return ReacaoPost.objects.filter(post=obj, utilizador=request.user).exists()


class ComentarioSerializer(serializers.ModelSerializer):
    autor_nome = serializers.SerializerMethodField()
    autor_initials = serializers.SerializerMethodField()
    autor_foto = serializers.SerializerMethodField()
    time_ago = serializers.SerializerMethodField()
    total_likes = serializers.SerializerMethodField()
    liked = serializers.SerializerMethodField()
    pode_editar = serializers.SerializerMethodField()
    pode_apagar = serializers.SerializerMethodField()
    respostas = serializers.SerializerMethodField()

    class Meta:
        model = Comentario
        fields = [
            'id', 'autor', 'autor_nome', 'autor_initials', 'autor_foto', 'parent',
            'conteudo', 'criado_em', 'editado_em', 'time_ago',
            'total_likes', 'liked', 'pode_editar', 'pode_apagar', 'respostas', 'oculto',
        ]

    def get_autor_nome(self, obj):
        return obj.autor.get_display_name()

    def get_autor_initials(self, obj):
        nome = obj.autor.get_full_name() or obj.autor.username
        return _get_initials(nome)

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

    def get_time_ago(self, obj):
        return _format_time_ago(obj.criado_em)

    def get_total_likes(self, obj):
        return obj.total_likes()

    def get_liked(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return ReacaoComentario.objects.filter(comentario=obj, utilizador=request.user).exists()

    def get_pode_editar(self, obj):
        request = self.context.get('request')
        return bool(request and request.user.is_authenticated and obj.autor_id == request.user.id)

    def get_pode_apagar(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        if obj.autor_id == request.user.id or request.user.is_staff:
            return True
        # O autor do post também pode moderar os comentários no seu post,
        # tal como o professor pode apagar comentários no seu próprio vídeo.
        return obj.post.autor_id == request.user.id

    def get_respostas(self, obj):
        if obj.parent_id is not None:
            return []
        respostas = obj.respostas.select_related('autor').order_by('criado_em')
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            from django.db.models import Q
            respostas = respostas.filter(Q(oculto=False) | Q(autor=request.user))
        ocultos = self.context.get('ocultos') or set()
        if ocultos:
            respostas = respostas.exclude(autor_id__in=ocultos)
        return ComentarioSerializer(respostas, many=True, context=self.context).data
