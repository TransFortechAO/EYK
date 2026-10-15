import json
from datetime import timedelta

import pytest
from django.core import mail
from django.urls import reverse
from django.utils import timezone

from apps.accounts.models import Notificacao, User
from apps.feed.models import Comentario, Post
from apps.moderacao.models import AcaoModeracao, Bloqueio, Contestacao, Denuncia, PalavraProibida
from apps.moderacao.servicos import token_contestacao


def _post(client, url, data=None):
    return client.post(url, data=json.dumps(data or {}), content_type='application/json')


def _criar(username, **extra):
    return User.objects.create_user(
        username=username, email=f'{username}@example.com', password='x', is_student=True,
        email_verificado=True, **extra,
    )


@pytest.fixture
def autor(db):
    return _criar('autor')


@pytest.fixture
def staff(db):
    return User.objects.create_user(
        username='admin', email='admin@example.com', password='x', is_staff=True, email_verificado=True,
    )


@pytest.fixture
def post(autor):
    return Post.objects.create(autor=autor, conteudo='Olá comunidade')


def _denunciar(client, user, tipo, objeto_id, motivo='spam'):
    client.force_login(user)
    return _post(client, reverse('moderacao-denuncias'), {'tipo': tipo, 'id': objeto_id, 'motivo': motivo})


@pytest.mark.django_db
class TestDenuncias:
    def test_denunciar_e_repetir(self, client, post):
        maria = _criar('maria')
        assert _denunciar(client, maria, 'post', post.id).status_code == 201
        response = _denunciar(client, maria, 'post', post.id)
        assert response.status_code == 200
        assert response.json()['jaDenunciado'] is True
        assert Denuncia.objects.count() == 1
        assert Denuncia.objects.get().resumo_conteudo == 'Olá comunidade'

    def test_nao_denuncia_o_proprio_conteudo(self, client, autor, post):
        assert _denunciar(client, autor, 'post', post.id).status_code == 400

    def test_motivo_e_tipo_invalidos(self, client, post):
        maria = _criar('maria')
        assert _denunciar(client, maria, 'post', post.id, motivo='nada').status_code == 400
        assert _denunciar(client, maria, 'xpto', post.id).status_code == 400
        assert _denunciar(client, maria, 'post', 999).status_code == 404

    def test_oculta_automaticamente_ao_fim_de_3_denuncias(self, client, autor, post):
        for nome in ('a1', 'a2', 'a3'):
            _denunciar(client, _criar(nome), 'post', post.id)
        post.refresh_from_db()
        assert post.oculto is True
        acao = AcaoModeracao.objects.get(tipo='ocultar')
        assert acao.automatica and acao.alvo == autor
        assert Notificacao.objects.filter(utilizador=autor, tipo='moderacao').exists()

        # Os outros deixam de o ver; o autor continua a vê-lo (com `oculto`).
        client.force_login(_criar('outro'))
        assert client.get(reverse('api-post-list')).json() == []
        client.force_login(autor)
        assert client.get(reverse('api-post-list')).json()[0]['oculto'] is True

    def test_denuncia_grave_alerta_admins(self, client, staff, post):
        _denunciar(client, _criar('maria'), 'post', post.id, motivo='odio')
        assert Notificacao.objects.filter(utilizador=staff, tipo='moderacao').exists()
        assert any('denúncia grave' in m.subject for m in mail.outbox)


