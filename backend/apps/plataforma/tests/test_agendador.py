import datetime
import json
from unittest import mock
from zoneinfo import ZoneInfo

import pytest
from django.urls import reverse

from apps.accounts.models import Notificacao, User
from apps.gamificacao.models import Ofensiva
from apps.plataforma.models import Anuncio, ConfiguracaoPlataforma
from apps.plataforma.tasks import ciclo_agendador

LUANDA = ZoneInfo('Africa/Luanda')


def _json(client, method, url, data=None):
    return getattr(client, method)(url, data=json.dumps(data or {}), content_type='application/json')


def _em(ano, mes, dia, hora, minuto=0):
    """Congela o relógio (hora de Luanda)."""
    return mock.patch('django.utils.timezone.now', return_value=datetime.datetime(ano, mes, dia, hora, minuto, tzinfo=LUANDA))


@pytest.fixture
def staff(db):
    return User.objects.create_user(username='admin', password='x', is_staff=True)


@pytest.fixture
def em_risco(db):
    """Aluno com uma ofensiva de 5 dias e sem atividade hoje (15/10)."""
    user = User.objects.create_user(username='maria', password='x')
    Ofensiva.objects.create(utilizador=user, dias_atual=5, ultima_atividade=datetime.date(2026, 10, 14))
    return user


@pytest.mark.django_db
class TestLembreteOfensiva:
    def _lembretes(self, user):
        return Notificacao.objects.filter(utilizador=user, mensagem__contains='ofensiva').count()

    def test_so_sai_depois_da_hora_e_uma_vez_por_dia(self, em_risco):
        ConfiguracaoPlataforma.objects.create(pk=1, lembrete_ofensiva_hora=datetime.time(18, 0))
        with _em(2026, 10, 15, 17, 55):
            ciclo_agendador()
        assert self._lembretes(em_risco) == 0

        with _em(2026, 10, 15, 18, 0):
            ciclo_agendador()
        with _em(2026, 10, 15, 18, 5):
            ciclo_agendador()
        assert self._lembretes(em_risco) == 1
        config = ConfiguracaoPlataforma.objects.get(pk=1)
        assert config.lembrete_ofensiva_ultimo_total == 1
        assert config.agendador_ultimo_ciclo is not None

    def test_desligado_nao_envia(self, em_risco):
        ConfiguracaoPlataforma.objects.create(pk=1, lembrete_ofensiva_ativo=False)
        with _em(2026, 10, 15, 20, 0):
            ciclo_agendador()
        assert self._lembretes(em_risco) == 0

    def test_ciclo_nao_altera_a_versao_do_aviso(self, db):
        config = ConfiguracaoPlataforma.objects.create(pk=1)
        versao = config.atualizado_em
        ciclo_agendador()
        assert ConfiguracaoPlataforma.objects.get(pk=1).atualizado_em == versao

    def test_admin_muda_a_hora_e_envia_agora(self, client, staff, em_risco):
        client.force_login(staff)
        response = _json(client, 'patch', reverse('plataforma-admin-config'), {
            'lembrete_ofensiva_hora': '19:30', 'lembrete_ofensiva_ativo': True,
        })
        assert response.status_code == 200
        assert response.json()['lembrete_ofensiva_hora'] == '19:30'
        assert response.json()['agendador']['modo'] == 'imediato'

        assert _json(client, 'patch', reverse('plataforma-admin-config'), {'lembrete_ofensiva_hora': '25:00'}).status_code == 400

        with _em(2026, 10, 15, 10, 0):
            response = client.post(reverse('plataforma-admin-lembrete'))
            assert response.status_code == 202
            assert self._lembretes(em_risco) == 1
        # Conta como o envio de hoje: o agendado das 19:30 já não sai.
        with _em(2026, 10, 15, 19, 35):
            ciclo_agendador()
        assert self._lembretes(em_risco) == 1


@pytest.mark.django_db
class TestAnunciosAgendados:
    def test_agendado_sai_a_hora_marcada(self, client, staff):
        client.force_login(staff)
        with _em(2026, 10, 15, 9, 0):
            response = _json(client, 'post', reverse('plataforma-admin-anuncios'), {
                'titulo': 'Curso novo', 'mensagem': 'Amanhã às 10h.', 'agendado_para': '2026-10-16T10:00:00+01:00',
            })
        assert response.status_code == 201
        assert response.json()['estado'] == 'agendado'
        assert Notificacao.objects.filter(tipo='novidade').count() == 0

        with _em(2026, 10, 16, 9, 55):
            ciclo_agendador()
        assert Notificacao.objects.filter(tipo='novidade').count() == 0

        with _em(2026, 10, 16, 10, 0):
            ciclo_agendador()
            ciclo_agendador()
        anuncio = Anuncio.objects.get()
        assert anuncio.estado == 'enviado'
        assert Notificacao.objects.filter(tipo='novidade').count() == User.objects.count() == anuncio.total_destinatarios

    def test_nao_aceita_datas_passadas_nem_sem_fuso(self, client, staff):
        client.force_login(staff)
        url = reverse('plataforma-admin-anuncios')
        with _em(2026, 10, 15, 9, 0):
            for data in ('2026-10-14T10:00:00+01:00', '2026-10-16T10:00:00', 'amanhã'):
                response = _json(client, 'post', url, {'titulo': 't', 'mensagem': 'm', 'agendado_para': data})
                assert response.status_code == 400, data

    def test_cancelar_so_antes_de_sair(self, client, staff):
        client.force_login(staff)
        agendado = Anuncio.objects.create(
            titulo='t', mensagem='m', estado='agendado',
            agendado_para=datetime.datetime(2030, 1, 1, tzinfo=LUANDA),
        )
        enviado = Anuncio.objects.create(titulo='t', mensagem='m', estado='enviado')
        assert client.delete(reverse('plataforma-admin-anuncio', args=[enviado.pk])).status_code == 409
        assert client.delete(reverse('plataforma-admin-anuncio', args=[agendado.pk])).status_code == 204
        assert list(Anuncio.objects.all()) == [enviado]
