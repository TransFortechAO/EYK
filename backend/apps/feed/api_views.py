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
def post_repostar(request, post_id):
    """Reposta a publicação de alguém na comunidade, com um comentário opcional.
    Aponta sempre para a publicação original (repostar um repost reposta o original)."""
    alvo = get_object_or_404(_visiveis(Post.objects.select_related('autor', 'repost_de'), request), pk=post_id)
    original = alvo.repost_de or alvo
    if original.oculto or estao_bloqueados(request.user, original.autor):
        return Response({'detail': 'Esta publicação não pode ser repostada.'}, status=status.HTTP_400_BAD_REQUEST)
    conteudo = (request.data.get('conteudo') or '').strip()
    if not conteudo and Post.objects.filter(autor=request.user, repost_de=original, conteudo='').exists():
        return Response({'detail': 'Já repostaste esta publicação.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        termos = verificar_publicacao(request.user, conteudo, 'post')
    except ConteudoRecusado as erro:
        return Response({'detail': erro.mensagem}, status=erro.status)
    post = Post.objects.create(autor=request.user, conteudo=conteudo, repost_de=original)
    if conteudo:
        sinalizar_se_necessario('post', post, termos)
    if original.autor_id != request.user.id:
        nome = request.user.get_display_name() or request.user.username
        notificar(
            original.autor, 'comunidade', f'{nome} repostou a tua publicação: "{_resumo(original.conteudo)}"',
            link=f'/comunidade?post={post.id}',
        )
    return Response(PostSerializer(post, context=_contexto(request)).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def partilha_publica(request, tipo, obj_id):
    """Dados mínimos para a pré-visualização de um link partilhado noutras redes
    (título, excerto, autor e capa). Público — os robôs das redes não têm sessão —,
    por isso só devolve o que é preciso e nada do que está oculto."""
    if tipo == 'post':
        post = get_object_or_404(
            Post.objects.select_related('autor', 'repost_de__autor'), pk=obj_id, oculto=False, autor__is_active=True,
        )
        nome = post.autor.get_display_name() or post.autor.username
        texto = post.conteudo
        if not texto and post.repost_de and not post.repost_de.oculto:
            texto = post.repost_de.conteudo
        return Response({
            'tipo': 'post',
            'titulo': f'{nome} na comunidade EYK',
            'descricao': _resumo(texto, 220),
            'autor': nome,
            'imagem': post.imagem.url if post.imagem else None,
        })
    if tipo == 'video':
        from apps.professores.models import Video

        video = get_object_or_404(Video.objects.select_related('professor'), pk=obj_id, ativo=True, oculto=False)
        return Response({
            'tipo': 'video',
            'titulo': video.titulo,
            'descricao': _resumo(video.descricao, 220),
            'autor': video.professor.nome_publico,
            'imagem': video.thumbnail.url if video.thumbnail else None,
        })
    if tipo == 'curso':
        from apps.cursos.models import Curso

        curso = get_object_or_404(
            Curso.objects.select_related('professor', 'categoria'), pk=obj_id, ativo=True, oculto=False,
        )
        return Response({
            'tipo': 'curso',
            'titulo': curso.titulo,
            'descricao': _resumo(curso.descricao, 220),
            'autor': curso.professor.nome_publico,
            'categoria': curso.categoria.nome if curso.categoria_id else None,
            'imagem': curso.thumbnail.url if curso.thumbnail else None,
        })
    return Response({'detail': 'Tipo desconhecido.'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['PATCH'])
@permission_classes([permissions.IsAuthenticated])
def post_detail(request, post_id):
    """O autor edita o texto da sua publicação; fica marcada como editada."""
    post = get_object_or_404(Post, pk=post_id)
    if post.autor_id != request.user.id:
        return Response({'detail': 'Sem permissão para editar esta publicação.'}, status=status.HTTP_403_FORBIDDEN)
    conteudo = (request.data.get('conteudo') or '').strip()
    if not conteudo:
        return Response({'detail': 'O conteúdo do post é obrigatório.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        # 'bio' = só o filtro de palavras (editar não conta para os limites de frequência).
        termos = verificar_publicacao(request.user, conteudo, 'bio')
    except ConteudoRecusado as erro:
        return Response({'detail': erro.mensagem}, status=erro.status)
    if conteudo != post.conteudo:
        post.conteudo = conteudo
        post.editado_em = timezone.now()
        post.save(update_fields=['conteudo', 'editado_em'])
        sinalizar_se_necessario('post', post, termos)
    return Response(PostSerializer(post, context=_contexto(request)).data)


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
