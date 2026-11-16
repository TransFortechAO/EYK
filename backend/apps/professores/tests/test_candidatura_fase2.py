"""Fase 2: a equipa EYK analisa e decide; o candidato é avisado."""
import json

import pytest
from django.core import mail

from apps.accounts.models import Notificacao, User
from apps.professores.models import CandidaturaProfessor as C
from apps.professores.models import HistoricoCandidatura, Professor

pytestmark = pytest.mark.django_db


@pytest.fixture
def staff(client):
    s = User.objects.create_user(username='equipa', password='SenhaForte123!', email='eq@eyk.ao', is_staff=True)
    client.force_login(s)
    return s


def _candidatura(n=1, estado=C.SUBMETIDA, area='LGA'):
    user = User.objects.create_user(username=f'cand{n}', password='SenhaForte123!', email=f'cand{n}@eyk.ao', email_verificado=True)
    return C.objects.create(nome=f'Candidato {n}', email=user.email, user=user, estado=estado, area=area, apresentacao='Bio')


def _decidir(client, c, acao, mensagem=''):
    return client.post(f'/api/admin/candidaturas/{c.id}/decidir/', json.dumps({'acao': acao, 'mensagem': mensagem}), content_type='application/json')


def test_so_a_equipa_ve_e_decide(client):
    c = _candidatura()
    user = User.objects.create_user(username='x', password='SenhaForte123!', email='x@eyk.ao')
    client.force_login(user)
    assert client.get('/api/admin/candidaturas/').status_code == 403
    assert _decidir(client, c, 'aprovar').status_code == 403


def test_lista_pendentes_filtros_e_contagens(client, staff):
    a = _candidatura(1, area='LGA')
    _candidatura(2, estado=C.EM_ANALISE, area='Matemática')
    _candidatura(3, estado=C.APROVADA)
    _candidatura(4, estado=C.POR_COMPLETAR)
    r = client.get('/api/admin/candidaturas/').json()
    assert {c['nome'] for c in r['candidaturas']} == {'Candidato 1', 'Candidato 2'}
    assert r['contagens']['pendentes'] == 2 and r['contagens']['aprovada'] == 1
    assert r['areas'] == ['LGA', 'Matemática']
    assert [c['id'] for c in client.get('/api/admin/candidaturas/?area=lga').json()['candidaturas']] == [a.id]
    assert len(client.get('/api/admin/candidaturas/?estado=todas').json()['candidaturas']) == 4
    assert client.get('/api/admin/candidaturas/?q=Candidato 2').json()['candidaturas'][0]['area'] == 'Matemática'


def test_aprovar_da_as_funcoes_de_professor_e_avisa(client, staff):
    c = _candidatura()
    assert _decidir(client, c, 'em_analise').json()['estado'] == 'em_analise'
    r = _decidir(client, c, 'aprovar')
    assert r.status_code == 200 and r.json()['estado'] == 'aprovada'
    c.refresh_from_db()
    assert c.user.is_teacher and c.decidida_por == staff
    prof = Professor.objects.get(user=c.user)
    assert prof.nome_publico == 'Candidato 1' and prof.area == 'LGA' and prof.bio == 'Bio'
    assert Notificacao.objects.filter(utilizador=c.user, mensagem__contains='aprovada').exists()
    assert len(mail.outbox) == 1 and 'aprovada' in mail.outbox[0].subject
    assert list(HistoricoCandidatura.objects.filter(candidatura=c).values_list('para', flat=True)) == ['em_analise', 'aprovada']
    # O próprio deixa de ver a faixa da candidatura.
    client.force_login(c.user)
    me = client.get('/accounts/auth/me/').json()['user']
    assert me['isTeacher'] is True and me['candidaturaProfessor'] is None


def test_rejeitar_exige_motivo_e_o_candidato_o_recebe(client, staff):
    c = _candidatura()
    assert 'motivo' in _decidir(client, c, 'rejeitar').json()['detail']
    _decidir(client, c, 'rejeitar', 'Faltam evidências da área.')
    c.refresh_from_db()
    assert c.estado == 'rejeitada' and c.mensagem_decisao == 'Faltam evidências da área.' and not c.user.is_teacher
    assert Notificacao.objects.filter(utilizador=c.user, mensagem__contains='Faltam evidências').exists()


def test_pedir_correcao_reabre_o_formulario(client, staff):
    c = _candidatura()
    assert _decidir(client, c, 'corrigir').status_code == 400
    _decidir(client, c, 'corrigir', 'Junta o certificado.')
    client.force_login(c.user)
    r = client.get('/api/candidatura/').json()['candidatura']
    assert r['estado'] == 'correcao_pedida' and r['editavel'] and r['mensagem'] == 'Junta o certificado.'


def test_decisao_repetida_e_recusada(client, staff):
    c = _candidatura()
    _decidir(client, c, 'aprovar')
    r = _decidir(client, c, 'rejeitar', 'x')
    assert r.status_code == 400 and 'já não está à espera' in r.json()['detail']


def test_notas_internas_nao_chegam_ao_candidato(client, staff):
    c = _candidatura()
    r = client.post(f'/api/admin/candidaturas/{c.id}/notas/', json.dumps({'texto': 'Parecer do especialista: domina LGA.'}), content_type='application/json')
    assert r.status_code == 201 and r.json()['notas'][0]['texto'].startswith('Parecer')
    client.force_login(c.user)
    assert 'Parecer' not in json.dumps(client.get('/api/candidatura/').json())


def test_detalhe_mostra_documentos_e_historico(client, staff):
    c = _candidatura()
    d = client.get(f'/api/admin/candidaturas/{c.id}/').json()
    assert d['nome'] == 'Candidato 1' and d['documentos'] == [] and d['historico'] == []
    assert client.get('/api/admin/candidaturas/9999/').status_code == 404
