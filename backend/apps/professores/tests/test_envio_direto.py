"""Envio direto do browser para o bucket (B2): link assinado, confirmação e limpeza."""
import threading
from datetime import timedelta

import pytest
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone

from apps.cursos.models import Curso, RecursoCurso
from apps.professores import envio_direto
from apps.professores.models import EnvioDireto, Professor, Seguidor, Video


class BucketFalso:
    """Faz de cliente S3: guarda o que o browser "enviou"."""

    def __init__(self):
        self.objetos: dict[str, int] = {}
        self.assinados: list[dict] = []

    def generate_presigned_url(self, operacao, Params, ExpiresIn):
        self.assinados.append({'operacao': operacao, **Params, 'expira': ExpiresIn})
        return f"https://s3.eu-central-003.backblazeb2.com/eyk/{Params['Key']}?X-Amz-Signature=abc"

    def head_object(self, Bucket, Key):
        if Key not in self.objetos:
            raise KeyError(Key)
        return {'ContentLength': self.objetos[Key]}


@pytest.fixture
def bucket(monkeypatch):
    falso = BucketFalso()
    monkeypatch.setattr(envio_direto, 'disponivel', lambda: True)
    monkeypatch.setattr(envio_direto, '_cliente', lambda: falso)
    monkeypatch.setattr(envio_direto, '_bucket', lambda: 'eyk')
    return falso


def _pedir(client, **dados):
    corpo = {'finalidade': 'video', 'nome': 'Aula 1.mp4', 'tamanho': 1000, 'tipo': 'video/mp4', **dados}
    return client.post(reverse('api-professor-envios'), data=corpo, content_type='application/json')


def _enviado(bucket, resposta):
    """O browser envia o ficheiro para o link: fica no bucket com o tamanho combinado."""
    envio = EnvioDireto.objects.get(pk=resposta.json()['id'])
    bucket.objetos[envio.chave] = envio.tamanho_bytes
    return envio


@pytest.mark.django_db
class TestPedirLink:
    def test_sem_bucket_o_ficheiro_segue_pelo_servidor(self, client, professor_user, professor):
        client.force_login(professor_user)
        assert _pedir(client).json() == {'direto': False}

    def test_so_professores(self, client, aluno_user, bucket):
        client.force_login(aluno_user)
        assert _pedir(client).status_code == 403

    def test_link_assinado_para_o_nome_tipo_e_tamanho(self, client, professor_user, professor, bucket):
        client.force_login(professor_user)
        r = _pedir(client)
        assert r.status_code == 201
        corpo = r.json()
        assert corpo['direto'] is True and corpo['metodo'] == 'PUT'
        assert corpo['cabecalhos'] == {'Content-Type': 'video/mp4'}
        assinado = bucket.assinados[0]
        assert assinado['operacao'] == 'put_object'
        assert assinado['ContentLength'] == 1000 and assinado['ContentType'] == 'video/mp4'
        assert assinado['Key'].startswith('videos/') and assinado['Key'].endswith('-Aula-1.mp4')
        assert len(assinado['Key']) <= 100

    def test_recusa_formato_e_tamanho(self, client, professor_user, professor, bucket):
        client.force_login(professor_user)
        assert 'Formato' in _pedir(client, nome='virus.exe').json()['detail']
        assert 'PDF' in _pedir(client, finalidade='recurso_curso', nome='a.docx').json()['detail']
        assert 'no máximo' in _pedir(client, tamanho=10**13).json()['detail']
        assert EnvioDireto.objects.count() == 0