@pytest.mark.django_db
class TestFilaEDecisoes:
    def test_fila_exige_staff(self, client, autor):
        client.force_login(autor)
        assert client.get(reverse('moderacao-admin-fila')).status_code == 403

    def test_fila_agrupa_por_conteudo(self, client, staff, post):
        _denunciar(client, _criar('m1'), 'post', post.id, 'spam')
        _denunciar(client, _criar('m2'), 'post', post.id, 'assedio')
        client.force_login(staff)
        body = client.get(reverse('moderacao-admin-fila')).json()
        assert len(body['itens']) == 1
        item = body['itens'][0]
        assert item['total'] == 2 and item['gravidade'] == 3
        assert item['autor']['username'] == 'autor'
        assert body['contadores']['pendentes'] == 1

    def test_ocultar_e_avisar(self, client, staff, autor, post):
        denunciante = _criar('m1')
        _denunciar(client, denunciante, 'post', post.id)
        client.force_login(staff)
        response = _post(client, reverse('moderacao-admin-resolver'), {
            'tipo': 'post', 'objetoId': post.id, 'conteudo': 'ocultar', 'sancao': 'aviso', 'motivo': 'Spam',
        })
        assert response.status_code == 200
        post.refresh_from_db()
        assert post.oculto
        assert Denuncia.objects.get().estado == 'resolvida'
        assert AcaoModeracao.objects.filter(tipo='aviso', alvo=autor).exists()
        assert Notificacao.objects.filter(utilizador=denunciante, mensagem__contains='tomámos medidas').exists()

    def test_rejeitar_repoe_conteudo_ocultado_automaticamente(self, client, staff, post):
        for nome in ('a1', 'a2', 'a3'):
            _denunciar(client, _criar(nome), 'post', post.id)
        client.force_login(staff)
        _post(client, reverse('moderacao-admin-resolver'), {'tipo': 'post', 'objetoId': post.id, 'conteudo': 'manter'})
        post.refresh_from_db()
        assert post.oculto is False
        assert set(Denuncia.objects.values_list('estado', flat=True)) == {'rejeitada'}

    def test_apagar_comentario(self, client, staff, post):
        comentario = Comentario.objects.create(post=post, autor=_criar('c'), conteudo='mau')
        _denunciar(client, _criar('m1'), 'comentario', comentario.id)
        client.force_login(staff)
        _post(client, reverse('moderacao-admin-resolver'), {
            'tipo': 'comentario', 'objetoId': comentario.id, 'conteudo': 'apagar',
        })
        assert not Comentario.objects.filter(id=comentario.id).exists()
        assert AcaoModeracao.objects.get(tipo='apagar').resumo_conteudo == 'mau'

    def test_tres_avisos_suspendem_automaticamente(self, client, staff, autor):
        client.force_login(staff)
        url = reverse('moderacao-admin-sancionar', args=[autor.id])
        for _ in range(3):
            assert _post(client, url, {'sancao': 'aviso', 'motivo': 'x'}).status_code == 200
        autor.refresh_from_db()
        assert autor.esta_suspenso
        assert AcaoModeracao.objects.get(tipo='suspensao').automatica

    def test_nao_sanciona_admins(self, client, staff):
        outro = User.objects.create_user(username='admin2', password='x', is_staff=True)
        client.force_login(staff)
        response = _post(client, reverse('moderacao-admin-sancionar', args=[outro.id]), {'sancao': 'banimento'})
        assert response.status_code == 400


@pytest.mark.django_db
class TestContaSancionada:
    def test_login_suspenso_mostra_motivo_e_contestacao(self, client, staff, autor):
        client.force_login(staff)
        _post(client, reverse('moderacao-admin-sancionar', args=[autor.id]),
              {'sancao': 'suspensao', 'dias': 3, 'motivo': 'Assédio'})
        client.logout()
        response = _post(client, reverse('accounts:auth-login-json'), {'username': 'autor', 'password': 'x'})
        assert response.status_code == 403
        body = response.json()
        assert body['codigo'] == 'conta_suspensa' and body['motivo'] == 'Assédio'
        assert body['tokenContestacao']
        assert any('suspensa' in m.subject for m in mail.outbox)

    def test_sessao_aberta_termina_ao_ser_banido(self, client, autor):
        client.force_login(autor)
        assert client.get(reverse('accounts:auth-me')).json()['authenticated'] is True
        autor.banido = True
        autor.save()
        assert client.get(reverse('accounts:auth-me')).json()['authenticated'] is False

    def test_contestar_e_aceitar_levanta_suspensao(self, client, staff, autor):
        client.force_login(staff)
        _post(client, reverse('moderacao-admin-sancionar', args=[autor.id]), {'sancao': 'suspensao', 'dias': 7})
        acao = AcaoModeracao.objects.get(tipo='suspensao')
        token = token_contestacao(acao)
        client.logout()

        url = reverse('moderacao-contestar')
        assert client.get(url, {'token': token}).json()['acao']['tipo'] == 'suspensao'
        assert _post(client, url, {'token': token, 'texto': 'curto'}).status_code == 400
        assert _post(client, url, {'token': token, 'texto': 'Foi um engano, não fiz nada disso.'}).status_code == 201
        assert _post(client, url, {'token': token, 'texto': 'Outra vez a mesma coisa aqui.'}).status_code == 400
        assert client.get(url, {'token': 'lixo'}).status_code == 404

        client.force_login(staff)
        contestacao = Contestacao.objects.get()
        response = _post(client, reverse('moderacao-admin-responder', args=[contestacao.id]),
                         {'aceitar': True, 'resposta': 'Tens razão.'})
        assert response.status_code == 200
        autor.refresh_from_db()
        assert not autor.esta_sancionado
        acao.refresh_from_db()
        assert acao.revertida


