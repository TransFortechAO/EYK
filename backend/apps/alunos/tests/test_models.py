import pytest

from apps.alunos.models import Aluno


@pytest.mark.django_db
class TestAlunoModel:
    def test_str_retorna_username_do_profile(self, aluno):
        assert str(aluno) == "aluno1"

    def test_bio_e_opcional(self, aluno):
        assert aluno.bio == ""

    def test_profile_e_one_to_one(self, aluno, aluno_user):
        # apps.accounts.signals já criou este Aluno automaticamente ao registar o User.
        with pytest.raises(Exception):
            Aluno.objects.create(profile=aluno_user)
