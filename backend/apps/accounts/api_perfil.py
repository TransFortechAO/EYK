import base64
import io

import qrcode
from django.contrib.auth import update_session_auth_hash
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from django_otp import match_token
from django_otp.plugins.otp_static.models import StaticDevice, StaticToken
from django_otp.plugins.otp_totp.models import TOTPDevice

from apps.gamificacao.services import processar_atividade_diaria

from .emails import enviar_email_verificacao
from .models import User
from .sessoes import registar_dispositivo
from .views import PRE_2FA_SESSION_KEY, _user_payload, resposta_conta_sancionada


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


# ── Preferências (tema, notificações, reprodução, acessibilidade, privacidade) ─

CAMPOS_BOOLEANOS = (
    'notif_email_novidades', 'notif_email_comunidade', 'notif_email_gamificacao',
    'autoplay_proxima_aula', 'retomar_posicao', 'legendas_ativas',
    'reduzir_animacoes', 'alto_contraste',
    'aparecer_ranking', 'mostrar_cursos_perfil', 'mostrar_conquistas_perfil', 'mostrar_publicacoes_perfil',
)


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

    for campo in CAMPOS_BOOLEANOS:
        if campo in body:
            setattr(user, campo, bool(body.get(campo)))
            update_fields.append(campo)

    if 'velocidade_reproducao' in body:
        try:
            velocidade = float(body.get('velocidade_reproducao'))
        except (TypeError, ValueError):
            velocidade = None
        if velocidade not in User.VELOCIDADES:
            return _json({'ok': False, 'error': 'Velocidade inválida.'}, 400)
        user.velocidade_reproducao = velocidade
        update_fields.append('velocidade_reproducao')

    for campo, choices in (
        ('tamanho_texto', User.TAMANHO_TEXTO_CHOICES),
        ('perfil_visibilidade', User.VISIBILIDADE_CHOICES),
    ):
        if campo in body:
            if body.get(campo) not in dict(choices):
                return _json({'ok': False, 'error': 'Valor inválido.'}, 400)
            setattr(user, campo, body.get(campo))
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


# ── Segurança: alterar email ─────────────────────────────────────────────────

@csrf_exempt
@require_POST
def alterar_email(request):
    """Troca o email da conta — exige a palavra-passe atual, tal como a troca
    de palavra-passe, porque o email é usado para recuperar o acesso à conta."""
    if not request.user.is_authenticated:
        return _json({'ok': False, 'error': 'Não autenticado.'}, 401)

    import json
    try:
        body = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return _json({'ok': False, 'error': 'Pedido inválido.'}, 400)

    senha_atual = body.get('senha_atual') or ''
    novo_email = (body.get('novo_email') or '').strip().lower()

    user = request.user
    if not user.check_password(senha_atual):
        return _json({'ok': False, 'error': 'Palavra-passe incorreta.', 'errors': {'senha_atual': 'Incorreta.'}}, 400)

    try:
        validate_email(novo_email)
    except ValidationError:
        return _json({'ok': False, 'error': 'Email inválido.', 'errors': {'novo_email': 'Inválido.'}}, 400)

    if User.objects.filter(email__iexact=novo_email).exclude(id=user.id).exists():
        return _json(
            {'ok': False, 'error': 'Já existe uma conta com este email.', 'errors': {'novo_email': 'Já em uso.'}}, 400,
        )

    if novo_email == user.email.lower():
        return _json({'ok': False, 'error': 'Esse já é o teu email atual.', 'errors': {'novo_email': 'Sem alterações.'}}, 400)

    user.email = novo_email
    user.email_verificado = False
    user.save(update_fields=['email', 'email_verificado'])
    enviar_email_verificacao(user)

    return _json({'ok': True, 'user': _user_payload(user)})


# ── Segurança: autenticação de dois fatores (2FA) ────────────────────────────

@require_GET
def api_2fa_status(request):
    if not request.user.is_authenticated:
        return _json({'ok': False, 'error': 'Não autenticado.'}, 401)
    ativo = TOTPDevice.objects.filter(user=request.user, confirmed=True).exists()
    restantes = StaticToken.objects.filter(device__user=request.user).count() if ativo else 0
    return _json({'ok': True, 'ativo': ativo, 'codigosRestantes': restantes})


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

    return _json({'ok': True, 'codigosBackup': _gerar_codigos_backup(request.user)})


