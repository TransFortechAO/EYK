from datetime import timedelta

import pytest
from django.utils import timezone

from apps.gamificacao.models import Carteira, Ofensiva, TransacaoMoeda
from apps.gamificacao.services import creditar_moedas, registrar_atividade_diaria


@pytest.mark.django_db
class TestCreditarMoedas:
    def test_cria_carteira_se_nao_existir(self, aluno_user):
        creditar_moedas(aluno_user, 10, "login_diario")
        carteira = Carteira.objects.get(utilizador=aluno_user)
        assert carteira.saldo == 10

    def test_soma_ao_saldo_existente(self, aluno_user):
        Carteira.objects.create(utilizador=aluno_user, saldo=20)
        creditar_moedas(aluno_user, 5, "post_comunidade")
        carteira = Carteira.objects.get(utilizador=aluno_user)
        assert carteira.saldo == 25

    def test_saldo_nunca_fica_negativo(self, aluno_user):
        Carteira.objects.create(utilizador=aluno_user, saldo=3)
        creditar_moedas(aluno_user, -10, "ajuste_admin")
        carteira = Carteira.objects.get(utilizador=aluno_user)
        assert carteira.saldo == 0

    def test_regista_transacao_com_motivo(self, aluno_user):
        creditar_moedas(aluno_user, 5, "login_diario")
        transacao = TransacaoMoeda.objects.get(utilizador=aluno_user)
        assert transacao.valor == 5
        assert transacao.motivo == "login_diario"


@pytest.mark.django_db
class TestRegistrarAtividadeDiaria:
    def test_primeira_atividade_cria_ofensiva_com_um_dia(self, aluno_user):
        resultado = registrar_atividade_diaria(aluno_user)
        ofensiva = Ofensiva.objects.get(utilizador=aluno_user)

        assert resultado is True
        assert ofensiva.dias_atual == 1
        assert ofensiva.maior_sequencia == 1
        assert ofensiva.ultima_atividade == timezone.localdate()

    def test_segunda_chamada_no_mesmo_dia_nao_repete_bonus(self, aluno_user):
        registrar_atividade_diaria(aluno_user)
        resultado = registrar_atividade_diaria(aluno_user)

        assert resultado is False
        assert Ofensiva.objects.get(utilizador=aluno_user).dias_atual == 1

    def test_atividade_no_dia_seguinte_incrementa_sequencia(self, aluno_user):
        ontem = timezone.localdate() - timedelta(days=1)
        Ofensiva.objects.create(utilizador=aluno_user, dias_atual=3, maior_sequencia=3, ultima_atividade=ontem)

        resultado = registrar_atividade_diaria(aluno_user)
        ofensiva = Ofensiva.objects.get(utilizador=aluno_user)

        assert resultado is True
        assert ofensiva.dias_atual == 4
        assert ofensiva.maior_sequencia == 4

    def test_falha_de_um_dia_reinicia_sequencia(self, aluno_user):
        ha_tres_dias = timezone.localdate() - timedelta(days=3)
        Ofensiva.objects.create(utilizador=aluno_user, dias_atual=5, maior_sequencia=5, ultima_atividade=ha_tres_dias)

        registrar_atividade_diaria(aluno_user)
        ofensiva = Ofensiva.objects.get(utilizador=aluno_user)

        assert ofensiva.dias_atual == 1
        assert ofensiva.maior_sequencia == 5  # recorde mantém-se

    def test_maior_sequencia_so_atualiza_quando_ultrapassada(self, aluno_user):
        ontem = timezone.localdate() - timedelta(days=1)
        Ofensiva.objects.create(utilizador=aluno_user, dias_atual=2, maior_sequencia=10, ultima_atividade=ontem)

        registrar_atividade_diaria(aluno_user)
        ofensiva = Ofensiva.objects.get(utilizador=aluno_user)

        assert ofensiva.dias_atual == 3
        assert ofensiva.maior_sequencia == 10
