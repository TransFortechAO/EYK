from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Comentario, Post, ReacaoPost
from .serializers import ComentarioSerializer, PostSerializer


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def post_list(request):
    posts = Post.objects.all().order_by('-criado_em')[:50]
    serializer = PostSerializer(posts, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def post_create(request):
    conteudo = request.data.get('conteudo', '').strip()
    if not conteudo:
        return Response(
            {'detail': 'O conteúdo do post é obrigatório.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    post = Post.objects.create(autor=request.user, conteudo=conteudo)
    serializer = PostSerializer(post, context={'request': request})
    return Response(serializer.data, status=status.HTTP_201_CREATED)


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


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def comentario_list(request, post_id):
    try:
        post = Post.objects.get(pk=post_id)
    except Post.DoesNotExist:
        return Response(
            {'detail': 'Post não encontrado.'},
            status=status.HTTP_404_NOT_FOUND
        )
    comentarios = post.comentarios.all()
    serializer = ComentarioSerializer(comentarios, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def comentario_create(request, post_id):
    try:
        post = Post.objects.get(pk=post_id)
    except Post.DoesNotExist:
        return Response(
            {'detail': 'Post não encontrado.'},
            status=status.HTTP_404_NOT_FOUND
        )

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
