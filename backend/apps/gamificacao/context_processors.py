from .models import Carteira, Ofensiva


def gamificacao_context(request):
    if not request.user.is_authenticated:
        return {}
    carteira = Carteira.objects.filter(utilizador=request.user).first()
    ofensiva = Ofensiva.objects.filter(utilizador=request.user).first()
    return {
        'minha_carteira': carteira,
        'minha_ofensiva': ofensiva,
    }
