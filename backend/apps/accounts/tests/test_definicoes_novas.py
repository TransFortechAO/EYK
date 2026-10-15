"""Preferências de reprodução/acessibilidade/privacidade, sessões ativas,
alerta de dispositivo novo, códigos 2FA, exportação de dados, perfis e
emails de notificação."""
import json
from datetime import timedelta

import pytest
from django.core import mail
from django.urls import reverse
from django.utils import timezone
from django_otp.plugins.otp_static.models import StaticToken
from django_otp.plugins.otp_totp.models import TOTPDevice

from apps.accounts.models import DispositivoConhecido, Notificacao, SessaoAtiva, User
from apps.cursos.models import Curso, Inscricao
from apps.feed.models import Post

UA_CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36'
UA_FIREFOX_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'


def _post(client, url, data=None, **extra):
    return client.post(url, data=json.dumps(data or {}), content_type='application/json', **extra)


def _login(client, username='maria', password='x', ua=UA_CHROME_ANDROID):
    return _post(client, reverse('accounts:auth-login-json'), {'username': username, 'password': password},
                 HTTP_USER_AGENT=ua)


@pytest.fixture
def maria(db):
    return User.objects.create_user(
        username='maria', email='maria@example.com', password='x', is_student=True, email_verificado=True,
    )


@pytest.mark.django_db
class TestPreferencias:
    def test_guardar_reproducao_acessibilidade_privacidade(self, client, maria):
        client.force_login(maria)
        response = _post(client, reverse('accounts:api-preferencias-atualizar'), {
            'velocidade_reproducao': 0.75, 'autoplay_proxima_aula': False, 'tamanho_texto': 'grande',
            'alto_contraste': True, 'perfil_visibilidade': 'cursos', 'aparecer_ranking': False,
        })
        assert response.status_code == 200
        user = response.json()['user']
        assert user['preferencias']['velocidadeReproducao'] == 0.75
        assert user['preferencias']['autoplayProximaAula'] is False
        assert user['preferencias']['tamanhoTexto'] == 'grande'
        assert user['preferencias']['altoContraste'] is True
        assert user['privacidade'] == {
            'perfilVisibilidade': 'cursos', 'aparecerRanking': False,
            'mostrarCursos': True, 'mostrarConquistas': True, 'mostrarPublicacoes': True,
        }

    def test_valores_invalidos(self, client, maria):
        client.force_login(maria)
        url = reverse('accounts:api-preferencias-atualizar')
        assert _post(client, url, {'velocidade_reproducao': 3}).status_code == 400
        assert _post(client, url, {'tamanho_texto': 'enorme'}).status_code == 400
        assert _post(client, url, {'perfil_visibilidade': 'ninguem'}).status_code == 400

    def test_fora_do_ranking(self, client, maria, aluno_user):
        maria.aparecer_ranking = False
        maria.save()
        client.force_login(aluno_user)
        ids = [r['userId'] for r in client.get(reverse('leaderboard-list')).json()]
        assert maria.id not in ids and aluno_user.id in ids


@pytest.mark.django_db
class TestSessoesEDispositivos:
    def test_lista_e_termina_as_outras(self, client, maria):
        from django.test import Client

        outro = Client()
        assert _login(outro, ua=UA_FIREFOX_WINDOWS).status_code == 200
        assert _login(client).status_code == 200

        sessoes = client.get(reverse('accounts:api-sessoes')).json()['sessoes']
        assert len(sessoes) == 2
        assert sessoes[0]['atual'] is True and sessoes[0]['dispositivo'] == 'Chrome em Android'
        assert sessoes[1]['dispositivo'] == 'Firefox em Windows'

        assert _post(client, reverse('accounts:api-sessoes-terminar-outras')).json()['terminadas'] == 1
        assert outro.get(reverse('accounts:auth-me')).json()['authenticated'] is False
        assert client.get(reverse('accounts:auth-me')).json()['authenticated'] is True

    def test_nao_termina_a_sessao_atual_nem_de_outros(self, client, maria, aluno_user):
        _login(client)
        atual = SessaoAtiva.objects.get(utilizador=maria)
        assert _post(client, reverse('accounts:api-sessao-terminar', args=[atual.id])).status_code == 400
        alheia = SessaoAtiva.objects.create(utilizador=aluno_user, session_key='x' * 32)
        assert _post(client, reverse('accounts:api-sessao-terminar', args=[alheia.id])).status_code == 404

    def test_logout_remove_a_sessao(self, client, maria):
        _login(client)
        _post(client, reverse('accounts:auth-logout-json'))
        assert not SessaoAtiva.objects.exists()

    def test_alerta_de_dispositivo_novo(self, client, maria):
        from django.test import Client

        _login(client)
        assert DispositivoConhecido.objects.count() == 1
        assert len(mail.outbox) == 0  # 1.º dispositivo: sem alerta
        client.post(reverse('accounts:auth-logout-json'))
        _login(client)  # mesmo browser (cookie): sem alerta
        assert len(mail.outbox) == 0

        _login(Client(), ua=UA_FIREFOX_WINDOWS)
        assert len(mail.outbox) == 1
        assert 'Firefox em Windows' in mail.outbox[0].body


@pytest.mark.django_db
class TestCodigos2FA:
    def test_gerar_novos_codigos(self, client, maria):
        client.force_login(maria)
        url = reverse('accounts:api-2fa-novos-codigos')
        assert _post(client, url, {'senha_atual': 'x'}).status_code == 400  # 2FA inativo
        TOTPDevice.objects.create(user=maria, confirmed=True, name='default')
        assert _post(client, url, {'senha_atual': 'errada'}).status_code == 400
        codigos = _post(client, url, {'senha_atual': 'x'}).json()['codigosBackup']
        assert len(codigos) == 10
        assert StaticToken.objects.filter(device__user=maria).count() == 10
        assert client.get(reverse('accounts:api-2fa-status')).json()['codigosRestantes'] == 10


