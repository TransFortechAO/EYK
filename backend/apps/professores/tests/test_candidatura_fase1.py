"""Fase 1: completar a candidatura, documentos privados e estados."""
import json

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.accounts.models import Notificacao, User
from apps.professores.candidaturas import TransicaoInvalida, mudar_estado
from apps.professores.models import CandidaturaProfessor, DocumentoCandidatura, HistoricoCandidatura

pytestmark = pytest.mark.django_db


@pytest.fixture
def candidato(client):
    user = User.objects.create_user(username='ana', password='SenhaForte123!', email='ana@eyk.ao')
    c = CandidaturaProfessor.objects.create(
        nome='Ana Silva', email='ana@eyk.ao', user=user,
        referencias=[{'nome': 'Maria', 'contacto': 'maria@x.ao', 'relacao': 'Diretora'}],
    )
    # Identidade (Fase 3) já junta: os testes da Fase 1 tratam do resto.
    DocumentoCandidatura.objects.create(candidatura=c, tipo='identidade', link='https://x.ao/bi')
    client.force_login(user)
    return user, c


def _submeter(client, conduta=True):
    return client.post('/api/candidatura/submeter/', json.dumps({'aceitarConduta': conduta}), content_type='application/json')


def _patch(client, dados):
    return client.patch('/api/candidatura/', json.dumps(dados), content_type='application/json')


def _doc(client, tipo='diploma', nome='diploma.pdf', **extra):
    dados = {'tipo': tipo, 'titulo': 'Licenciatura', **extra}
    if nome:
        dados['ficheiro'] = SimpleUploadedFile(nome, b'%PDF-1.4')
    return client.post('/api/candidatura/documentos/', dados)


def test_ver_e_guardar_a_minha_candidatura(client, candidato):
    r = client.get('/api/candidatura/').json()['candidatura']
    assert r['estado'] == 'por_completar' and r['editavel'] is True
    r = _patch(client, {'area': 'Matemática', 'tipoQualificacao': 'competencia', 'experiencia': '10 anos', 'portefolioUrl': 'https://x.ao'})
    assert r.status_code == 200 and r.json()['candidatura']['area'] == 'Matemática'
    assert _patch(client, {'tipoQualificacao': 'outro'}).status_code == 400
    assert _patch(client, {'portefolioUrl': 'javascript:alert(1)'}).status_code == 400


def test_sem_candidatura(client):
    user = User.objects.create_user(username='b', password='SenhaForte123!', email='b@eyk.ao')
    client.force_login(user)
    assert client.get('/api/candidatura/').json() == {'candidatura': None}
    assert _patch(client, {'area': 'x'}).status_code == 404


def test_formal_exige_diploma_ou_certificado(client, candidato):
    _patch(client, {'area': 'Matemática', 'tipoQualificacao': 'formal'})
    r = _submeter(client)
    assert r.status_code == 400 and 'diploma ou certificado' in r.json()['detail']
    assert _doc(client).status_code == 201
    assert _submeter(client).json()['candidatura']['estado'] == 'submetida'


def test_competencia_aceita_portefolio_sem_certificado(client, candidato):
    _patch(client, {'area': 'LGA', 'tipoQualificacao': 'competencia'})
    assert 'experiência' in _submeter(client).json()['detail']
    _patch(client, {'experiencia': 'Intérprete há 10 anos'})
    assert 'Mostra o teu trabalho' in _submeter(client).json()['detail']
    _doc(client, tipo='video', nome=None, link='https://youtu.be/abc')
    r = _submeter(client)
    assert r.status_code == 200, r.content


def test_depois_de_submeter_nao_se_edita_e_a_equipa_e_avisada(client, candidato):
    staff = User.objects.create_user(username='s', password='SenhaForte123!', email='s@eyk.ao', is_staff=True)
    _patch(client, {'area': 'LGA', 'tipoQualificacao': 'formal'})
    doc = _doc(client).json()
    _submeter(client)
    assert _patch(client, {'area': 'outra'}).status_code == 400
    assert _doc(client).status_code == 400
    assert client.delete(f'/api/candidatura/documentos/{doc["id"]}/').status_code == 400
    assert Notificacao.objects.filter(utilizador=staff, mensagem__contains='Ana Silva').exists()
    assert list(HistoricoCandidatura.objects.values_list('de', 'para')) == [('por_completar', 'submetida')]


def test_correcao_pedida_volta_a_ser_editavel(client, candidato):
    _, c = candidato
    c.estado = CandidaturaProfessor.CORRECAO_PEDIDA
    c.mensagem_decisao = 'Junta o certificado.'
    c.save()
    r = client.get('/api/candidatura/').json()['candidatura']
    assert r['editavel'] is True and r['mensagem'] == 'Junta o certificado.'
    me = client.get('/accounts/auth/me/').json()['user']
    assert me['candidaturaProfessor'] == {'estado': 'correcao_pedida', 'mensagem': 'Junta o certificado.'}


def test_documento_privado_so_para_o_proprio_e_a_equipa(client, candidato):
    url = _doc(client).json()['url']
    assert url == f'/api/candidatura/documentos/{DocumentoCandidatura.objects.get(tipo='diploma').id}/'
    r = client.get(url)
    assert r.status_code == 200 and b''.join(r.streaming_content) == b'%PDF-1.4'
    outro = User.objects.create_user(username='o', password='SenhaForte123!', email='o@eyk.ao')
    client.force_login(outro)
    assert client.get(url).status_code == 404
    staff = User.objects.create_user(username='s', password='SenhaForte123!', email='s@eyk.ao', is_staff=True)
    client.force_login(staff)
    assert client.get(url).status_code == 200
    assert client.delete(url).status_code == 403


def test_ficheiro_perigoso_e_limite(client, candidato):
    assert 'não permitido' in _doc(client, nome='pagina.html').json()['detail']
    assert 'ficheiro ou um link' in _doc(client, nome=None).json()['detail']
    assert 'tipo' in _doc(client, tipo='x').json()['detail']


def test_transicoes_invalidas_sao_recusadas(candidato):
    _, c = candidato
    with pytest.raises(TransicaoInvalida):
        mudar_estado(c, CandidaturaProfessor.APROVADA, None)
    mudar_estado(c, CandidaturaProfessor.SUBMETIDA, None)
    mudar_estado(c, CandidaturaProfessor.REJEITADA, None, 'Sem evidências.')
    with pytest.raises(TransicaoInvalida):
        mudar_estado(c, CandidaturaProfessor.SUBMETIDA, None)


def test_quem_espera_nao_usa_a_area_de_professor(client, candidato):
    assert client.get('/api/professor/cursos/').status_code in (403, 404)
