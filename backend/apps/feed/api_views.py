from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.notificacoes import notificar
from apps.gamificacao.services import creditar_moedas, verificar_badges
from apps.moderacao.filtro import ConteudoRecusado, sinalizar_se_necessario, verificar_publicacao
from apps.moderacao.servicos import estao_bloqueados, ids_bloqueados

from .models import Comentario, Post, ReacaoComentario, ReacaoPost
from .serializers import ComentarioSerializer, PostSerializer

MOEDAS_POR_POST = 2


def _contexto(request):
    # `ocultos` = autores bloqueados (nos dois sentidos) — os serializers
    # usam-no para filtrar também as respostas aos comentários.
    return {'request': request, 'ocultos': ids_bloqueados(request.user)}


def _visiveis(qs, request, campo_autor='autor'):
    """Tira o que foi ocultado pela moderação (exceto ao próprio autor) e o
    que é de utilizadores bloqueados."""
    qs = qs.filter(Q(oculto=False) | Q(**{campo_autor: request.user}))
    return qs.exclude(**{f'{campo_autor}_id__in': ids_bloqueados(request.user)})


def _resumo(texto: str, n: int = 80) -> str:
    texto = ' '.join((texto or '').split())
    return texto if len(texto) <= n else texto[:n - 1] + '…'


def _notificar_comentario(request, post, comentario, parent):
    """Avisa o autor do post (comentário novo) e o autor do comentário
    original (resposta) — nunca a própria pessoa nem quem a bloqueou."""
    autor = request.user
    nome = autor.get_display_name() or autor.username
    link = f'/comunidade?post={post.id}'
    avisados = {autor.id}
    if parent and parent.autor_id not in avisados and not estao_bloqueados(autor, parent.autor):
        notificar(
            parent.autor, 'comunidade', f'{nome} respondeu ao teu comentário: "{_resumo(comentario.conteudo)}"',
            link=link, categoria_email='comunidade', assunto_email=f'{nome} respondeu ao teu comentário',
        )
        avisados.add(parent.autor_id)
    if post.autor_id not in avisados and not estao_bloqueados(autor, post.autor):
        notificar(
            post.autor, 'comunidade', f'{nome} comentou a tua publicação: "{_resumo(comentario.conteudo)}"',
            link=link, categoria_email='comunidade', assunto_email=f'{nome} comentou a tua publicação',
        )


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
        try:
            termos = verificar_publicacao(request.user, conteudo, 'post')
        except ConteudoRecusado as erro:
            return Response({'detail': erro.mensagem}, status=erro.status)
        post = Post.objects.create(autor=request.user, conteudo=conteudo)
        sinalizar_se_necessario('post', post, termos)
        # Recompensa a participação na comunidade — mesma mecânica de
        # carteira/XP usada nas outras ações gamificadas da plataforma.
        creditar_moedas(request.user, MOEDAS_POR_POST, 'post_comunidade')
        verificar_badges(request.user)
        serializer = PostSerializer(post, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    posts = _visiveis(Post.objects.select_related('autor'), request).order_by('-criado_em')[:50]
    serializer = PostSerializer(posts, many=True, context=_contexto(request))
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
        if estao_bloqueados(request.user, post.autor):
            return Response(
                {'detail': 'Não podes comentar publicações deste utilizador.'}, status=status.HTTP_403_FORBIDDEN,
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

        try:
            termos = verificar_publicacao(request.user, conteudo, 'comentario')
        except ConteudoRecusado as erro:
            return Response({'detail': erro.mensagem}, status=erro.status)

        comentario = Comentario.objects.create(
            post=post,
            autor=request.user,
            conteudo=conteudo,
            parent=parent,
        )
        sinalizar_se_necessario('comentario', comentario, termos)
        _notificar_comentario(request, post, comentario, parent)
        serializer = ComentarioSerializer(comentario, context=_contexto(request))
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    comentarios = (
        _visiveis(post.comentarios.filter(parent__isnull=True), request)
        .select_related('autor')
        .order_by('criado_em')
    )
    serializer = ComentarioSerializer(comentarios, many=True, context=_contexto(request))
    return Response(serializer.data)


@api_view(['PATCH', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def comentario_detail(request, post_id, comentario_id):
    post = get_object_or_404(Post, pk=post_id)
    comentario = get_object_or_404(Comentario, id=comentario_id, post=post)

    if request.method == 'DELETE':
        # Só o próprio autor ou um super administrador apagam um comentário:
        # o dono da publicação NÃO pode apagar comentários de outras pessoas.
        e_autor = comentario.autor_id == request.user.id
        if not (e_autor or request.user.is_superuser):
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
    try:
        # 'bio' = só o filtro de palavras (editar não conta para os limites de frequência).
        termos = verificar_publicacao(request.user, conteudo, 'bio')
    except ConteudoRecusado as erro:
        return Response({'detail': erro.mensagem}, status=erro.status)

    comentario.conteudo = conteudo
    comentario.editado_em = timezone.now()
    comentario.save(update_fields=['conteudo', 'editado_em'])
    sinalizar_se_necessario('comentario', comentario, termos)
    serializer = ComentarioSerializer(comentario, context=_contexto(request))
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
