"""Escolas no servidor: a equipa cria, o responsável recebe o email e fica administrador."""
import datetime
import json

import pytest
from django.core import mail
from django.urls import reverse
from django.utils import timezone

from apps.accounts.models import User
from apps.instituicoes.models import ConviteInstituicao, Instituicao, MembroInstituicao

EMAIL = "diretora@escola.ao"


@pytest.fixture
def staff(db):
    return User.objects.create_user(username="equipa", password="SenhaForte123!", is_staff=True, email="eq@eyk.ao")


@pytest.fixture
def responsavel(db):
    return User.objects.create_user(username="diretora", password="SenhaForte123!", email="Diretora@Escola.ao")


def _criar(client, staff, **extra):
    client.force_login(staff)
    corpo = {
        "nome": "Escola 123", "tipo": "escola", "provincia": "Luanda",
        "responsavelNome": "Ana Domingos", "responsavelEmail": EMAIL, **extra,
    }
    r = client.post(reverse("instituicoes-admin"), data=json.dumps(corpo), content_type="application/json")
    client.logout()
    return r


def _codigo():
    return ConviteInstituicao.objects.latest("criado_em").codigo


@pytest.mark.django_db
class TestCriarEscola:
    def test_cria_e_envia_o_email_ao_responsavel(self, client, staff):
        r = _criar(client, staff)
        assert r.status_code == 201, r.content
        assert r.json()["estado"] == "preparacao"
        assert r.json()["emailEnviado"] is True
        assert len(mail.outbox) == 1
        email = mail.outbox[0]
        assert email.to == [EMAIL]
        assert f"/instituicao/aderir?codigo={_codigo()}" in email.body

    def test_email_invalido_nao_cria_nada(self, client, staff):
        assert _criar(client, staff, responsavelEmail="nao-e-email").status_code == 400
        assert not Instituicao.objects.exists()
        assert not mail.outbox

    def test_falha_do_email_nao_perde_a_escola_e_devolve_o_link(self, client, staff, monkeypatch):
        def falha(*a, **k):
            raise OSError("smtp em baixo")

        monkeypatch.setattr("apps.instituicoes.servicos.send_mail", falha)
        r = _criar(client, staff)
        assert r.status_code == 201
        assert r.json()["emailEnviado"] is False
        assert _codigo() in r.json()["convite"]["link"]

    def test_so_a_equipa_gere_escolas(self, client, responsavel):
        client.force_login(responsavel)
        assert client.get(reverse("instituicoes-admin")).status_code == 403
        r = client.post(reverse("instituicoes-admin"), data="{}", content_type="application/json")
        assert r.status_code == 403


