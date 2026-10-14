from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.gamificacao.models import AlunoBadge, Badge, Carteira, Ofensiva, TransacaoMoeda


@pytest.mark.django_db
class TestGamificacaoPainel:
    def test_exige_autenticacao(self, client):
        response = client.get(reverse("gamificacao-painel"))
        assert response.status_code == 403

    def test_sem_carteira_nem_ofensiva_devolve_zeros(self, client, aluno_user):
        client.force_login(aluno_user)
        response = client.get(reverse("gamificacao-painel"))
        assert response.status_code == 200
        body = response.json()
        assert body["coins"] == 0
        assert body["xp"] == 0
        assert body["streak"] == 0
        assert body["level"] == 1

    def test_com_carteira_e_ofensiva_devolve_dados_reais(self, client, aluno_user):
        Carteira.objects.create(utilizador=aluno_user, saldo=500, xp=1200)
        Ofensiva.objects.create(utilizador=aluno_user, dias_atual=5, maior_sequencia=12)
        client.force_login(aluno_user)

        response = client.get(reverse("gamificacao-painel"))
        body = response.json()
        assert body["coins"] == 500
        assert body["xp"] == 1200
        assert body["streak"] == 5
        assert body["streakRecord"] == 12
        assert body["level"] == 2  # 500*2*1 = 1000 <= 1200


@pytest.mark.django_db
class TestLeaderboardList:
    def test_exige_autenticacao(self, client):
        response = client.get(reverse("leaderboard-list"))
        assert response.status_code == 403

    def test_ordena_por_saldo_decrescente_e_marca_isme(self, client, aluno_user, professor_user):
        Carteira.objects.create(utilizador=aluno_user, saldo=100)
        Carteira.objects.create(utilizador=professor_user, saldo=300)
        client.force_login(aluno_user)

        response = client.get(reverse("leaderboard-list"))
        assert response.status_code == 200
        body = response.json()
        assert body[0]["userId"] == professor_user.id
        assert body[0]["coins"] == 300
        assert body[1]["userId"] == aluno_user.id
        assert body[1]["isMe"] is True
        assert body[0]["isMe"] is False

    def test_utilizador_sem_carteira_aparece_com_zero(self, client, aluno_user):
        client.force_login(aluno_user)
        response = client.get(reverse("leaderboard-list"))
        linha = next(r for r in response.json() if r["userId"] == aluno_user.id)
        assert linha["coins"] == 0


@pytest.mark.django_db
class TestBadgesList:
    def test_exige_autenticacao(self, client):
        response = client.get(reverse("badges-list"))
        assert response.status_code == 403

    def test_badge_desbloqueado_aparece_com_100_porcento(self, client, aluno_user):
        badge = Badge.objects.create(slug="primeira-aula", nome="Primeira Aula", descricao="x", icone="Play")
        AlunoBadge.objects.create(utilizador=aluno_user, badge=badge)
        client.force_login(aluno_user)

        response = client.get(reverse("badges-list"))
        assert response.status_code == 200
        item = next(b for b in response.json() if b["id"] == "primeira-aula")
        assert item["earned"] is True
        assert item["progress"] == 100

    def test_badge_nao_desbloqueado_mostra_progresso_parcial(self, client, aluno_user):
        Badge.objects.create(slug="cinefilo", nome="Cinéfilo", descricao="x", icone="Film")
        client.force_login(aluno_user)

        response = client.get(reverse("badges-list"))
        item = next(b for b in response.json() if b["id"] == "cinefilo")
        assert item["earned"] is False
        assert item["progress"] == 0


@pytest.mark.django_db
class TestCarteiraHistorico:
    def test_exige_autenticacao(self, client):
        response = client.get(reverse("carteira-historico"))
        assert response.status_code == 403

    def test_lista_so_as_transacoes_do_proprio_utilizador(self, client, aluno_user, professor_user):
        TransacaoMoeda.objects.create(utilizador=aluno_user, valor=100, motivo="curso_concluido")
        TransacaoMoeda.objects.create(utilizador=professor_user, valor=30, motivo="views_professor")
        client.force_login(aluno_user)

        response = client.get(reverse("carteira-historico"))
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["delta"] == 100
        assert body[0]["label"] == "Curso concluído"


@pytest.mark.django_db
class TestLeaderboardProfessoresMensal:
    def test_exige_autenticacao(self, client):
        response = client.get(reverse("leaderboard-professores-mensal"))
        assert response.status_code == 403

    def test_soma_so_views_professor_do_mes_atual(self, client, professor_user, aluno_user):
        agora = timezone.now()
        TransacaoMoeda.objects.create(utilizador=professor_user, valor=30, motivo="views_professor", criado_em=agora)
        TransacaoMoeda.objects.create(utilizador=professor_user, valor=30, motivo="views_professor", criado_em=agora)
        # Fora do âmbito: motivo diferente, e um registo do mês passado.
        TransacaoMoeda.objects.create(utilizador=professor_user, valor=100, motivo="curso_concluido", criado_em=agora)
        mes_passado = agora.replace(day=1) - timedelta(days=5)
        t_antiga = TransacaoMoeda.objects.create(
            utilizador=professor_user, valor=999, motivo="views_professor", criado_em=agora,
        )
        TransacaoMoeda.objects.filter(id=t_antiga.id).update(criado_em=mes_passado)

        client.force_login(aluno_user)
        response = client.get(reverse("leaderboard-professores-mensal"))
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["userId"] == professor_user.id
        assert body[0]["coins"] == 60

    def test_aluno_sem_views_professor_nao_aparece(self, client, aluno_user):
        TransacaoMoeda.objects.create(utilizador=aluno_user, valor=100, motivo="curso_concluido")
        client.force_login(aluno_user)
        response = client.get(reverse("leaderboard-professores-mensal"))
        assert response.json() == []
