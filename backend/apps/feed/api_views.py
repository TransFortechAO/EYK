from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.gamificacao.services import creditar_moedas, verificar_badges

from .models import Comentario, Post, ReacaoComentario, ReacaoPost
from .serializers import ComentarioSerializer, PostSerializer

MOEDAS_POR_POST = 2


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
        # Recompensa a participação na comunidade — mesma mecânica de
        # carteira/XP usada nas outras ações gamificadas da plataforma.
        creditar_moedas(request.user, MOEDAS_POR_POST, 'post_comunidade')
        verificar_badges(request.user)
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

    # `get_or_create` em vez de `filter().first()` + `create()`: evita um
    # IntegrityError (500) quando dois cliques quase simultâneos (ex: duplo
    # toque no mobile antes do primeiro pedido responder) tentam ambos criar
    # a mesma reação — o `unique_together` ('post', 'utilizador') rejeitaria
    # o segundo `create()` isolado.
    reacao, criada = ReacaoPost.objects.get_or_create(
        post=post, utilizador=request.user, defaults={'tipo': 'like'},
    )
    if not criada:
        reacao.delete()
        liked = False
    else:
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

        parent = None
        parent_id = request.data.get('parent')
        if parent_id:
            parent = Comentario.objects.filter(id=parent_id, post=post).first()
            if not parent:
                return Response({'detail': 'Comentário original não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
            if parent.parent_id is not None:
                # Achata respostas-a-respostas para um só nível de conversa
                # (igual aos comentários de vídeo).
                parent = parent.parent

        comentario = Comentario.objects.create(
            post=post,
            autor=request.user,
            conteudo=conteudo,
            parent=parent,
        )
        serializer = ComentarioSerializer(comentario, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    comentarios = (
        post.comentarios.filter(parent__isnull=True)
        .select_related('autor')
        .order_by('criado_em')
    )
    serializer = ComentarioSerializer(comentarios, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['PATCH', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def comentario_detail(request, post_id, comentario_id):
    post = get_object_or_404(Post, pk=post_id)
    comentario = get_object_or_404(Comentario, id=comentario_id, post=post)

    if request.method == 'DELETE':
        e_autor = comentario.autor_id == request.user.id
        e_dono_post = post.autor_id == request.user.id
        if not (e_autor or e_dono_post):
            return Response(
                {'detail': 'Sem permissão para apagar este comentário.'}, status=status.HTTP_403_FORBIDDEN,
            )
        comentario.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    if comentario.autor_id != request.user.id:
        return Response(
            {'detail': 'Sem permissão para editar este comentário.'}, status=status.HTTP_403_FORBIDDEN,
        )

    conteudo = (request.data.get('conteudo') or '').strip()
    if not conteudo:
        return Response({'detail': 'Escreve um comentário.'}, status=status.HTTP_400_BAD_REQUEST)

    comentario.conteudo = conteudo
    comentario.editado_em = timezone.now()
    comentario.save(update_fields=['conteudo', 'editado_em'])
    serializer = ComentarioSerializer(comentario, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def comentario_reagir(request, post_id, comentario_id):
    post = get_object_or_404(Post, pk=post_id)
    comentario = get_object_or_404(Comentario, id=comentario_id, post=post)

    reacao, criada = ReacaoComentario.objects.get_or_create(
        comentario=comentario, utilizador=request.user,
    )
    if not criada:
        reacao.delete()
        liked = False
    else:
        liked = True

    return Response({'liked': liked, 'totalLikes': comentario.total_likes()})