@pytest.mark.django_db
class TestAceitarConvite:
    def test_responsavel_fica_administrador_e_a_escola_ativa(self, client, staff, responsavel):
        _criar(client, staff)
        codigo = _codigo()
        client.force_login(responsavel)
        assert client.get(reverse("instituicoes-convite", args=[codigo])).json()["papel"] == "administrador"
        r = client.post(reverse("instituicoes-convite-aceitar", args=[codigo]))
        assert r.status_code == 200, r.content
        assert MembroInstituicao.objects.get(utilizador=responsavel).papel == "administrador"
        assert Instituicao.objects.get().estado == "ativa"
        pertencas = client.get(reverse("instituicoes-minhas")).json()
        assert pertencas[0]["instituicao"]["nome"] == "Escola 123"
        assert pertencas[0]["membro"]["papel"] == "administrador"

    def test_codigo_em_minusculas_tambem_serve(self, client, staff, responsavel):
        _criar(client, staff)
        client.force_login(responsavel)
        assert client.get(reverse("instituicoes-convite", args=[_codigo().lower()])).status_code == 200

    def test_outra_conta_nao_aceita_nem_ve_a_escola(self, client, staff, aluno_user):
        _criar(client, staff)
        codigo = _codigo()
        client.force_login(aluno_user)
        consulta = client.get(reverse("instituicoes-convite", args=[codigo]))
        assert consulta.status_code == 403
        assert "Escola 123" not in consulta.content.decode()
        assert client.post(reverse("instituicoes-convite-aceitar", args=[codigo])).status_code == 403
        assert not MembroInstituicao.objects.exists()

    def test_nao_aceita_duas_vezes(self, client, staff, responsavel):
        _criar(client, staff)
        codigo = _codigo()
        client.force_login(responsavel)
        assert client.post(reverse("instituicoes-convite-aceitar", args=[codigo])).status_code == 200
        assert client.post(reverse("instituicoes-convite-aceitar", args=[codigo])).status_code == 400

    def test_convite_expirado(self, client, staff, responsavel):
        _criar(client, staff)
        ConviteInstituicao.objects.update(expira_em=timezone.now() - datetime.timedelta(days=1))
        client.force_login(responsavel)
        r = client.post(reverse("instituicoes-convite-aceitar", args=[_codigo()]))
        assert r.status_code == 400
        assert "expirou" in r.json()["detail"]

    def test_escola_suspensa_nao_aceita(self, client, staff, responsavel):
        _criar(client, staff)
        Instituicao.objects.update(estado="suspensa")
        client.force_login(responsavel)
        assert client.post(reverse("instituicoes-convite-aceitar", args=[_codigo()])).status_code == 400

    def test_codigo_inexistente(self, client, responsavel):
        client.force_login(responsavel)
        assert client.get(reverse("instituicoes-convite", args=["NAOEXISTE"])).status_code == 404

    def test_pertencas_exigem_sessao(self, client):
        assert client.get(reverse("instituicoes-minhas")).status_code == 403


@pytest.mark.django_db
class TestGerirEscola:
    def _id(self):
        return Instituicao.objects.get().id

    def test_reenviar_invalida_o_convite_anterior(self, client, staff, responsavel):
        _criar(client, staff)
        antigo = _codigo()
        client.force_login(staff)
        r = client.post(reverse("instituicoes-admin-reenviar", args=[self._id()]))
        assert r.status_code == 200, r.content
        assert len(mail.outbox) == 2
        novo = _codigo()
        assert novo != antigo
        client.force_login(responsavel)
        assert client.post(reverse("instituicoes-convite-aceitar", args=[antigo])).status_code == 400
        assert client.post(reverse("instituicoes-convite-aceitar", args=[novo])).status_code == 200

    def test_nao_reenvia_se_ja_ha_administrador(self, client, staff, responsavel):
        _criar(client, staff)
        client.force_login(responsavel)
        client.post(reverse("instituicoes-convite-aceitar", args=[_codigo()]))
        client.force_login(staff)
        assert client.post(reverse("instituicoes-admin-reenviar", args=[self._id()])).status_code == 400

    def test_suspender_tira_a_pertenca_e_encerrar_e_definitivo(self, client, staff, responsavel):
        _criar(client, staff)
        client.force_login(responsavel)
        client.post(reverse("instituicoes-convite-aceitar", args=[_codigo()]))
        client.force_login(staff)
        url = reverse("instituicoes-admin-detalhe", args=[self._id()])
        assert client.patch(url, data='{"estado":"suspensa"}', content_type="application/json").status_code == 200
        client.force_login(responsavel)
        assert client.get(reverse("instituicoes-minhas")).json() == []
        client.force_login(staff)
        assert client.patch(url, data='{"estado":"encerrada"}', content_type="application/json").status_code == 200
        assert client.patch(url, data='{"estado":"ativa"}', content_type="application/json").status_code == 400

    def test_quotas(self, client, staff):
        _criar(client, staff)
        client.force_login(staff)
        url = reverse("instituicoes-admin-detalhe", args=[self._id()])
        boas = json.dumps({"quotas": {"armazenamentoMb": 2048, "ficheiroMaxMb": 10, "utilizadoresMax": 30}})
        assert client.patch(url, data=boas, content_type="application/json").json()["quotas"]["utilizadoresMax"] == 30
        mas = json.dumps({"quotas": {"armazenamentoMb": 0, "ficheiroMaxMb": 10, "utilizadoresMax": 30}})
        assert client.patch(url, data=mas, content_type="application/json").status_code == 400
