"""Ficheiros privados num bucket (Backblaze B2): sem rede, só a forma dos links."""
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

from django.test import RequestFactory, override_settings

from apps.instituicoes.armazenamento import VALIDADE_LINK_SEG, servir, storage_privado

B2 = {
    'PRIVADO_BUCKET': 'eyk-privado',
    'PRIVADO_ACCESS_KEY_ID': 'chave',
    'PRIVADO_SECRET_ACCESS_KEY': 'segredo',
    'AWS_S3_ENDPOINT_URL': 'https://s3.us-west-004.backblazeb2.com',
    'AWS_S3_REGION_NAME': 'us-west-004',
    # Um domínio público dos cursos não pode valer para o bucket privado.
    'AWS_S3_CUSTOM_DOMAIN': 'media.eyk.ao',
}


def test_link_do_bucket_privado_e_assinado_e_expira():
    with override_settings(**B2):
        url = storage_privado().url('escola-1/anexoescola/v.mp4', expire=VALIDADE_LINK_SEG)
    partes = urlparse(url)
    q = parse_qs(partes.query)
    assert 'media.eyk.ao' not in url
    assert 'eyk-privado' in url and 'backblazeb2.com' in url
    assert q['X-Amz-Algorithm'] == ['AWS4-HMAC-SHA256']
    assert q['X-Amz-Expires'] == [str(VALIDADE_LINK_SEG)]
    assert 'us-west-004' in q['X-Amz-Credential'][0]


def test_servir_redireciona_para_o_link_e_nao_le_o_ficheiro():
    pedidos = {}

    def url(nome, expire, parameters):
        pedidos.update(nome=nome, expire=expire, parameters=parameters)
        return 'https://b2.exemplo/assinado'

    campo = SimpleNamespace(name='a/b.html', storage=SimpleNamespace(url=url))
    with override_settings(PRIVADO_BUCKET='eyk-privado'):
        r = servir(RequestFactory().get('/x', HTTP_RANGE='bytes=0-'), campo, 'b.html')
    assert r.status_code == 302 and r['Location'] == 'https://b2.exemplo/assinado'
    assert r['Cache-Control'] == 'private, no-store'
    assert pedidos['expire'] == VALIDADE_LINK_SEG
    # Um tipo perigoso continua a descarregar, nunca abre como página do site.
    assert pedidos['parameters']['ResponseContentType'] == 'application/octet-stream'
    assert pedidos['parameters']['ResponseContentDisposition'].startswith('attachment')


def test_video_abre_no_browser_com_o_tipo_certo():
    pedidos = {}

    def url(nome, expire, parameters):
        pedidos.update(parameters)
        return 'https://b2.exemplo/v'

    campo = SimpleNamespace(name='v.mp4', storage=SimpleNamespace(url=url))
    with override_settings(PRIVADO_BUCKET='eyk-privado'):
        servir(RequestFactory().get('/x'), campo, 'v.mp4')
    assert pedidos['ResponseContentType'] == 'video/mp4'
    assert pedidos['ResponseContentDisposition'].startswith('inline')
