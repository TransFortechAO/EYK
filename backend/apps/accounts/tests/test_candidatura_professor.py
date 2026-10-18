import re
from urllib.parse import unquote

import pytest
from django.core import mail
from django.urls import reverse

from apps.accounts.emails import gerar_token_candidatura
from apps.accounts.models import User
from apps.professores.models import CandidaturaProfessor, Professor

DADOS = {
    "nome": "Ana Silva",
    "email": "ana.silva@exemplo.com",
    "telefone": "923000000",
    "area": "Língua gestual",
    "apresentacao": "Intérprete há 10 anos.",
}
SENHA = "UmaSenhaForte2026!"


def _post(client, nome_url, dados):
    return client.post(reverse(nome_url), data=dados, content_type="application/json")


def _token_do_email():
    corpo = mail.outbox[-1].body
    # O link leva o token codificado na URL; o frontend recebe-o já descodificado.
    return unquote(re.search(r"token=([^\s]+)", corpo).group(1))


@pytest.mark.django_db
class TestFluxoCompleto:
    def test_candidatura_confirmacao_e_conta_criada_sem_intervencao(self, client):
        r = _post(client, "accounts:candidatura-enviar", DADOS)
        assert r.status_code == 200 and r.json()["ok"] is True
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == [DADOS["email"]]
        # Ainda não há conta: só depois de confirmar o email.
        assert not User.objects.filter(email=DADOS["email"]).exists()

        token = _token_do_email()
        r = _post(client, "accounts:candidatura-validar", {"token": token})
        assert r.status_code == 200
        assert r.json()["nome"] == "Ana Silva"

        r = _post(client, "accounts:candidatura-concluir", {"token": token, "password": SENHA})
        assert r.status_code == 200
        corpo = r.json()
        assert corpo["ok"] is True and corpo["user"]["isTeacher"] is True

        user = User.objects.get(email=DADOS["email"])
        assert user.is_teacher and user.email_verificado
        assert user.username == "ana_silva"
        assert user.check_password(SENHA)
        prof = Professor.objects.get(user=user)
        assert prof.nome_publico == "Ana Silva"
        assert prof.area == "Língua gestual"
        assert prof.bio == "Intérprete há 10 anos."
        assert CandidaturaProfessor.objects.get(email=DADOS["email"]).concluida_em is not None

        # Sessão iniciada: já vê a própria conta.
        me = client.get(reverse("accounts:auth-me")).json()
        assert me["authenticated"] is True and me["user"]["email"] == DADOS["email"]

    def test_link_so_pode_ser_usado_uma_vez(self, client):
        _post(client, "accounts:candidatura-enviar", DADOS)
        token = _token_do_email()
        assert _post(client, "accounts:candidatura-concluir", {"token": token, "password": SENHA}).status_code == 200
        assert _post(client, "accounts:candidatura-validar", {"token": token}).status_code == 400
        assert _post(client, "accounts:candidatura-concluir", {"token": token, "password": SENHA}).status_code == 400
        assert User.objects.filter(email=DADOS["email"]).count() == 1

    def test_reenvio_atualiza_a_mesma_candidatura(self, client):
        _post(client, "accounts:candidatura-enviar", DADOS)
        _post(client, "accounts:candidatura-enviar", {**DADOS, "area": "Matemática"})
        assert CandidaturaProfessor.objects.count() == 1
        assert CandidaturaProfessor.objects.get().area == "Matemática"
        assert len(mail.outbox) == 2


@pytest.mark.django_db
class TestValidacoes:
    def test_campos_obrigatorios_e_email_invalido(self, client):
        r = _post(client, "accounts:candidatura-enviar", {"nome": "A", "email": "nao-e-email"})
        assert r.status_code == 400
        erros = r.json()["errors"]
        assert "nome" in erros and "email" in erros
        assert len(mail.outbox) == 0

    def test_email_de_conta_existente_e_recusado(self, client):
        User.objects.create_user(username="ja", email=DADOS["email"], password="x12345678")
        r = _post(client, "accounts:candidatura-enviar", DADOS)
        assert r.status_code == 400
        assert not CandidaturaProfessor.objects.exists()

    def test_area_telefone_e_apresentacao_sao_opcionais(self, client):
        r = _post(client, "accounts:candidatura-enviar", {"nome": "Rui Costa", "email": "rui@exemplo.com"})
        assert r.status_code == 200

    def test_token_invalido(self, client):
        assert _post(client, "accounts:candidatura-validar", {"token": "lixo"}).status_code == 400
        assert _post(client, "accounts:candidatura-concluir", {"token": "lixo", "password": SENHA}).status_code == 400

    def test_token_expirado(self, client, settings, monkeypatch):
        from apps.accounts import emails

        c = CandidaturaProfessor.objects.create(nome="Ana Silva", email=DADOS["email"])
        token = gerar_token_candidatura(c)
        monkeypatch.setattr(emails, "CANDIDATURA_VALIDADE_SEGUNDOS", -1)
        assert _post(client, "accounts:candidatura-validar", {"token": token}).status_code == 400

    def test_senha_fraca_nao_cria_conta(self, client, settings):
        # As configurações de teste desligam os validadores; aqui ligamos um.
        settings.AUTH_PASSWORD_VALIDATORS = [
            {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
        ]
        _post(client, "accounts:candidatura-enviar", DADOS)
        token = _token_do_email()
        r = _post(client, "accounts:candidatura-concluir", {"token": token, "password": "123"})
        assert r.status_code == 400
        assert not User.objects.filter(email=DADOS["email"]).exists()
        # O link continua válido para tentar outra vez.
        assert _post(client, "accounts:candidatura-validar", {"token": token}).status_code == 200

    def test_username_nao_colide_com_existente(self, client):
        User.objects.create_user(username="ana_silva", email="outra@exemplo.com", password="x12345678")
        _post(client, "accounts:candidatura-enviar", DADOS)
        token = _token_do_email()
        _post(client, "accounts:candidatura-concluir", {"token": token, "password": SENHA})
        assert User.objects.get(email=DADOS["email"]).username == "ana_silva2"

    def test_limite_de_pedidos_por_email(self, client):
        from django.core.cache import cache

        cache.clear()
        codigos = [_post(client, "accounts:candidatura-enviar", DADOS).status_code for _ in range(5)]
        assert codigos[:3] == [200, 200, 200]
        assert 429 in codigos[3:]

    def test_falha_no_email_devolve_erro_para_tentar_de_novo(self, client, settings):
        settings.EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
        settings.EMAIL_HOST = "localhost"
        settings.EMAIL_PORT = 1
        settings.EMAIL_TIMEOUT = 1
        r = _post(client, "accounts:candidatura-enviar", DADOS)
        assert r.status_code == 503