def _gerar_codigos_backup(user) -> list[str]:
    StaticDevice.objects.filter(user=user).delete()
    static_device = StaticDevice.objects.create(user=user, name='backup')
    codigos = []
    for _ in range(10):
        token = StaticToken.random_token()
        StaticToken.objects.create(device=static_device, token=token)
        codigos.append(token)
    return codigos


@csrf_exempt
@require_POST
def api_2fa_novos_codigos(request):
    """Gera 10 códigos de recuperação novos (os antigos deixam de valer).
    Exige a palavra-passe atual."""
    if not request.user.is_authenticated:
        return _json({'ok': False, 'error': 'Não autenticado.'}, 401)
    import json
    try:
        body = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return _json({'ok': False, 'error': 'Pedido inválido.'}, 400)
    if not request.user.check_password(body.get('senha_atual') or ''):
        return _json({'ok': False, 'error': 'Palavra-passe incorreta.'}, 400)
    if not TOTPDevice.objects.filter(user=request.user, confirmed=True).exists():
        return _json({'ok': False, 'error': 'O 2FA não está ativo nesta conta.'}, 400)
    return _json({'ok': True, 'codigosBackup': _gerar_codigos_backup(request.user)})


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

    if user.esta_sancionado:
        return resposta_conta_sancionada(user)

    from django.contrib.auth import login
    login(request, user)
    processar_atividade_diaria(user)

    response = _json({'ok': True, 'user': _user_payload(user)})
    registar_dispositivo(request, response, user)
    return response


# ── Segurança: sessões ativas ────────────────────────────────────────────────

@require_GET
def api_sessoes(request):
    if not request.user.is_authenticated:
        return _json({'ok': False, 'error': 'Não autenticado.'}, 401)
    from .sessoes import sessoes_do_utilizador

    atual = request.session.session_key
    sessoes = sorted(
        sessoes_do_utilizador(request.user), key=lambda x: (x.session_key != atual, -x.ultima_atividade.timestamp()),
    )
    return _json({'ok': True, 'sessoes': [
        {
            'id': x.id,
            'dispositivo': x.dispositivo or 'Dispositivo desconhecido',
            'ip': x.ip,
            'criadaEm': x.criada_em.isoformat(),
            'ultimaAtividade': x.ultima_atividade.isoformat(),
            'atual': x.session_key == atual,
        }
        for x in sessoes
    ]})


@csrf_exempt
@require_POST
def api_sessao_terminar(request, sessao_id):
    if not request.user.is_authenticated:
        return _json({'ok': False, 'error': 'Não autenticado.'}, 401)
    from .models import SessaoAtiva
    from .sessoes import terminar_sessao

    sessao = SessaoAtiva.objects.filter(id=sessao_id, utilizador=request.user).first()
    if not sessao:
        return _json({'ok': False, 'error': 'Sessão não encontrada.'}, 404)
    if sessao.session_key == request.session.session_key:
        return _json({'ok': False, 'error': 'Para terminar esta sessão, usa "Terminar sessão".'}, 400)
    terminar_sessao(sessao)
    return _json({'ok': True})


@csrf_exempt
@require_POST
def api_sessoes_terminar_outras(request):
    if not request.user.is_authenticated:
        return _json({'ok': False, 'error': 'Não autenticado.'}, 401)
    from .sessoes import terminar_sessoes

    total = terminar_sessoes(request.user, exceto_chave=request.session.session_key)
    return _json({'ok': True, 'terminadas': total})


# ── Privacidade: exportar os meus dados ──────────────────────────────────────

@require_GET
def api_exportar_dados(request):
    """Todos os dados pessoais do utilizador num JSON descarregável (direito
    de acesso — Lei n.º 22/11 de Proteção de Dados Pessoais)."""
    if not request.user.is_authenticated:
        return _json({'ok': False, 'error': 'Não autenticado.'}, 401)
    from .rate_limit import excedeu_limite

    if excedeu_limite(f'exportar-dados:{request.user.pk}', 5, 60 * 60):
        return _json({'ok': False, 'error': 'Já exportaste os teus dados várias vezes. Tenta daqui a uma hora.'}, 429)

    import json

    from django.http import HttpResponse
    from django.utils import timezone

    from .exportacao import exportar_dados

    dados = exportar_dados(request.user)
    response = HttpResponse(
        json.dumps(dados, ensure_ascii=False, indent=2, default=str),
        content_type='application/json; charset=utf-8',
    )
    nome = f'eyk-dados-{request.user.username}-{timezone.localdate():%Y-%m-%d}.json'
    response['Content-Disposition'] = f'attachment; filename="{nome}"'
    return response
