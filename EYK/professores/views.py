from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from cursos.models import Curso, Categoria, Inscricao, EngajamentoCurso
from cursos.forms import CursoForm
from .models import Professor, Video, ReacaoVideo, VisualizacaoVideo, Seguidor
from django import forms as django_forms


# ── Formulário de Vídeo ──────────────────────────────────────────────────────

class VideoForm(django_forms.ModelForm):
    class Meta:
        model = Video
        fields = ['titulo', 'descricao', 'arquivo', 'url_externa', 'thumbnail', 'ativo']
        widgets = {
            'titulo': django_forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Título do vídeo'}),
            'descricao': django_forms.Textarea(attrs={'class': 'form-control', 'rows': 3, 'placeholder': 'Descrição'}),
            'arquivo': django_forms.FileInput(attrs={'class': 'form-control'}),
            'url_externa': django_forms.URLInput(attrs={'class': 'form-control', 'placeholder': 'https://youtube.com/...'}),
            'thumbnail': django_forms.FileInput(attrs={'class': 'form-control'}),
            'ativo': django_forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }
        labels = {
            'titulo': 'Título',
            'descricao': 'Descrição',
            'arquivo': 'Ficheiro de Vídeo',
            'url_externa': 'Ou link externo (YouTube)',
            'thumbnail': 'Miniatura',
            'ativo': 'Publicar vídeo',
        }


# ── Helper ───────────────────────────────────────────────────────────────────

def get_professor_or_403(request):
    try:
        return Professor.objects.get(user=request.user)
    except Professor.DoesNotExist:
        return None


# ── PERFIL ───────────────────────────────────────────────────────────────────

@login_required
def perfil_professor(request):
    professor = get_professor_or_403(request)
    if not professor:
        messages.error(request, 'Perfil de professor não encontrado.')
        return redirect('accounts:login')
    return render(request, 'professores/perfil.html', {'professor': professor})


@login_required
def configuracoes_professor(request):
    professor = get_professor_or_403(request)
    if not professor:
        return redirect('accounts:login')
    from accounts.forms import ProfessorPerfilForm
    if request.method == 'POST':
        form = ProfessorPerfilForm(request.POST, request.FILES, instance=professor)
        if form.is_valid():
            form.save()
            messages.success(request, 'Perfil actualizado com sucesso!')
            return redirect('professores:configuracoes')
    else:
        form = ProfessorPerfilForm(instance=professor)
    return render(request, 'professores/configuracoes.html', {'form': form, 'professor': professor})


@login_required
def apagar_conta_professor(request):
    if request.method == 'POST':
        user = request.user
        from django.contrib.auth import logout
        logout(request)
        user.delete()
        messages.success(request, 'Conta eliminada com sucesso.')
        return redirect('index')
    return render(request, 'professores/confirmar_apagar_conta.html')


# ── CURSOS — LISTAR ──────────────────────────────────────────────────────────

@login_required
def meus_cursos(request):
    professor = get_professor_or_403(request)
    if not professor:
        messages.error(request, 'Perfil de professor não encontrado.')
        return redirect('accounts:login')

    cursos = Curso.objects.filter(professor=professor).order_by('-criado_em')
    cursos_data = []
    for curso in cursos:
        cursos_data.append({
            'curso': curso,
            'inscritos': curso.total_inscritos(),
            'visualizacoes': curso.total_visualizacoes(),
        })

    return render(request, 'professores/meus_cursos.html', {
        'cursos_data': cursos_data,
        'professor': professor,
        'total_inscritos': sum(item['inscritos'] for item in cursos_data),
    })


# ── CURSOS — CRIAR / EDITAR / DELETAR / ENGAJAMENTO ─────────────────────────

@login_required
def criar_curso(request):
    professor = get_professor_or_403(request)
    if not professor:
        return redirect('accounts:login')

    if request.method == 'POST':
        form = CursoForm(request.POST, request.FILES)
        if form.is_valid():
            curso = form.save(commit=False)
            curso.professor = professor
            curso.save()
            messages.success(request, f'Curso "{curso.titulo}" criado com sucesso!')
            return redirect('professores:meus-cursos')
    else:
        form = CursoForm()

    return render(request, 'professores/criar_curso.html', {
        'form': form, 'professor': professor, 'acao': 'Criar',
    })


@login_required
def editar_curso(request, curso_id):
    professor = get_professor_or_403(request)
    if not professor:
        return redirect('accounts:login')

    curso = get_object_or_404(Curso, id=curso_id, professor=professor)
    if request.method == 'POST':
        form = CursoForm(request.POST, request.FILES, instance=curso)
        if form.is_valid():
            form.save()
            messages.success(request, f'Curso "{curso.titulo}" actualizado com sucesso!')
            return redirect('professores:meus-cursos')
    else:
        form = CursoForm(instance=curso)

    return render(request, 'professores/criar_curso.html', {
        'form': form, 'professor': professor, 'curso': curso, 'acao': 'Editar',
    })


@login_required
def deletar_curso(request, curso_id):
    professor = get_professor_or_403(request)
    if not professor:
        return redirect('accounts:login')

    curso = get_object_or_404(Curso, id=curso_id, professor=professor)
    if request.method == 'POST':
        titulo = curso.titulo
        curso.delete()
        messages.success(request, f'Curso "{titulo}" eliminado com sucesso.')
        return redirect('professores:meus-cursos')

    return render(request, 'professores/confirmar_deletar.html', {
        'objeto': curso, 'tipo': 'curso', 'professor': professor,
        'url_cancelar': 'professores:meus-cursos',
    })


