import itertools
import json

import pytest

from apps.accounts.models import User
from apps.instituicoes.models import Instituicao, MembroInstituicao

_n = itertools.count(1)


@pytest.fixture
def escola(db):
    return Instituicao.objects.create(
        nome='Escola 123', tipo='escola', provincia='Luanda', estado=Instituicao.ATIVA,
        responsavel_nome='Ana', responsavel_email='ana@escola.ao', canais_aviso=['plataforma', 'email'],
    )


@pytest.fixture
def pessoa(escola):
    """Cria uma conta com o papel dado na escola de teste."""
    def criar(papel: str, instituicao=None) -> MembroInstituicao:
        n = next(_n)
        user = User.objects.create_user(username=f'{papel}{n}', password='SenhaForte123!', email=f'{papel}{n}@escola.ao')
        return MembroInstituicao.objects.create(instituicao=instituicao or escola, utilizador=user, papel=papel)
    return criar


class Cliente:
    """Pedidos autenticados à API da escola de teste."""
    def __init__(self, client, escola):
        self.client, self.escola = client, escola

    def _url(self, caminho):
        return f'/api/instituicoes/srv-{self.escola.pk}/{caminho}'

    def como(self, membro):
        self.client.force_login(membro.utilizador)
        return self

    def get(self, caminho):
        return self.client.get(self._url(caminho))

    def post(self, caminho, dados=None):
        return self.client.post(self._url(caminho), json.dumps(dados or {}), content_type='application/json')

    def patch(self, caminho, dados=None):
        return self.client.patch(self._url(caminho), json.dumps(dados or {}), content_type='application/json')

    def delete(self, caminho):
        return self.client.delete(self._url(caminho))

    def ficheiro(self, caminho, dados):
        return self.client.post(self._url(caminho), dados)


@pytest.fixture
def api(client, escola):
    return Cliente(client, escola)
