import pytest


@pytest.fixture(autouse=True)
def _limpar_cache():
    # Os limites de frequência vivem na cache — sem isto, tentativas de um
    # teste contavam para o seguinte.
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def aluno_user(db):
    from apps.accounts.models import User

    return User.objects.create_user(username="aluno1", password="SenhaForte123!", is_student=True)


@pytest.fixture
def professor_user(db):
    from apps.accounts.models import User

    return User.objects.create_user(username="professor1", password="SenhaForte123!", is_teacher=True)


@pytest.fixture
def professor(db, professor_user):
    from apps.professores.models import Professor

    return Professor.objects.create(
        user=professor_user, nome_publico="Professor Um", area="Matemática",
    )


@pytest.fixture
def aluno(db, aluno_user):
    # Um sinal em apps.accounts.signals já cria o Aluno ao criar um User is_student=True.
    from apps.alunos.models import Aluno

    return Aluno.objects.get(profile=aluno_user)
