from django.contrib.auth.decorators import login_required
from django.shortcuts import render

from .models import Carteira, Ofensiva, TransacaoMoeda


@login_required
def painel(request):
    carteira, _ = Carteira.objects.get_or_create(utilizador=request.user)
    ofensiva, _ = Ofensiva.objects.get_or_create(utilizador=request.user)
    transacoes = TransacaoMoeda.objects.filter(utilizador=request.user)[:20]
    return render(request, 'gamificacao/painel.html', {
        'carteira': carteira,
        'ofensiva': ofensiva,
        'transacoes': transacoes,
    })


@login_required
def leaderboard(request):
    top_carteiras = Carteira.objects.select_related('utilizador').order_by('-saldo')[:20]
    return render(request, 'gamificacao/leaderboard.html', {
        'top_carteiras': top_carteiras,
    })
