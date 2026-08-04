from django.contrib import messages
from django.conf import settings
from django.contrib.auth import logout
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render

from apps.accounts.forms import AlunoPerfilForm

from .models import Aluno


def redirect_next(path="/"):
    """Redireciona para uma rota do frontend Next.js (NEXT_PUBLIC_URL)."""
    base = settings.NEXT_PUBLIC_URL.rstrip("/")
    if not path.startswith("/"):
        path = "/" + path
    return redirect(base + path)


@login_required
def configuracoes_aluno(request):
    aluno, _ = Aluno.objects.get_or_create(profile=request.user)
    if request.method == 'POST':
        form = AlunoPerfilForm(request.POST, request.FILES, instance=aluno)
        if form.is_valid():
            form.save()
            messages.success(request, 'Perfil actualizado com sucesso!')
            return redirect_next('/configuracoes')
    else:
        form = AlunoPerfilForm(instance=aluno)
    from django_otp.plugins.otp_totp.models import TOTPDevice
    tem_2fa = TOTPDevice.objects.filter(user=request.user, confirmed=True).exists()
    return render(request, 'alunos/configuracoes.html', {'form': form, 'aluno': aluno, 'tem_2fa': tem_2fa})


@login_required
def apagar_conta_aluno(request):
    if request.method == 'POST':
        user = request.user
        logout(request)
        user.delete()
        messages.success(request, 'Conta eliminada com sucesso.')
        return redirect('index')
    return render(request, 'alunos/confirmar_apagar_conta.html')
