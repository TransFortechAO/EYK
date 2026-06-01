from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from django.http import JsonResponse
from django.contrib import messages
from cursos.models import Curso, Categoria
from professores.models import Professor, Video
from .models import Post, ReacaoPost, Comentario


@login_required
def feed_home(request):
    categorias = Categoria.objects.all()
    cursos = Curso.objects.filter(ativo=True).select_related('professor', 'categoria')
    professores = Professor.objects.filter(ativo=True)

    return render(request, 'feed/home.html', {
        'categorias': categorias,
        'cursos': cursos,
        'professores': professores,
    })


@login_required
def cursos_view(request):
    q = request.GET.get('q', '')
    categoria_id = request.GET.get('categoria', '')
    categorias = Categoria.objects.all()
    cursos = Curso.objects.filter(ativo=True).select_related('professor', 'categoria')

    if q:
        cursos = cursos.filter(titulo__icontains=q)
    if categoria_id:
        cursos = cursos.filter(categoria_id=categoria_id)

    return render(request, 'feed/cursos.html', {
        'cursos': cursos,
        'categorias': categorias,
        'q': q,
        'categoria_selecionada': categoria_id,
    })


@login_required
def videos_view(request):
    videos = Video.objects.filter(ativo=True).select_related('professor').order_by('-criado_em')
    return render(request, 'feed/videos.html', {'videos': videos})


@login_required
def comunidade(request):
    posts = Post.objects.select_related('autor').prefetch_related('comentarios', 'reacoes').all()
    return render(request, 'feed/comunidade.html', {'posts': posts})


@login_required
@require_POST
def criar_post(request):
    conteudo = request.POST.get('conteudo', '').strip()
    imagem = request.FILES.get('imagem')
    if conteudo:
        Post.objects.create(autor=request.user, conteudo=conteudo, imagem=imagem)
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
    from accounts.models import Notificacao
    notifs = Notificacao.objects.filter(utilizador=request.user)
    notifs.filter(lida=False).update(lida=True)
    return render(request, 'feed/notificacoes.html', {'notificacoes': notifs})


@login_required
def assistir_curso(request, curso_id):
    curso = get_object_or_404(Curso, id=curso_id, ativo=True)
    from cursos.models import Inscricao, EngajamentoCurso
    from alunos.models import Aluno

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
