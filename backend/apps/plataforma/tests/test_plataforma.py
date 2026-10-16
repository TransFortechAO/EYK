import json

import pytest
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from apps.accounts.models import Notificacao, User
from apps.cursos.models import Categoria, Curso


def _json(client, method, url, data=None):
    return getattr(client, method)(url, data=json.dumps(data or {}), content_type='application/json')


@pytest.fixture
def staff(db):
    return User.objects.create_user(username='admin', password='x', is_staff=True)


@pytest.mark.django_db
class TestConfiguracao:
    def test_config_publica_sem_sessao(self, client):
        body = client.get(reverse('plataforma-config')).json()
        assert body['aviso']['ativo'] is False
        assert body['limites'] == {'videoMb': 500, 'pdfMb': 50}

    def test_admin_ativa_aviso_e_altera_limites(self, client, staff):
        client.force_login(staff)
        url = reverse('plataforma-admin-config')
        assert _json(client, 'patch', url, {'aviso_ativo': True}).status_code == 400  # sem mensagem
        assert _json(client, 'patch', url, {'limite_pdf_mb': 0}).status_code == 400
        response = _json(client, 'patch', url, {
            'aviso_ativo': True, 'aviso_mensagem': 'Manutenção às 22h', 'limite_pdf_mb': 1,
        })
        assert response.status_code == 200
        body = client.get(reverse('plataforma-config')).json()
        assert body['aviso']['ativo'] is True and body['aviso']['mensagem'] == 'Manutenção às 22h'
        assert body['limites']['pdfMb'] == 1

    def test_exige_staff(self, client, aluno_user):
        client.force_login(aluno_user)
        assert client.get(reverse('plataforma-admin-config')).status_code == 403

    def test_limite_de_pdf_e_aplicado(self, client, staff, professor_user, professor):
        client.force_login(staff)
        _json(client, 'patch', reverse('plataforma-admin-config'), {'limite_pdf_mb': 1})
        curso = Curso.objects.create(professor=professor, titulo='C', descricao='d')
        client.force_login(professor_user)
        grande = SimpleUploadedFile('a.pdf', b'%PDF' + b'0' * (1024 * 1024 + 10), content_type='application/pdf')
        response = client.post(reverse('curso-recursos', args=[curso.id]), {'arquivo': grande})
        assert response.status_code == 400
        assert '1MB' in response.json()['detail']


@pytest.mark.django_db
class TestAnuncios:
    def test_anuncio_notifica_todos_e_email_so_a_quem_quer(self, client, staff):
        quer = User.objects.create_user(username='quer', email='quer@example.com', password='x', email_verificado=True)
        User.objects.create_user(
            username='nao', email='nao@example.com', password='x', email_verificado=True, notif_email_novidades=False,
        )
        User.objects.create_user(username='porconfirmar', email='pc@example.com', password='x')
        client.force_login(staff)
        response = _json(client, 'post', reverse('plataforma-admin-anuncios'), {
            'titulo': 'Novo curso de LGA', 'mensagem': 'Já está disponível.', 'link': '/cursos', 'enviar_email': True,
        })
        assert response.status_code == 201
        assert response.json()['totalDestinatarios'] == 4
        assert Notificacao.objects.filter(tipo='novidade', link='/cursos').count() == 4
        assert [m.to for m in mail.outbox] == [[quer.email]]
        assert 'tab=notificacoes' in mail.outbox[0].body

    def test_link_tem_de_ser_interno(self, client, staff):
        client.force_login(staff)
        response = _json(client, 'post', reverse('plataforma-admin-anuncios'), {
            'titulo': 't', 'mensagem': 'm', 'link': 'https://phishing.example',
        })
        assert response.status_code == 400


@pytest.mark.django_db
class TestCategorias:
    def test_crud(self, client, staff, professor):
        client.force_login(staff)
        url = reverse('plataforma-admin-categorias')
        assert _json(client, 'post', url, {'nome': 'Matemática'}).status_code == 201
        assert _json(client, 'post', url, {'nome': 'matemática'}).status_code == 400
        categoria = Categoria.objects.get()
        Curso.objects.create(professor=professor, titulo='C', descricao='d', categoria=categoria)
        assert client.get(url).json()[0]['totalCursos'] == 1

        detalhe = reverse('plataforma-admin-categoria', args=[categoria.id])
        assert _json(client, 'patch', detalhe, {'nome': 'Números'}).json()[0]['nome'] == 'Números'
        assert client.delete(detalhe).json() == []
        assert Curso.objects.get().categoria is None
