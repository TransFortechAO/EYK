"""Avisos, agenda, ficheiros privados, relatórios e dados."""
import datetime

import pytest
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.accounts.models import Notificacao
from apps.instituicoes.models import (
    Consentimento,
    FicheiroInstituicao,
    GrupoInstituicao,
    Instituicao,
    PerfilAluno,
    RegistoAuditoria,
)

pytestmark = pytest.mark.django_db


def _grupo(escola, *membros):
    g = GrupoInstituicao.objects.create(instituicao=escola, nome='3.ª A')
    for m in membros:
        m.grupos.add(g)
    return g


AVISO = {'titulo': 'Reunião', 'mensagem': 'Sexta às 10h', 'pedirConfirmacao': True, 'anexosIds': []}


def _carregar(api, nome='plano.pdf', dest='{"tipo":"instituicao"}', criancas='false', conteudo=b'%PDF-1.4'):
    return api.ficheiro('ficheiros/', {
        'ficheiro': SimpleUploadedFile(nome, conteudo), 'visibilidade': dest, 'temCriancas': criancas,
    })


def test_aviso_chega_a_quem_deve_com_contagens(api, pessoa, escola):
    edu, familia, longe = pessoa('educador'), pessoa('familia'), pessoa('familia')
    familia.utilizador.email_verificado = True
    familia.utilizador.save()
    g = _grupo(escola, edu, familia)
    corpo = {**AVISO, 'destinatarios': {'tipo': 'grupo', 'grupoId': f'srv-{g.pk}'}}
    r = api.como(edu).post('avisos/', corpo)
    assert r.status_code == 201
    assert Notificacao.objects.filter(utilizador=familia.utilizador).count() == 1
    assert len(mail.outbox) == 1
    assert api.como(longe).get('avisos/').json() == []
    [visto] = api.como(familia).get('avisos/').json()
    assert visto['lidoPorMim'] is False
    api.post(f'avisos/{visto["id"]}/lido/', {'confirmar': True})
    [autor] = api.como(edu).get('avisos/').json()
    assert (autor['recebidos'], autor['lidos'], autor['confirmados']) == (1, 1, 1)


def test_so_a_administracao_escreve_para_toda_a_escola(api, pessoa):
    r = api.como(pessoa('educador')).post('avisos/', {**AVISO, 'destinatarios': {'tipo': 'instituicao'}})
    assert r.status_code == 403 and 'administração' in r.json()['detail']


def test_preferencia_de_email_e_respeitada(api, pessoa, escola):
    admin, familia = pessoa('administrador'), pessoa('familia')
    familia.utilizador.email_verificado = True
    familia.utilizador.save()
    r = api.como(familia).client.put(
        api._url('preferencias-aviso/'), '{"email": false}', content_type='application/json',
    )
    assert r.json()['preferencias'] == {'plataforma': True, 'email': False}
    api.como(admin).post('avisos/', {**AVISO, 'destinatarios': {'tipo': 'instituicao'}})
    assert mail.outbox == []
    assert Notificacao.objects.filter(utilizador=familia.utilizador).exists()


def test_evento_presenca_e_cancelamento(api, pessoa, escola):
    admin, familia = pessoa('administrador'), pessoa('familia')
    inicio = (timezone.now() + datetime.timedelta(days=3)).isoformat()
    corpo = {'titulo': 'Festa', 'inicio': inicio, 'fim': '', 'destinatarios': {'tipo': 'instituicao'}, 'lembretes': ['1d']}
    ev = api.como(admin).post('eventos/', corpo).json()
    api.como(familia).post(f'eventos/{ev["id"]}/presenca/', {'resposta': 'vou'})
    api.post(f'eventos/{ev["id"]}/presenca/', {'resposta': 'talvez'})
    [visto] = api.get('eventos/').json()
    assert visto['presencas']['talvez'] == 1 and visto['presencas']['vou'] == 0 and visto['minhaResposta'] == 'talvez'
    assert api.post(f'eventos/{ev["id"]}/cancelar/').status_code == 403
    assert api.como(admin).post(f'eventos/{ev["id"]}/cancelar/').status_code == 200
    assert Notificacao.objects.filter(utilizador=familia.utilizador).exists()


def test_evento_fim_antes_do_inicio(api, pessoa):
    r = api.como(pessoa('administrador')).post('eventos/', {
        'titulo': 'X', 'inicio': '2027-01-02T10:00', 'fim': '2027-01-01T10:00', 'destinatarios': {'tipo': 'instituicao'},
    })
    assert r.json()['detail'] == 'O fim não pode ser antes do início.'


