from django.utils.timesince import timesince
from rest_framework import serializers

from .models import Comentario, Post, ReacaoPost


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
    time_ago = serializers.SerializerMethodField()
    likes = serializers.SerializerMethodField()
    comentarios = serializers.SerializerMethodField()
    liked = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id', 'autor', 'autor_nome', 'autor_initials',
            'conteudo', 'imagem', 'criado_em', 'time_ago',
            'likes', 'comentarios', 'liked'
        ]

    def get_autor_nome(self, obj):
        return obj.autor.get_display_name()

    def get_autor_initials(self, obj):
        nome = obj.autor.get_full_name() or obj.autor.username
        return _get_initials(nome)

    def get_time_ago(self, obj):
        return _format_time_ago(obj.criado_em)

    def get_likes(self, obj):
        return obj.total_likes()

    def get_comentarios(self, obj):
        return obj.total_comentarios()

    def get_liked(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return ReacaoPost.objects.filter(post=obj, utilizador=request.user).exists()


class ComentarioSerializer(serializers.ModelSerializer):
    autor_nome = serializers.SerializerMethodField()
    autor_initials = serializers.SerializerMethodField()
    time_ago = serializers.SerializerMethodField()

    class Meta:
        model = Comentario
        fields = [
            'id', 'autor', 'autor_nome', 'autor_initials',
            'conteudo', 'criado_em', 'time_ago'
        ]

    def get_autor_nome(self, obj):
        return obj.autor.get_display_name()

    def get_autor_initials(self, obj):
        nome = obj.autor.get_full_name() or obj.autor.username
        return _get_initials(nome)

    def get_time_ago(self, obj):
        return _format_time_ago(obj.criado_em)
