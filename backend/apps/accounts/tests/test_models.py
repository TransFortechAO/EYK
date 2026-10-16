from datetime import timedelta

import pytest
from django.utils import timezone

from apps.accounts.models import Notificacao, User


@pytest.mark.django_db
class TestUserModel:
    def test_str_returns_username(self):
        user = User.objects.create_user(username="joana", password="SenhaForte123!")
        assert str(user) == "joana"

    def test_defaults(self):
        user = User.objects.create_user(username="joana", password="SenhaForte123!")
        assert user.is_student is False
        assert user.is_teacher is False
        assert user.perfil_completo is False
        assert user.tema_preferido == "auto"
        assert user.notif_email_novidades is True
        assert user.notif_email_comunidade is True
        assert user.notif_email_gamificacao is True


@pytest.mark.django_db
class TestNotificacaoModel:
    def test_str_includes_tipo_e_username(self, aluno_user):
        notif = Notificacao.objects.create(
            utilizador=aluno_user, tipo="conquista", mensagem="Parabéns!",
        )
        assert str(notif) == "[conquista] aluno1"

    def test_ordering_mais_recente_primeiro(self, aluno_user):
        primeira = Notificacao.objects.create(utilizador=aluno_user, mensagem="primeira")
        Notificacao.objects.filter(pk=primeira.pk).update(criado_em=timezone.now() - timedelta(minutes=1))
        segunda = Notificacao.objects.create(utilizador=aluno_user, mensagem="segunda")
        assert list(Notificacao.objects.all()) == [segunda, primeira]

    def test_tipo_default_e_novidade(self, aluno_user):
        notif = Notificacao.objects.create(utilizador=aluno_user, mensagem="oi")
        assert notif.tipo == "novidade"
        assert notif.lida is False
