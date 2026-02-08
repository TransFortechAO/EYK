# Create your views here.
from django.shortcuts import render
from cursos.models import Cusro, Categoria
from videos.models import Video
from professores.models import Professor


@login_required
def feed_home(request):
    categorias = Categorias.objects.all()
    cursos = Curso.objects.filter(destaque=True)
    videos = Video.objects.filter(destaque=True)
    professores = Professor.objects.filter(destaque=True)


    context = {
        'categorias' = categorias,
        'cursos'= curso,
        'videos' = videos,
        'professores' = professores
    }

    return render(request, 'feed/home.html')