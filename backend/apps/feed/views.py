from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.template.loader import render_to_string
from django.views.decorators.http import require_POST

from apps.cursos.models import Categoria, Curso
from apps.gamificacao.services import creditar_moedas
from apps.professores.models import Professor, Seguidor, Video

from .models import Comentario, Post, ReacaoPost

POSTS_POR_PAGINA = 10
CURSOS_POR_PAGINA = 12


@login_required
def feed_home(request):
    categorias = Categoria.objects.all()
    cursos = Curso.objects.filter(ativo=True).select_related('professor', 'categoria')
    professores = Professor.objects.filter(ativo=True)

    professores_seguidos_ids = list(
        Seguidor.objects.filter(utilizador=request.user).values_list('professor_id', flat=True)
    )
    videos_seguidos = Video.objects.filter(
        professor_id__in=professores_seguidos_ids, ativo=True
    ).select_related('professor').order_by('-criado_em')[:6]
    videos_destaque = Video.objects.filter(ativo=True).exclude(
        professor_id__in=professores_seguidos_ids
    ).select_related('professor').order_by('-criado_em')[:6]

    return render(request, 'feed/home.html', {
        'categorias': categorias,
        'cursos': cursos,
        'professores': professores,
        'professores_seguidos_ids': professores_seguidos_ids,
        'videos_seguidos': videos_seguidos,
        'videos_destaque': videos_destaque,
    })


def _cursos_filtrados(request):
    q = request.GET.get('q', '')
    categoria_id = request.GET.get('categoria', '')
    cursos = Curso.objects.filter(ativo=True).select_related('professor', 'categoria')
    if q:
        cursos = cursos.filter(titulo__icontains=q)
    if categoria_id:
        cursos = cursos.filter(categoria_id=categoria_id)
    return cursos, q, categoria_id


@login_required
def cursos_view(request):
    cursos, q, categoria_id = _cursos_filtrados(request)
    categorias = Categoria.objects.all()
    pagina = Paginator(cursos, CURSOS_POR_PAGINA).get_page(1)

    return render(request, 'feed/cursos.html', {
        'cursos': pagina.object_list,
        'categorias': categorias,
        'q': q,
        'categoria_selecionada': categoria_id,
    })


@login_required
def cursos_pagina(request, page):
    cursos, q, categoria_id = _cursos_filtrados(request)
    paginator = Paginator(cursos, CURSOS_POR_PAGINA)
    pagina = paginator.get_page(page)
    html = ''.join(
        render_to_string('feed/_curso_card.html', {'curso': c}, request=request)
        for c in pagina.object_list
    )
    return JsonResponse({'html': html, 'has_next': pagina.has_next()})


@login_required
def videos_view(request):
    videos = Video.objects.filter(ativo=True).select_related('professor').order_by('-criado_em')
    return render(request, 'feed/videos.html', {'videos': videos})


def _posts_base():
    return Post.objects.select_related('autor').prefetch_related('comentarios', 'reacoes').all()


@login_required
def comunidade(request):
    pagina = Paginator(_posts_base(), POSTS_POR_PAGINA).get_page(1)
    return render(request, 'feed/comunidade.html', {'posts': pagina.object_list})


@login_required
def comunidade_pagina(request, page):
    paginator = Paginator(_posts_base(), POSTS_POR_PAGINA)
    pagina = paginator.get_page(page)
    html = ''.join(
        render_to_string('feed/_post_card.html', {'post': p}, request=request)
        for p in pagina.object_list
    )
    return JsonResponse({'html': html, 'has_next': pagina.has_next()})


@login_required
@require_POST
def criar_post(request):
    conteudo = request.POST.get('conteudo', '').strip()
    imagem = request.FILES.get('imagem')
    if conteudo:
        Post.objects.create(autor=request.user, conteudo=conteudo, imagem=imagem)
        creditar_moedas(request.user, 2, 'post_comunidade')
        messages.success(request, 'Post publicado!')
    return redirect('feed:comunidade')


@login_required
@require_POST
def reagir_post(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    tipo = request.POST.get('tipo', 'like')
    reacao, created = ReacaoPost.objects.get_or_create(
        post=post, utilizador=request.user,
        defaults={'tipo': tipo}
    )
    if not created:
        if reacao.tipo == tipo:
            reacao.delete()
        else:
            reacao.tipo = tipo
            reacao.save()
    return JsonResponse({'likes': post.total_likes()})


@login_required
@require_POST
def comentar_post(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    conteudo = request.POST.get('conteudo', '').strip()
    if conteudo:
        Comentario.objects.create(post=post, autor=request.user, conteudo=conteudo)
    return redirect('feed:comunidade')


@login_required
def notificacoes(request):
    from apps.accounts.models import Notificacao
    notifs = Notificacao.objects.filter(utilizador=request.user)
    notifs.filter(lida=False).update(lida=True)
    return render(request, 'feed/notificacoes.html', {'notificacoes': notifs})


@login_required
def assistir_curso(request, curso_id):
    curso = get_object_or_404(Curso, id=curso_id, ativo=True)
    from apps.alunos.models import Aluno
    from apps.cursos.models import EngajamentoCurso, Inscricao

    # Auto-inscrição ou verifica inscrição
    inscricao = None
    aluno = None
    try:
        aluno = Aluno.objects.get(profile=request.user)
        inscricao, _ = Inscricao.objects.get_or_create(aluno=aluno, curso=curso)
        eng, _ = EngajamentoCurso.objects.get_or_create(curso=curso, aluno=aluno)
        eng.visualizacoes += 1
        eng.save()
    except Aluno.DoesNotExist:
        pass

    return render(request, 'feed/assistir_curso.html', {
        'curso': curso,
        'inscricao': inscricao,
    })


@login_required
@require_POST
def avaliar_curso(request, curso_id):
    # Guardar avaliação simples (pode ser expandido)
    messages.success(request, 'Avaliação registada! Obrigado.')
    return redirect('feed:assistir-curso', curso_id=curso_id)
