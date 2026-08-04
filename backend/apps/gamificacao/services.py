from django.utils import timezone

from .models import Carteira, Ofensiva, TransacaoMoeda


def creditar_moedas(user, valor, motivo):
    """Credita (ou debita, se valor negativo) moedas na carteira do utilizador."""
    carteira, _ = Carteira.objects.get_or_create(utilizador=user)
    carteira.saldo = max(0, carteira.saldo + valor)
    carteira.save()
    TransacaoMoeda.objects.create(utilizador=user, valor=valor, motivo=motivo)
    return carteira


def registrar_atividade_diaria(user):
    """Actualiza a ofensiva (streak) do utilizador com base na actividade de hoje.

    Devolve True se esta foi a primeira actividade registada hoje (para o
    chamador decidir se atribui bónus de moedas), False se já tinha sido
    registada anteriormente hoje.
    """
    hoje = timezone.localdate()
    ofensiva, criada = Ofensiva.objects.get_or_create(utilizador=user)

    if ofensiva.ultima_atividade == hoje:
        return False

    if ofensiva.ultima_atividade == hoje - timezone.timedelta(days=1):
        ofensiva.dias_atual += 1
    else:
        ofensiva.dias_atual = 1

    ofensiva.maior_sequencia = max(ofensiva.maior_sequencia, ofensiva.dias_atual)
    ofensiva.ultima_atividade = hoje
    ofensiva.save()
    return True
