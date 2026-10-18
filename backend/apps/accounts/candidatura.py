"""Candidatura pública a professor — fluxo sem intervenção humana:

1. A pessoa preenche "Quero ser professor" (nome, email, …).
2. Recebe um email com um link (válido 3 dias, de uso único).
3. No link escolhe a sua palavra-passe: a conta de professor é criada, o email
   fica confirmado e a sessão é iniciada.

Ainda sem limites para novos professores — o tratamento de abusos vem depois
(as candidaturas ficam guardadas e visíveis no admin do Django).
"""
import json
import re
import secrets
import time

from django.contrib.auth import authenticate, login
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from apps.gamificacao.services import processar_atividade_diaria
from apps.professores.models import CandidaturaProfessor, Professor

from .emails import candidatura_do_token, enviar_email_candidatura
from .models import User
from .rate_limit import excedeu_limite, ip_do_pedido
from .sessoes import registar_dispositivo
from .views import _user_payload

LIMITE_APRESENTACAO = 1000


def _json(dados, status=200):
    return JsonResponse(dados, status=status)


def _corpo(request):
    try:
        corpo = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return None
    return corpo if isinstance(corpo, dict) else None


def gerar_username(email: str) -> str:
    """Nome de utilizador livre a partir da parte local do email
    (ex.: ana.silva@x.com → ana_silva, ana_silva2, …). O login também aceita o
    email, por isso a pessoa raramente precisa dele."""
    base = re.sub(r'[^a-z0-9_]+', '_', email.split('@')[0].lower()).strip('_')[:24] or 'professor'
    if len(base) < 3:
        base = f'{base}_prof'
    candidato = base
    n = 1
    while User.objects.filter(username__iexact=candidato).exists():
        n += 1
        candidato = f'{base}{n}'
    return candidato


@csrf_exempt
@require_POST
def candidatura_enviar(request):
    """POST /accounts/auth/professor/candidatura/ — guarda o pedido e envia o email."""
    corpo = _corpo(request)
    if corpo is None:
        return _json({'ok': False, 'error': 'Pedido inválido.'}, 400)

    nome = (corpo.get('nome') or '').strip()
    email = (corpo.get('email') or '').strip().lower()
    telefone = (corpo.get('telefone') or '').strip()
    area = (corpo.get('area') or '').strip()
    apresentacao = (corpo.get('apresentacao') or '').strip()

    erros = {}
    if len(nome) < 3:
        erros['nome'] = 'Indica o teu nome completo.'
    elif len(nome) > 120:
        erros['nome'] = 'O nome é demasiado longo.'
    try:
        validate_email(email)
    except ValidationError:
        erros['email'] = 'Introduz um email válido.'
    if len(telefone) > 30:
        erros['telefone'] = 'O telefone é demasiado longo.'
    if len(area) > 100:
        erros['area'] = 'A área é demasiado longa.'
    if len(apresentacao) > LIMITE_APRESENTACAO:
        erros['apresentacao'] = f'Máximo de {LIMITE_APRESENTACAO} caracteres.'
    if erros:
        return _json({'ok': False, 'error': next(iter(erros.values())), 'errors': erros}, 400)

    # Travão contra spam e contra usar o formulário para encher caixas de email.
    if (excedeu_limite(f'candidatura-ip:{ip_do_pedido(request)}', 10, 3600)
            or excedeu_limite(f'candidatura-email:{email}', 3, 3600)):
        return _json({'ok': False, 'error': 'Demasiadas tentativas. Tenta novamente daqui a pouco.'}, 429)

    if User.objects.filter(email__iexact=email).exists():
        return _json({
            'ok': False,
            'error': 'Já existe uma conta com este email. Entra na plataforma ou recupera a palavra-passe.',
        }, 400)

    # Um pedido ainda por concluir com o mesmo email é atualizado e reenviado.
    candidatura = CandidaturaProfessor.objects.filter(email__iexact=email, concluida_em__isnull=True).first()
    if candidatura is None:
        candidatura = CandidaturaProfessor(email=email)
    candidatura.nome = nome
    candidatura.telefone = telefone
    candidatura.area = area
    candidatura.apresentacao = apresentacao
    candidatura.save()

    if not enviar_email_candidatura(candidatura):
        return _json({'ok': False, 'error': 'Não foi possível enviar o email agora. Tenta novamente daqui a pouco.'}, 503)
    return _json({'ok': True, 'email': email})


@csrf_exempt
@require_POST
def candidatura_validar(request):
    """POST /accounts/auth/professor/candidatura/validar/ — o link ainda vale?"""
    corpo = _corpo(request)
    candidatura = candidatura_do_token((corpo or {}).get('token') or '')
    if candidatura is None:
        return _json({'ok': False, 'error': 'Link inválido ou expirado.'}, 400)
    return _json({'ok': True, 'nome': candidatura.nome, 'email': candidatura.email})


@csrf_exempt
@require_POST
def candidatura_concluir(request):
    """POST /accounts/auth/professor/candidatura/concluir/ — cria a conta de professor."""
    corpo = _corpo(request)
    if corpo is None:
        return _json({'ok': False, 'error': 'Pedido inválido.'}, 400)

    if excedeu_limite(f'candidatura-concluir:{ip_do_pedido(request)}', 20, 3600):
        return _json({'ok': False, 'error': 'Demasiadas tentativas. Tenta novamente daqui a pouco.'}, 429)

    candidatura = candidatura_do_token(corpo.get('token') or '')
    if candidatura is None:
        return _json({'ok': False, 'error': 'Link inválido ou expirado.'}, 400)

    password = corpo.get('password') or ''
    try:
        validate_password(password)
    except ValidationError as e:
        return _json({'ok': False, 'error': e.messages[0]}, 400)

    if User.objects.filter(email__iexact=candidatura.email).exists():
        return _json({'ok': False, 'error': 'Já existe uma conta com este email.'}, 400)

    user = None
    for _ in range(5):  # o nome livre pode ser tomado entre a escolha e a gravação
        username = gerar_username(candidatura.email)
        try:
            with transaction.atomic():
                user = User.objects.create_user(
                    username=username,
                    email=candidatura.email,
                    password=password,
                    first_name=candidatura.nome[:150],
                    phone_number=candidatura.telefone[:20] or None,
                    is_teacher=True,
                    email_verificado=True,  # chegou aqui pelo link enviado para este email
                    perfil_completo=False,
                )
                Professor.objects.create(
                    user=user,
                    nome_publico=candidatura.nome[:150],
                    area=candidatura.area,
                    bio=candidatura.apresentacao,
                )
                candidatura.user = user
                candidatura.concluida_em = timezone.now()
                candidatura.save(update_fields=['user', 'concluida_em', 'atualizado_em'])
            break
        except IntegrityError:
            user = None
    if user is None:
        return _json({'ok': False, 'error': 'Não foi possível criar a conta. Tenta novamente.'}, 500)

    autenticado = authenticate(username=user.username, password=password)
    if autenticado is None:
        return _json({'ok': True, 'user': None})
    login(request, autenticado)
    processar_atividade_diaria(autenticado)

    resposta = _json({'ok': True, 'user': _user_payload(autenticado)})
    registar_dispositivo(request, resposta, autenticado)
    return resposta
