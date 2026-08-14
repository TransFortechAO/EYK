from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.gamificacao.services import creditar_moedas

from .models import Comentario, Post, ReacaoPost
from .serializers import ComentarioSerializer, PostSerializer


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def post_list(request):
    if request.method == 'POST':
        conteudo = request.data.get('conteudo', '').strip()
        if not conteudo:
            return Response(
                {'detail': 'O conteúdo do post é obrigatório.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        post = Post.objects.create(autor=request.user, conteudo=conteudo)
        creditar_moedas(request.user, 2, 'post_comunidade')
        serializer = PostSerializer(post, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    posts = Post.objects.all().order_by('-criado_em')[:50]
    serializer = PostSerializer(posts, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def post_react(request, post_id):
    try:
        post = Post.objects.get(pk=post_id)
    except Post.DoesNotExist:
        return Response(
            {'detail': 'Post não encontrado.'},
            status=status.HTTP_404_NOT_FOUND
        )

    reacao = ReacaoPost.objects.filter(post=post, utilizador=request.user).first()
    if reacao:
        reacao.delete()
        liked = False
    else:
        ReacaoPost.objects.create(post=post, utilizador=request.user, tipo='like')
        liked = True

    return Response({
        'liked': liked,
        'likes': post.total_likes()
    })


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def comentario_list(request, post_id):
    try:
        post = Post.objects.get(pk=post_id)
    except Post.DoesNotExist:
        return Response(
            {'detail': 'Post não encontrado.'},
            status=status.HTTP_404_NOT_FOUND
        )

    if request.method == 'POST':
        conteudo = request.data.get('conteudo', '').strip()
        if not conteudo:
            return Response(
                {'detail': 'O conteúdo do comentário é obrigatório.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        comentario = Comentario.objects.create(
            post=post,
            autor=request.user,
            conteudo=conteudo
        )
        serializer = ComentarioSerializer(comentario, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    comentarios = post.comentarios.all()
    serializer = ComentarioSerializer(comentarios, many=True, context={'request': request})
    return Response(serializer.data)