@login_required
def engajamento_curso(request, curso_id):
    professor = get_professor_or_403(request)
    if not professor:
        return redirect('accounts:login')

    curso = get_object_or_404(Curso, id=curso_id, professor=professor)
    inscricoes = Inscricao.objects.filter(curso=curso).select_related('aluno__profile').order_by('-inscrito_em')
    total_inscritos = inscricoes.count()
    total_visualizacoes = curso.total_visualizacoes()
    total_concluidos = inscricoes.filter(concluido=True).count()
    taxa_conclusao = round((total_concluidos / total_inscritos * 100), 1) if total_inscritos > 0 else 0

    return render(request, 'professores/engajamento_curso.html', {
        'curso': curso,
        'professor': professor,
        'inscricoes': inscricoes,
        'total_inscritos': total_inscritos,
        'total_visualizacoes': total_visualizacoes,
        'total_concluidos': total_concluidos,
        'taxa_conclusao': taxa_conclusao,
    })


# ── VÍDEOS ───────────────────────────────────────────────────────────────────

@login_required
def meus_videos(request):
    professor = get_professor_or_403(request)
    if not professor:
        return redirect('accounts:login')

    videos = Video.objects.filter(professor=professor)
    videos_data = []
    for video in videos:
        videos_data.append({
            'video': video,
            'likes': video.total_likes(),
            'visualizacoes': video.total_visualizacoes(),
        })

    return render(request, 'professores/meus_videos.html', {
        'videos_data': videos_data,
        'professor': professor,
    })


@login_required
@require_POST
def reordenar_videos(request):
    professor = get_professor_or_403(request)
    if not professor:
        return JsonResponse({'erro': 'Perfil de professor não encontrado.'}, status=403)

    ids = request.POST.getlist('ordem[]')
    videos_por_id = {v.id: v for v in Video.objects.filter(professor=professor, id__in=ids)}
    for posicao, video_id in enumerate(ids):
        video = videos_por_id.get(int(video_id))
        if video:
            video.ordem = posicao
            video.save(update_fields=['ordem'])

    return JsonResponse({'ok': True})


@login_required
def upload_video(request):
    professor = get_professor_or_403(request)
    if not professor:
        return redirect('accounts:login')

    if request.method == 'POST':
        form = VideoForm(request.POST, request.FILES)
        if form.is_valid():
            video = form.save(commit=False)
            video.professor = professor
            video.save()
            messages.success(request, f'Vídeo "{video.titulo}" publicado com sucesso!')
            return redirect('professores:meus-videos')
    else:
        form = VideoForm()

    return render(request, 'professores/criar_video.html', {
        'form': form, 'professor': professor, 'acao': 'Publicar',
    })


@login_required
def editar_video(request, video_id):
    professor = get_professor_or_403(request)
    if not professor:
        return redirect('accounts:login')

    video = get_object_or_404(Video, id=video_id, professor=professor)
    if request.method == 'POST':
        form = VideoForm(request.POST, request.FILES, instance=video)
        if form.is_valid():
            form.save()
            messages.success(request, f'Vídeo "{video.titulo}" actualizado.')
            return redirect('professores:meus-videos')
    else:
        form = VideoForm(instance=video)

    return render(request, 'professores/criar_video.html', {
        'form': form, 'professor': professor, 'video': video, 'acao': 'Editar',
    })


@login_required
def deletar_video(request, video_id):
    professor = get_professor_or_403(request)
    if not professor:
        return redirect('accounts:login')

    video = get_object_or_404(Video, id=video_id, professor=professor)
    if request.method == 'POST':
        titulo = video.titulo
        video.delete()
        messages.success(request, f'Vídeo "{titulo}" eliminado.')
        return redirect('professores:meus-videos')

    return render(request, 'professores/confirmar_deletar.html', {
        'objeto': video, 'tipo': 'vídeo', 'professor': professor,
        'url_cancelar': 'professores:meus-videos',
    })


@login_required
def engajamento_video(request, video_id):
    professor = get_professor_or_403(request)
    if not professor:
        return redirect('accounts:login')

    video = get_object_or_404(Video, id=video_id, professor=professor)
    reacoes = ReacaoVideo.objects.filter(video=video).select_related('utilizador')
    total_likes = video.total_likes()
    total_dislikes = reacoes.filter(tipo='dislike').count()
    total_visualizacoes = video.total_visualizacoes()

    return render(request, 'professores/engajamento_video.html', {
        'video': video,
        'professor': professor,
        'reacoes': reacoes,
        'total_likes': total_likes,
        'total_dislikes': total_dislikes,
        'total_visualizacoes': total_visualizacoes,
    })


@login_required
@require_POST
def reagir_video(request, video_id):
    video = get_object_or_404(Video, id=video_id)
    tipo = request.POST.get('tipo', 'like')
    reacao, created = ReacaoVideo.objects.get_or_create(
        video=video, utilizador=request.user,
        defaults={'tipo': tipo}
    )
    if not created:
        if reacao.tipo == tipo:
            reacao.delete()  # toggle off
        else:
            reacao.tipo = tipo
            reacao.save()

    # Registar visualização
    VisualizacaoVideo.objects.get_or_create(video=video, utilizador=request.user)

    return JsonResponse({
        'likes': video.total_likes(),
        'dislikes': ReacaoVideo.objects.filter(video=video, tipo='dislike').count(),
    })


# ── SEGUIR ───────────────────────────────────────────────────────────────────

@login_required
@require_POST
def toggle_seguir(request, professor_id):
    professor = get_object_or_404(Professor, id=professor_id)
    seguidor, created = Seguidor.objects.get_or_create(utilizador=request.user, professor=professor)
    if not created:
        seguidor.delete()
        messages.info(request, f'Deixaste de seguir {professor.nome_publico}.')
    else:
        messages.success(request, f'Agora segues {professor.nome_publico}!')
    return redirect('feed:home')
