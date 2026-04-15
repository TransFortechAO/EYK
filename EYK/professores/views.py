from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from cursos.models import Curso, Categoria, Inscricao, EngajamentoCurso
from cursos.forms import CursoForm
from .models import Professor


def get_professor_or_403(request):
    """Helper: devolve o Professor ligado ao utilizador ou None"""
    try:
        return Professor.objects.get(user=request.user)
    except Professor.DoesNotExist:
        return None


# ──────────────────────────────────────────
# PERFIL
# ──────────────────────────────────────────

@login_required
def perfil_professor(request):
    professor = get_professor_or_403(request)
    if not professor:
        messages.error(request, 'Perfil de professor não encontrado.')
        return redirect('accounts:login')

    return render(request, 'professores/perfil.html', {'professor': professor})


# ──────────────────────────────────────────
# CURSOS — LISTAR
# ──────────────────────────────────────────

@login_required
def meus_cursos(request):
    professor = get_professor_or_403(request)
    if not professor:
        messages.error(request, 'Perfil de professor não encontrado.')
        return redirect('accounts:login')

    cursos = Curso.objects.filter(professor=professor).order_by('-criado_em')

    # Agrega engajamento por curso
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
    })


# ──────────────────────────────────────────
# CURSOS — CRIAR
# ──────────────────────────────────────────

@login_required
def criar_curso(request):
    professor = get_professor_or_403(request)
    if not professor:
        messages.error(request, 'Perfil de professor não encontrado.')
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
        'form': form,
        'professor': professor,
        'acao': 'Criar',
    })


# ──────────────────────────────────────────
# CURSOS — EDITAR
# ──────────────────────────────────────────

@login_required
def editar_curso(request, curso_id):
    professor = get_professor_or_403(request)
    if not professor:
        messages.error(request, 'Perfil de professor não encontrado.')
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
        'form': form,
        'professor': professor,
        'curso': curso,
        'acao': 'Editar',
    })


# ──────────────────────────────────────────
# CURSOS — DELETAR
# ──────────────────────────────────────────

@login_required
def deletar_curso(request, curso_id):
    professor = get_professor_or_403(request)
    if not professor:
        messages.error(request, 'Perfil de professor não encontrado.')
        return redirect('accounts:login')

    curso = get_object_or_404(Curso, id=curso_id, professor=professor)

    if request.method == 'POST':
        titulo = curso.titulo
        curso.delete()
        messages.success(request, f'Curso "{titulo}" eliminado com sucesso.')
        return redirect('professores:meus-cursos')

    return render(request, 'professores/confirmar_deletar.html', {
        'curso': curso,
        'professor': professor,
    })


# ──────────────────────────────────────────
# CURSOS — ENGAJAMENTO (detalhe)
# ──────────────────────────────────────────

@login_required
def engajamento_curso(request, curso_id):
    professor = get_professor_or_403(request)
    if not professor:
        messages.error(request, 'Perfil de professor não encontrado.')
        return redirect('accounts:login')

    curso = get_object_or_404(Curso, id=curso_id, professor=professor)

    inscricoes = Inscricao.objects.filter(curso=curso).select_related('aluno__profile').order_by('-inscrito_em')
    engajamentos = EngajamentoCurso.objects.filter(curso=curso).select_related('aluno__profile')

    total_inscritos = inscricoes.count()
    total_visualizacoes = curso.total_visualizacoes()
    total_concluidos = inscricoes.filter(concluido=True).count()
    taxa_conclusao = round((total_concluidos / total_inscritos * 100), 1) if total_inscritos > 0 else 0

    return render(request, 'professores/engajamento_curso.html', {
        'curso': curso,
        'professor': professor,
        'inscricoes': inscricoes,
        'engajamentos': engajamentos,
        'total_inscritos': total_inscritos,
        'total_visualizacoes': total_visualizacoes,
        'total_concluidos': total_concluidos,
        'taxa_conclusao': taxa_conclusao,
    })
