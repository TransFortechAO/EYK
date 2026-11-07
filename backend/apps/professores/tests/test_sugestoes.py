"""Professores para seguir."""
import pytest

from apps.accounts.models import User
from apps.professores.models import Professor, Seguidor

pytestmark = pytest.mark.django_db


def _professor(nome, n):
    user = User.objects.create_user(username=f'p{n}', password='SenhaForte123!', email=f'p{n}@eyk.ao')
    return Professor.objects.create(user=user, nome_publico=nome)


def test_sugere_os_mais_seguidos_que_ainda_nao_segues(client):
    eu = User.objects.create_user(username='eu', password='SenhaForte123!', email='eu@eyk.ao')
    a, b, c, d = (_professor(n, i) for i, n in enumerate(['Ana Kiala', 'Bento', 'Carla', 'Dina']))
    meu = Professor.objects.create(user=eu, nome_publico='Eu')
    fas = [User.objects.create_user(username=f'f{i}', password='SenhaForte123!', email=f'f{i}@eyk.ao') for i in range(3)]
    for f in fas:
        Seguidor.objects.create(utilizador=f, professor=b)
    Seguidor.objects.create(utilizador=fas[0], professor=c)
    Seguidor.objects.create(utilizador=eu, professor=d)
    client.force_login(eu)
    r = client.get('/api/professores/sugeridos/').json()
    ids = [x['professorId'] for x in r]
    assert ids == [b.id, c.id, a.id]
    assert meu.id not in ids and d.id not in ids
    assert r[0]['seguidores'] == 3 and r[2]['iniciais'] == 'AK'


def test_professor_banido_nao_aparece(client):
    eu = User.objects.create_user(username='eu', password='SenhaForte123!', email='eu@eyk.ao')
    p = _professor('Banido', 9)
    User.objects.filter(pk=p.user_id).update(banido=True)
    client.force_login(eu)
    assert client.get('/api/professores/sugeridos/').json() == []