@pytest.mark.django_db
class TestExportacao:
    def test_exporta_os_meus_dados(self, client, maria):
        Post.objects.create(autor=maria, conteudo='a minha publicação')
        client.force_login(maria)
        response = client.get(reverse('accounts:api-exportar-dados'))
        assert response.status_code == 200
        assert 'attachment' in response['Content-Disposition']
        dados = json.loads(response.content)
        assert dados['conta']['email'] == 'maria@example.com'
        assert dados['publicacoes'][0]['conteudo'] == 'a minha publicação'


@pytest.mark.django_db
class TestPerfis:
    def test_perfil_so_para_quem_partilha_cursos(self, client, maria, aluno_user, professor):
        maria.perfil_visibilidade = 'cursos'
        maria.save()
        Post.objects.create(autor=maria, conteudo='olá')
        url = reverse('accounts:perfil-publico', args=[maria.id])

        client.force_login(aluno_user)
        perfil = client.get(url).json()['perfil']
        assert perfil['privado'] is True and 'bio' not in perfil and 'publicacoes' not in perfil

        curso = Curso.objects.create(professor=professor, titulo='C', descricao='d')
        Inscricao.objects.create(aluno=maria.aluno, curso=curso)
        Inscricao.objects.create(aluno=aluno_user.aluno, curso=curso)
        perfil = client.get(url).json()['perfil']
        assert perfil['privado'] is False
        assert perfil['publicacoes'][0]['conteudo'] == 'olá'

    def test_esconder_seccoes_e_ver_como_visitante(self, client, maria):
        maria.mostrar_publicacoes_perfil = False
        maria.perfil_visibilidade = 'cursos'
        maria.save()
        client.force_login(maria)
        url = reverse('accounts:perfil-publico', args=[maria.id])
        perfil = client.get(url).json()['perfil']
        assert perfil['souEu'] is True and perfil['privado'] is False
        assert 'publicacoes' not in perfil and 'conquistas' in perfil
        assert client.get(url, {'como_visitante': '1'}).json()['perfil']['privado'] is True

    def test_professor_mostra_cursos(self, client, aluno_user, professor_user, professor):
        Curso.objects.create(professor=professor, titulo='Visível', descricao='d')
        Curso.objects.create(professor=professor, titulo='Oculto', descricao='d', oculto=True)
        client.force_login(aluno_user)
        perfil = client.get(reverse('accounts:perfil-publico', args=[professor_user.id])).json()['perfil']
        assert [c['titulo'] for c in perfil['cursos']] == ['Visível']

    def test_meu_perfil(self, client, maria, professor):
        curso = Curso.objects.create(professor=professor, titulo='LGA 1', descricao='d')
        Inscricao.objects.create(aluno=maria.aluno, curso=curso, concluido=True, concluido_em=timezone.now())
        Post.objects.create(autor=maria, conteudo='escondido', oculto=True)
        client.force_login(maria)
        body = client.get(reverse('accounts:meu-perfil')).json()
        assert body['certificados'][0]['curso'] == 'LGA 1'
        assert body['publicacoes'][0]['oculto'] is True
        assert body['estatisticas']['cursosConcluidos'] == 1
        assert body['conta']['email'] == 'maria@example.com'


@pytest.mark.django_db
class TestEmailsDeNotificacao:
    def test_comentario_no_meu_post_respeita_preferencia_e_limite(self, client, maria, aluno_user):
        post = Post.objects.create(autor=maria, conteudo='olá')
        User.objects.filter(pk=aluno_user.pk).update(email_verificado=True, date_joined=timezone.now() - timedelta(days=30))
        aluno_user.refresh_from_db()
        client.force_login(aluno_user)
        url = reverse('api-comentario-list', args=[post.id])

        _post(client, url, {'conteudo': 'Muito bom!'})
        assert Notificacao.objects.filter(utilizador=maria, tipo='comunidade', link=f'/comunidade?post={post.id}').exists()
        assert len(mail.outbox) == 1 and mail.outbox[0].to == ['maria@example.com']

        _post(client, url, {'conteudo': 'Outro comentário'})
        assert Notificacao.objects.filter(utilizador=maria, tipo='comunidade').count() == 2
        assert len(mail.outbox) == 1  # anti-inundação: 1 email por 10 min

    def test_sem_email_se_desligado(self, client, maria, aluno_user):
        maria.notif_email_comunidade = False
        maria.save()
        post = Post.objects.create(autor=maria, conteudo='olá')
        client.force_login(aluno_user)
        _post(client, reverse('api-comentario-list', args=[post.id]), {'conteudo': 'Oi'})
        assert Notificacao.objects.filter(utilizador=maria).exists()
        assert len(mail.outbox) == 0

    def test_conquista_envia_email_de_gamificacao(self, maria):
        from apps.gamificacao.models import Badge
        from apps.gamificacao.services import verificar_badges
        from apps.professores.models import VisualizacaoVideo

        Badge.objects.get_or_create(slug='primeira-aula', defaults={'nome': 'Primeira aula', 'descricao': 'd', 'icone': 'Play'})
        from apps.professores.models import Professor, Video
        prof_user = User.objects.create_user(username='p', password='x', is_teacher=True)
        prof = Professor.objects.create(user=prof_user, nome_publico='P', area='a')
        video = Video.objects.create(professor=prof, titulo='V', ativo=True)
        VisualizacaoVideo.objects.create(video=video, utilizador=maria)
        verificar_badges(maria)
        assert Notificacao.objects.filter(utilizador=maria, tipo='conquista').exists()
        assert any('Nova conquista' in m.subject for m in mail.outbox)