def test_ficheiro_privado_so_para_quem_tem_acesso(api, client, pessoa, escola):
    edu, dentro, fora = pessoa('educador'), pessoa('familia'), pessoa('familia')
    g = _grupo(escola, edu, dentro)
    r = _carregar(api.como(edu), dest=f'{{"tipo":"grupo","grupoId":"srv-{g.pk}"}}')
    assert r.status_code == 201
    url = r.json()['url']
    client.force_login(dentro.utilizador)
    resposta = client.get(url)
    assert resposta.status_code == 200 and b''.join(resposta.streaming_content) == b'%PDF-1.4'
    assert resposta['X-Content-Type-Options'] == 'nosniff'
    client.force_login(fora.utilizador)
    assert client.get(url).status_code == 403
    client.logout()
    assert client.get(url).status_code in (401, 403)


def test_ficheiro_perigoso_e_quota(api, pessoa, escola):
    api.como(pessoa('administrador'))
    assert 'não permitido' in _carregar(api, nome='pagina.html').json()['detail']
    assert 'não permitido' in _carregar(api, nome='x.svg').json()['detail']
    Instituicao.objects.filter(pk=escola.pk).update(ficheiro_max_mb=0)
    assert 'limite' in _carregar(api).json()['detail']


def test_fotos_de_criancas_exigem_consentimento(api, pessoa, escola):
    admin, tutor = pessoa('administrador'), pessoa('familia')
    aluno = PerfilAluno.objects.create(instituicao=escola, nome='Kiala', estado=PerfilAluno.ATIVO)
    r = _carregar(api.como(admin), nome='f.jpg', criancas='true')
    assert r.status_code == 400 and 'Kiala' in r.json()['detail']
    Consentimento.objects.create(
        instituicao=escola, aluno=aluno, tutor=tutor, tutor_nome='T', finalidade='fotografias', aceite=True, versao_texto='1',
    )
    assert _carregar(api, nome='f.jpg', criancas='true').status_code == 201


def test_abrir_com_criancas_fica_na_auditoria_uma_vez(api, client, pessoa, escola):
    admin = pessoa('administrador')
    url = _carregar(api.como(admin), nome='v.mp4', criancas='true', conteudo=b'0123456789').json()['url']
    r = client.get(url, HTTP_RANGE='bytes=2-5')
    assert r.status_code == 206 and r.content == b'2345' and r['Content-Range'] == 'bytes 2-5/10'
    assert not RegistoAuditoria.objects.filter(acao='ficheiro_aberto').exists()
    client.get(url, HTTP_RANGE='bytes=0-')
    assert RegistoAuditoria.objects.filter(acao='ficheiro_aberto').count() == 1


def test_so_quem_carregou_ou_a_administracao_apaga(api, pessoa):
    edu, outro, admin = pessoa('educador'), pessoa('educador'), pessoa('administrador')
    fid = _carregar(api.como(admin), nome='a.pdf').json()['id']
    assert api.como(edu).delete(f'ficheiros/{fid}/').status_code == 403
    assert api.como(outro).delete(f'ficheiros/{fid}/').status_code == 403
    assert api.como(admin).delete(f'ficheiros/{fid}/').status_code == 204
    assert not FicheiroInstituicao.objects.exists()


def test_relatorio_nao_mostra_grupos_pequenos_nem_numeros_inventados(api, client, pessoa, escola):
    admin = pessoa('administrador')
    g = _grupo(escola, admin)
    client.force_login(admin.utilizador)
    client.get('/api/instituicoes/minhas/')
    d = api.get('relatorio/').json()
    assert d['utilizadores'] == {'total': 1, 'ativos30d': 1, 'porPapel': {'administrador': 1}}
    assert sum(s['n'] for s in d['acessosPorSemana']) == 1 and len(d['acessosPorSemana']) == 12
    assert d['conteudosMaisUsados'] == []
    assert d['grupos'] == [{
        'grupoId': f'srv-{g.pk}', 'nome': g.nome, 'membros': 1, 'ativos30d': None, 'acessos30d': None, 'oculto': True,
    }]


def test_auditoria_e_relatorio_por_papel(api, pessoa):
    assert api.como(pessoa('educador')).get('auditoria/').status_code == 403
    assert api.get('relatorio/').status_code == 403
    assert api.como(pessoa('administrador')).get('auditoria/').status_code == 200
