from datetime import timedelta

import pytest
from django.utils import timezone

from apps.gamificacao.models import Carteira, Ofensiva, TransacaoMoeda


@pytest.mark.django_db
class TestCarteiraModel:
    def test_saldo_comeca_em_zero(self, aluno_user):
        carteira = Carteira.objects.create(utilizador=aluno_user)
        assert carteira.saldo == 0

    def test_str_inclui_username_e_saldo(self, aluno_user):
        carteira = Carteira.objects.create(utilizador=aluno_user, saldo=100)
        assert str(carteira) == "aluno1 — 100 moedas, 0 XP"


@pytest.mark.django_db
class TestTransacaoMoedaModel:
    def test_str_formata_valor_com_sinal(self, aluno_user):
        transacao = TransacaoMoeda.objects.create(
            utilizador=aluno_user, valor=5, motivo="ajuste_admin",
        )
        assert str(transacao) == "aluno1 +5 (ajuste_admin)"

    def test_ordering_mais_recente_primeiro(self, aluno_user):
        primeira = TransacaoMoeda.objects.create(utilizador=aluno_user, valor=5, motivo="ajuste_admin")
        TransacaoMoeda.objects.filter(pk=primeira.pk).update(criado_em=timezone.now() - timedelta(minutes=1))
        segunda = TransacaoMoeda.objects.create(utilizador=aluno_user, valor=2, motivo="curso_concluido")
        assert list(TransacaoMoeda.objects.all()) == [segunda, primeira]


@pytest.mark.django_db
class TestOfensivaModel:
    def test_dias_atual_comeca_em_zero(self, aluno_user):
        ofensiva = Ofensiva.objects.create(utilizador=aluno_user)
        assert ofensiva.dias_atual == 0
        assert ofensiva.maior_sequencia == 0
        assert ofensiva.ultima_atividade is None