@pytest.mark.django_db
class TestBloqueios:
    def test_bloquear_esconde_publicacoes_nos_dois_sentidos(self, client, autor, post):
        maria = _criar('maria')
        client.force_login(maria)
        assert _post(client, reverse('moderacao-bloquear', args=[autor.id])).json() == {'bloqueado': True}
        assert client.get(reverse('api-post-list')).json() == []
        assert client.get(reverse('moderacao-bloqueados')).json()[0]['username'] == 'autor'

        client.force_login(autor)
        Post.objects.create(autor=maria, conteudo='post da maria')
        assert [p['conteudo'] for p in client.get(reverse('api-post-list')).json()] == ['Olá comunidade']

        client.force_login(maria)
        response = _post(client, reverse('api-comentario-list', args=[post.id]), {'conteudo': 'oi'})
        assert response.status_code == 403

        assert _post(client, reverse('moderacao-bloquear', args=[autor.id])).json() == {'bloqueado': False}
        assert not Bloqueio.objects.exists()


@pytest.mark.django_db
class TestFiltroAutomatico:
    def test_palavra_proibida_impede_publicar(self, client, autor):
        client.force_login(autor)
        response = _post(client, reverse('api-post-list'), {'conteudo': 'és um C4R4LHO'})
        assert response.status_code == 400
        assert not Post.objects.exists()

    def test_palavra_a_sinalizar_publica_e_cria_denuncia_do_sistema(self, client, autor):
        client.force_login(autor)
        assert _post(client, reverse('api-post-list'), {'conteudo': 'que merda de dia'}).status_code == 201
        denuncia = Denuncia.objects.get()
        assert denuncia.denunciante is None and denuncia.motivo == 'filtro_automatico'

    def test_conta_sem_email_confirmado_nao_publica_links(self, client):
        novo = User.objects.create_user(username='novo', password='x', is_student=True)
        client.force_login(novo)
        response = _post(client, reverse('api-post-list'), {'conteudo': 'vejam https://spam.example'})
        assert response.status_code == 400
        assert 'links' in response.json()['detail']

    def test_texto_repetido_e_limite_de_frequencia(self, client, autor):
        # Conta antiga (as novas têm metade do limite: ver test_conta_nova_tem_limite_menor).
        User.objects.filter(pk=autor.pk).update(date_joined=timezone.now() - timedelta(days=30))
        client.force_login(autor)
        url = reverse('api-post-list')
        assert _post(client, url, {'conteudo': 'Olá'}).status_code == 201
        assert _post(client, url, {'conteudo': 'olá'}).status_code == 400  # repetido (conta para o limite)
        for i in range(3):
            assert _post(client, url, {'conteudo': f'post {i}'}).status_code == 201
        assert _post(client, url, {'conteudo': 'mais um'}).status_code == 429

    def test_conta_nova_tem_limite_menor(self, client, autor):
        client.force_login(autor)
        url = reverse('api-post-list')
        assert _post(client, url, {'conteudo': 'um'}).status_code == 201
        assert _post(client, url, {'conteudo': 'dois'}).status_code == 201
        assert _post(client, url, {'conteudo': 'três'}).status_code == 429

    def test_admin_gere_palavras(self, client, staff, autor):
        client.force_login(staff)
        url = reverse('moderacao-admin-palavras')
        assert _post(client, url, {'termo': 'Batata', 'acao': 'bloquear'}).status_code == 201
        assert _post(client, url, {'termo': 'batata'}).status_code == 400
        client.force_login(autor)
        assert _post(client, reverse('api-post-list'), {'conteudo': 'gosto de batata'}).status_code == 400

        client.force_login(staff)
        palavra = PalavraProibida.objects.get(termo='batata')
        assert client.delete(reverse('moderacao-admin-palavra-apagar', args=[palavra.id])).status_code == 204
        client.force_login(autor)
        assert _post(client, reverse('api-post-list'), {'conteudo': 'gosto de batata'}).status_code == 201

    def test_staff_pode_apagar_qualquer_comentario(self, client, staff, post):
        comentario = Comentario.objects.create(post=post, autor=_criar('c'), conteudo='x')
        client.force_login(staff)
        url = reverse('api-comentario-detail', args=[post.id, comentario.id])
        assert client.delete(url).status_code == 204
