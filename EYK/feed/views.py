# Create your views here.
from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from cursos.models import Curso, Categoria
from professores.models import Professor


@login_required
def feed_home(request):
    categorias = Categoria.objects.all()
    cursos = Curso.objects.filter(ativo=True)        # ✅ Corrigido: 'destaque' não existe → usa 'ativo'
    professores = Professor.objects.filter(ativo=True)  # ✅ Corrigido: 'destaque' não existe → usa 'ativo'

    context = {
        'categorias': categorias,
        'cursos': cursos,
        'professores': professores,
    }

    return render(request, 'feed/home.html', context)  # ✅ Corrigido: context não estava a ser passado