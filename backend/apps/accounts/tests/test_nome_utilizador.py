"""Registo só com o nome: o sistema cria o nome de utilizador e sugere outros quando já existe."""
import json

import pytest
from django.urls import reverse

from apps.accounts.models import User
from apps.accounts.nomes_utilizador import sugestoes


def _registar(client, **dados):
    corpo = {"email": "nova@example.com", "password": "SenhaForte123!", **dados}
    return client.post(reverse("accounts:auth-register-json"), data=json.dumps(corpo), content_type="application/json")


@pytest.mark.django_db
class TestNomeUtilizador:
    def test_sem_acentos_nem_particulas(self):
        assert sugestoes("João da Silva", 1) == ["joao.silva"]

    def test_nome_ocupado_da_outras_opcoes(self):
        User.objects.create_user(username="joao.silva", password="x")
        lista = sugestoes("João Silva", 4)
        assert "joao.silva" not in lista
        assert len(lista) == 4
        assert len(set(lista)) == 4

    def test_um_so_nome_recebe_numero_quando_ocupado(self):
        User.objects.create_user(username="ana", password="x")
        assert sugestoes("Ana", 1) == ["ana1"]

    def test_nao_propoe_nomes_reservados(self):
        assert "admin" not in sugestoes("Admin", 3)

    def test_endpoint_propoe_a_partir_do_nome(self, client):
        r = client.get(reverse("accounts:auth-nome-utilizador"), {"nome": "Maria Costa"}).json()
        assert r["username"] == "maria.costa"
        assert r["disponivel"] is True
        assert r["nome_ocupado"] is False

    def test_endpoint_avisa_quando_o_nome_ja_existe(self, client):
        User.objects.create_user(username="maria.costa", password="x")
        r = client.get(reverse("accounts:auth-nome-utilizador"), {"nome": "Maria Costa"}).json()
        assert r["nome_ocupado"] is True
        assert r["username"] != "maria.costa"

    def test_endpoint_diz_que_esta_ocupado_e_sugere(self, client):
        User.objects.create_user(username="maria.costa", password="x")
        r = client.get(reverse("accounts:auth-nome-utilizador"), {"nome": "Maria Costa", "username": "Maria.Costa"}).json()
        assert r["disponivel"] is False
        assert r["sugestoes"]


@pytest.mark.django_db
class TestRegistoSoComNome:
    def test_cria_a_conta_com_nome_e_username(self, client):
        r = _registar(client, nome="Ana Maria Silva")
        assert r.status_code == 200, r.content
        user = User.objects.get(email="nova@example.com")
        assert user.username == "ana.silva"
        assert user.first_name == "Ana"
        assert user.last_name == "Maria Silva"

    def test_mesmo_nome_gera_outro_username(self, client):
        User.objects.create_user(username="ana.silva", password="x")
        assert _registar(client, nome="Ana Silva").status_code == 200
        assert User.objects.get(email="nova@example.com").username != "ana.silva"

    def test_username_escolhido_ocupado_devolve_sugestoes(self, client):
        User.objects.create_user(username="ana.silva", password="x")
        r = _registar(client, nome="Ana Silva", username="ANA.SILVA")
        assert r.status_code == 400
        assert r.json()["codigo"] == "username_ocupado"
        assert r.json()["sugestoes"]
