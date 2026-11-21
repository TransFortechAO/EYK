"""Com EXIGIR_VERIFICACAO_PROFESSORES desligado (o formulário ainda não pede identidade,
referências nem código de conduta), a candidatura é enviada e aprovada sem eles."""
import json

import pytest
from django.test import override_settings

from apps.accounts.models import User
from apps.professores.models import CandidaturaProfessor, Professor


@pytest.mark.django_db
@override_settings(EXIGIR_VERIFICACAO_PROFESSORES=False)
def test_candidatura_enviada_e_aprovada_sem_verificacao(client):
    user = User.objects.create_user(username='rui', password='SenhaForte123!', email='rui@eyk.ao')
    c = CandidaturaProfessor.objects.create(
        nome='Rui Neto', email='rui@eyk.ao', user=user, area='Língua gestual', tipo_qualificacao='competencia',
        experiencia='Ensino LGA na associação do bairro há 5 anos.', portefolio_url='https://exemplo.ao/rui',
    )
    client.force_login(user)
    r = client.post('/api/candidatura/submeter/', json.dumps({}), content_type='application/json')
    assert r.status_code == 200, r.json()
    c.refresh_from_db()
    assert c.estado == CandidaturaProfessor.SUBMETIDA
    assert not c.conduta_aceite_em

    staff = User.objects.create_user(username='staff', password='x', email='s@eyk.ao', is_staff=True)
    client.force_login(staff)
    r = client.post(f'/api/admin/candidaturas/{c.id}/decidir/', json.dumps({'acao': 'aprovar'}), content_type='application/json')
    assert r.status_code == 200, r.json()
    user.refresh_from_db()
    assert user.is_teacher and Professor.objects.filter(user=user, ativo=True).exists()
