import pytest
from django.urls import reverse

from apps.accounts.models import Notificacao


@pytest.mark.django_db
class TestNotificacaoList:
    def test_exige_autenticacao(self, client):
        response = client.get(reverse("notificacao-list"))
        assert response.status_code == 403

    def test_lista_so_as_notificacoes_do_proprio_utilizador(self, client, aluno_user, professor_user):
        Notificacao.objects.create(utilizador=aluno_user, tipo="conquista", mensagem="Ganhaste um badge!")
        Notificacao.objects.create(utilizador=professor_user, tipo="novidade", mensagem="Não é para ti.")

        client.force_login(aluno_user)
        response = client.get(reverse("notificacao-list"))
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["type"] == "gamification"
        assert body[0]["title"] == "Ganhaste um badge!"
        assert body[0]["read"] is False

    def test_mapeia_tipos_para_o_frontend(self, client, aluno_user):
        Notificacao.objects.create(utilizador=aluno_user, tipo="lancamento", mensagem="Novo curso!")
        Notificacao.objects.create(utilizador=aluno_user, tipo="saque", mensagem="Saque processado.")
        client.force_login(aluno_user)

        response = client.get(reverse("notificacao-list"))
        tipos = {n["title"]: n["type"] for n in response.json()}
        assert tipos["Novo curso!"] == "course"
        assert tipos["Saque processado."] == "system"


@pytest.mark.django_db
class TestNotificacaoMarcarLida:
    def test_exige_autenticacao(self, client, aluno_user):
        n = Notificacao.objects.create(utilizador=aluno_user, tipo="novidade", mensagem="x")
        response = client.post(reverse("notificacao-marcar-lida", args=[n.id]))
        assert response.status_code == 403

    def test_marca_como_lida(self, client, aluno_user):
        n = Notificacao.objects.create(utilizador=aluno_user, tipo="novidade", mensagem="x")
        client.force_login(aluno_user)

        response = client.post(reverse("notificacao-marcar-lida", args=[n.id]))
        assert response.status_code == 200
        assert response.json() == {"ok": True, "read": True}
        n.refresh_from_db()
        assert n.lida is True

    def test_nao_pode_marcar_notificacao_de_outro_utilizador(self, client, aluno_user, professor_user):
        n = Notificacao.objects.create(utilizador=professor_user, tipo="novidade", mensagem="x")
        client.force_login(aluno_user)

        response = client.post(reverse("notificacao-marcar-lida", args=[n.id]))
        assert response.status_code == 404
        n.refresh_from_db()
        assert n.lida is False
