from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.contrib.auth import logout
from .models import Aluno
from accounts.forms import AlunoPerfilForm


@login_required
def configuracoes_aluno(request):
    aluno, _ = Aluno.objects.get_or_create(profile=request.user)
    if request.method == 'POST':
        form = AlunoPerfilForm(request.POST, request.FILES, instance=aluno)
        if form.is_valid():
            form.save()
            messages.success(request, 'Perfil actualizado com sucesso!')
            return redirect('alunos:configuracoes')
    else:
        form = AlunoPerfilForm(instance=aluno)
    return render(request, 'alunos/configuracoes.html', {'form': form, 'aluno': aluno})


@login_required
def apagar_conta_aluno(request):
    if request.method == 'POST':
        user = request.user
        logout(request)
        user.delete()
        messages.success(request, 'Conta eliminada com sucesso.')
        return redirect('index')
    return render(request, 'alunos/confirmar_apagar_conta.html')