@pytest.mark.django_db
class TestCriarComEnvio:
    def test_video_com_ficheiro_ja_no_bucket(self, client, professor_user, professor, bucket):
        client.force_login(professor_user)
        envio = _enviado(bucket, _pedir(client))
        r = client.post(
            reverse('api-professor-videos'),
            data={'titulo': 'Alfabeto', 'arquivo_envio': envio.id, 'duracao_segundos': 95},
            content_type='application/json',
        )
        assert r.status_code == 201, r.json()
        video = Video.objects.get(pk=r.json()['id'])
        assert video.arquivo.name == envio.chave
        assert video.duracao_segundos == 95
        envio.refresh_from_db()
        assert envio.usado_em is not None

    def test_ficheiro_que_nao_chegou_ao_bucket(self, client, professor_user, professor, bucket):
        client.force_login(professor_user)
        envio_id = _pedir(client).json()['id']
        r = client.post(reverse('api-professor-videos'), data={'titulo': 'X', 'arquivo_envio': envio_id}, content_type='application/json')
        assert r.status_code == 400
        assert 'não chegou' in r.json()['detail']
        assert not Video.objects.exists()

    def test_ficheiro_incompleto(self, client, professor_user, professor, bucket):
        client.force_login(professor_user)
        envio = _enviado(bucket, _pedir(client))
        bucket.objetos[envio.chave] = 10
        r = client.post(reverse('api-professor-videos'), data={'titulo': 'X', 'arquivo_envio': envio.id}, content_type='application/json')
        assert 'incompleto' in r.json()['detail']

    def test_nao_se_usa_o_envio_de_outro_nem_duas_vezes(self, client, professor_user, professor, bucket, django_user_model):
        client.force_login(professor_user)
        envio = _enviado(bucket, _pedir(client))
        outro_user = django_user_model.objects.create_user(username='outro', password='x', is_teacher=True)
        Professor.objects.create(user=outro_user, nome_publico='Outro')
        client.force_login(outro_user)
        r = client.post(reverse('api-professor-videos'), data={'titulo': 'X', 'arquivo_envio': envio.id}, content_type='application/json')
        assert r.status_code == 400

        client.force_login(professor_user)
        dados = {'titulo': 'X', 'arquivo_envio': envio.id}
        assert client.post(reverse('api-professor-videos'), data=dados, content_type='application/json').status_code == 201
        assert client.post(reverse('api-professor-videos'), data=dados, content_type='application/json').status_code == 400

    def test_curso_com_aulas_e_recursos_no_bucket(self, client, professor_user, professor, bucket):
        client.force_login(professor_user)
        aulas = [_enviado(bucket, _pedir(client, finalidade='aula', nome=f'a{i}.mp4')) for i in range(2)]
        pdf = _enviado(bucket, _pedir(client, finalidade='recurso_curso', nome='guia.pdf', tipo='application/pdf'))
        r = client.post(
            reverse('api-professor-cursos'),
            data={
                'titulo': 'Curso', 'descricao': 'd',
                'videos_envios': [a.id for a in aulas], 'videos_duracoes': [60, 120],
                'recursos_envios': [pdf.id],
            },
            content_type='application/json',
        )
        assert r.status_code == 201, r.json()
        curso = Curso.objects.get(pk=r.json()['id'])
        videos = list(curso.videos.order_by('ordem'))
        assert [v.arquivo.name for v in videos] == [a.chave for a in aulas]
        assert [v.duracao_segundos for v in videos] == [60, 120]
        recurso = RecursoCurso.objects.get(curso=curso)
        assert recurso.arquivo.name == pdf.chave and recurso.nome == 'guia.pdf'

    def test_aula_com_envio_de_video_avulso_e_recusada(self, client, professor_user, professor, bucket):
        client.force_login(professor_user)
        envio = _enviado(bucket, _pedir(client, finalidade='video'))
        r = client.post(
            reverse('api-professor-cursos'),
            data={'titulo': 'C', 'descricao': 'd', 'videos_envios': [envio.id]},
            content_type='application/json',
        )
        assert r.status_code == 400
        assert not Curso.objects.exists()

    def test_editar_nao_troca_o_video_por_envio(self, client, professor_user, professor, bucket):
        client.force_login(professor_user)
        video = Video.objects.create(professor=professor, titulo='V', url_externa='https://youtu.be/x')
        envio = _enviado(bucket, _pedir(client))
        r = client.patch(
            reverse('api-professor-video-detail', args=[video.id]),
            data={'arquivo_envio': envio.id}, content_type='application/json',
        )
        assert r.status_code == 400


