import base64
import io

import qrcode
from django.contrib.auth import update_session_auth_hash
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from django_otp import match_token
from django_otp.plugins.otp_static.models import StaticDevice, StaticToken
from django_otp.plugins.otp_totp.models import TOTPDevice

from apps.gamificacao.services import processar_atividade_diaria

from .models import User
from .views import PRE_2FA_SESSION_KEY, _user_payload


def _json(data, status=200):
    return JsonResponse(data, json_dumps_params={'ensure_ascii': False}, status=status)


# ── Onboarding (completar perfil) ────────────────────────────────────────────

@csrf_exempt
@require_POST
def perfil_completar(request):
    """Marca o perfil do utilizador (aluno ou professor) como completo.

    O preenchimento dos dados em si é feito via PATCH /aluno/api/perfil/
    ou PATCH /api/professor/perfil/; este endpoint só fecha o onboarding.
    """
    if not request.user.is_authenticated:
        return _json({'ok': False, 'error': 'Não autenticado.'}, 401)

    request.user.perfil_completo = True
    request.user.save(update_fields=['perfil_completo'])
    return _json({'ok': True, 'user': _user_payload(request.user)})


# ── Preferências (tema + notificações) ───────────────────────────────────────

@csrf_exempt
@require_POST
def preferencias_atualizar(request):
    if not request.user.is_authenticated:
        return _json({'ok': False, 'error': 'Não autenticado.'}, 401)

    import json
    try:
        body = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return _json({'ok': False, 'error': 'Pedido inválido.'}, 400)

    user = request.user
    update_fields = []

    if 'tema_preferido' in body:
        tema = body.get('tema_preferido')
        if tema not in dict(User.TEMA_CHOICES):
            return _json({'ok': False, 'error': 'Tema inválido.'}, 400)
        user.tema_preferido = tema
        update_fields.append('tema_preferido')

    for campo in ('notif_email_novidades', 'notif_email_comunidade', 'notif_email_gamificacao'):
        if campo in body:
            setattr(user, campo, bool(body.get(campo)))
            update_fields.append(campo)

    if update_fields:
        user.save(update_fields=update_fields)

    return _json({'ok': True, 'user': _user_payload(user)})


# ── Segurança: alterar palavra-passe ─────────────────────────────────────────

@csrf_exempt
@require_POST
def alterar_senha(request):
    if not request.user.is_authenticated:
        return _json({'ok': False, 'error': 'Não autenticado.'}, 401)

    import json
    try:
        body = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return _json({'ok': False, 'error': 'Pedido inválido.'}, 400)

    senha_atual = body.get('senha_atual') or ''
    nova_senha = body.get('nova_senha') or ''

    user = request.user
    if not user.check_password(senha_atual):
        return _json({'ok': False, 'error': 'Palavra-passe atual incorreta.', 'errors': {'senha_atual': 'Incorreta.'}}, 400)
    if len(nova_senha) < 8:
        return _json({'ok': False, 'error': 'A nova palavra-passe deve ter pelo menos 8 caracteres.', 'errors': {'nova_senha': 'Mínimo de 8 caracteres.'}}, 400)

    user.set_password(nova_senha)
    user.save(update_fields=['password'])
    update_session_auth_hash(request, user)  # mantém a sessão válida após trocar a senha

    return _json({'ok': True})


# ── Segurança: autenticação de dois fatores (2FA) ────────────────────────────

@require_GET
def api_2fa_status(request):
    if not request.user.is_authenticated:
        return _json({'ok': False, 'error': 'Não autenticado.'}, 401)
    ativo = TOTPDevice.objects.filter(user=request.user, confirmed=True).exists()
    return _json({'ok': True, 'ativo': ativo})


@csrf_exempt
@require_POST
def api_2fa_iniciar(request):
    if not request.user.is_authenticated:
        return _json({'ok': False, 'error': 'Não autenticado.'}, 401)

    if TOTPDevice.objects.filter(user=request.user, confirmed=True).exists():
        return _json({'ok': False, 'error': '2FA já está ativo nesta conta.'}, 400)

    TOTPDevice.objects.filter(user=request.user, confirmed=False).delete()
    device = TOTPDevice.objects.create(user=request.user, confirmed=False, name='default')

    qr_img = qrcode.make(device.config_url)
    buffer = io.BytesIO()
    qr_img.save(buffer, format='PNG')
    qr_base64 = base64.b64encode(buffer.getvalue()).decode('ascii')

    return _json({
        'ok': True,
        'qrBase64': qr_base64,
        'secret': base64.b32encode(device.bin_key).decode('utf-8'),
    })


@csrf_exempt
@require_POST
def api_2fa_confirmar(request):
    if not request.user.is_authenticated:
        return _json({'ok': False, 'error': 'Não autenticado.'}, 401)

    import json
    try:
        body = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return _json({'ok': False, 'error': 'Pedido inválido.'}, 400)

    codigo = (body.get('codigo') or '').strip().replace(' ', '')
    device = TOTPDevice.objects.filter(user=request.user, confirmed=False).order_by('-id').first()
    if not device:
        return _json({'ok': False, 'error': 'Nenhuma configuração de 2FA pendente. Inicia o processo novamente.'}, 400)

    if not device.verify_token(codigo):
        return _json({'ok': False, 'error': 'Código inválido. Confirma a hora do teu telemóvel e tenta novamente.'}, 400)

    device.confirmed = True
    device.save()

    StaticDevice.objects.filter(user=request.user).delete()
    static_device = StaticDevice.objects.create(user=request.user, name='backup')
    codigos_backup = []
    for _ in range(10):
        token = StaticToken.random_token()
        StaticToken.objects.create(device=static_device, token=token)
        codigos_backup.append(token)

    return _json({'ok': True, 'codigosBackup': codigos_backup})


@csrf_exempt
@require_POST
def api_2fa_desativar(request):
    if not request.user.is_authenticated:
        return _json({'ok': False, 'error': 'Não autenticado.'}, 401)

    TOTPDevice.objects.filter(user=request.user).delete()
    StaticDevice.objects.filter(user=request.user).delete()
    return _json({'ok': True})


# ── Login: segundo passo do 2FA (JSON) ───────────────────────────────────────

@csrf_exempt
@require_POST
def auth_verificar_2fa_json(request):
    """Completa o login depois do utilizador introduzir o código de 2FA.

    Espera que `auth_login_json` já tenha guardado o utilizador pendente
    em `request.session[PRE_2FA_SESSION_KEY]`.
    """
    import json
    try:
        body = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return _json({'ok': False, 'error': 'Pedido inválido.'}, 400)

    user_id = request.session.get(PRE_2FA_SESSION_KEY)
    if not user_id:
        return _json({'ok': False, 'error': 'Sessão de login expirada. Inicia sessão novamente.'}, 400)

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return _json({'ok': False, 'error': 'Utilizador não encontrado.'}, 404)

    codigo = (body.get('codigo') or '').strip().replace(' ', '')
    device = match_token(user, codigo)
    if not device:
        return _json({'ok': False, 'error': 'Código inválido. Tenta novamente.'}, 400)

    del request.session[PRE_2FA_SESSION_KEY]

    from django.contrib.auth import login
    login(request, user)
    processar_atividade_diaria(user)

    return _json({'ok': True, 'user': _user_payload(user)})