@pytest.mark.django_db
def test_limpeza_apaga_envios_abandonados(professor):
    velho = EnvioDireto.objects.create(
        professor=professor, finalidade='video', chave='videos/velho.mp4', nome='v.mp4', tamanho_bytes=1, tipo_conteudo='video/mp4',
    )
    EnvioDireto.objects.filter(pk=velho.pk).update(criado_em=timezone.now() - timedelta(days=2))
    recente = EnvioDireto.objects.create(
        professor=professor, finalidade='video', chave='videos/recente.mp4', nome='r.mp4', tamanho_bytes=1, tipo_conteudo='video/mp4',
    )
    usado = EnvioDireto.objects.create(
        professor=professor, finalidade='video', chave='videos/usado.mp4', nome='u.mp4', tamanho_bytes=1,
        tipo_conteudo='video/mp4', usado_em=timezone.now(),
    )
    EnvioDireto.objects.filter(pk=usado.pk).update(criado_em=timezone.now() - timedelta(days=2))
    assert envio_direto.limpar_abandonados() == 1
    assert set(EnvioDireto.objects.values_list('pk', flat=True)) == {recente.pk, usado.pk}


@pytest.mark.django_db
def test_seguidores_sao_avisados_ao_publicar(client, professor_user, professor, aluno_user):
    Seguidor.objects.create(professor=professor, utilizador=aluno_user)
    client.force_login(professor_user)
    r = client.post(reverse('api-professor-videos'), data={'titulo': 'Novo', 'url_externa': 'https://youtu.be/x', 'ativo': True}, content_type='application/json')
    assert r.status_code == 201
    assert aluno_user.notificacoes.filter(tipo='lancamento').count() == 1


@pytest.mark.django_db
@override_settings(SEGUNDO_PLANO_SINCRONO=False)
def test_segundo_plano_corre_numa_thread_depois_de_gravar(django_capture_on_commit_callbacks):
    from apps.plataforma.segundo_plano import executar_depois

    feito = threading.Event()
    nomes = []

    def tarefa():
        nomes.append(threading.current_thread().name)
        feito.set()

    with django_capture_on_commit_callbacks(execute=True):
        executar_depois(tarefa)
    assert feito.wait(5)
    assert nomes == ['eyk-segundo-plano']


@pytest.mark.django_db
def test_aulas_com_capas_do_browser_dao_capa_ao_curso(client, professor_user, professor, bucket):
    from django.core.files.uploadedfile import SimpleUploadedFile

    client.force_login(professor_user)
    aula = _enviado(bucket, _pedir(client, finalidade='aula', nome='a.mp4'))
    capa = SimpleUploadedFile('capa.jpg', b'\xff\xd8\xff' + b'0' * 100, content_type='image/jpeg')
    r = client.post(reverse('api-professor-cursos'), data={
        'titulo': 'C', 'descricao': 'd', 'videos_envios': [aula.id], 'videos_duracoes': ['30'], 'videos_capas_0': capa,
    })
    assert r.status_code == 201, r.json()
    curso = Curso.objects.get(pk=r.json()['id'])
    video = curso.videos.get()
    assert video.thumbnail and video.duracao_segundos == 30
    assert curso.thumbnail.name == video.thumbnail.name


def test_regras_cors_do_b2():
    from apps.professores.management.commands.configurar_cors_b2 import regras

    regra = regras(['https://eyk.ao'])[0]
    assert regra['AllowedOrigins'] == ['https://eyk.ao']
    assert 'PUT' in regra['AllowedMethods'] and 'content-type' in regra['AllowedHeaders']
