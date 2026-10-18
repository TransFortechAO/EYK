import hashlib
import json
import time

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from django_otp.plugins.otp_totp.models import TOTPDevice

from apps.gamificacao.services import creditar_moedas, processar_atividade_diaria, verificar_badges

from .emails import (
    enviar_email_recuperacao,
    enviar_email_verificacao,
    utilizador_do_token_recuperacao,
    utilizador_do_token_verificacao,
)
from .forms import UserRegisterForm
from .models import User
from .rate_limit import excedeu_limite, ip_do_pedido
from .sessoes import registar_dispositivo

PRE_2FA_SESSION_KEY = 'pre_2fa_user_id'
REENVIO_VERIFICACAO_SESSION_KEY = 'verificacao_email_enviada_em'
REENVIO_VERIFICACAO_INTERVALO_SEGUNDOS = 60

# Recuperação de palavra-passe: por IP (trava quem tenta muitos emails) e por
# email (trava quem bombardeia a caixa de correio de alguém a partir de
# vários IPs). O limite por email conta mesmo que a conta não exista, para a
# resposta não revelar que emails estão registados.
RESET_MAX_POR_IP = 5
RESET_JANELA_IP_SEGUNDOS = 15 * 60
RESET_MAX_POR_EMAIL = 3
RESET_JANELA_EMAIL_SEGUNDOS = 60 * 60


# ── Endpoints JSON para o frontend Next.js (Autenticação) ───────────────────

@require_GET
def auth_csrf(request):
    """Devolve o token CSRF necessário para requests POST autenticados."""
    return JsonResponse({'csrfToken': get_token(request)})


@csrf_exempt
@require_POST
def auth_login_json(request):
    """Login via JSON (para o Next.js). Devolve o utilizador + define cookie de sessão."""
    try:
        body = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'Pedido inválido.'}, status=400)

    identificador = (body.get('username') or '').strip()
    password = body.get('password') or ''

    if not identificador or not password:
        return JsonResponse(
            {'ok': False, 'error': 'Credenciais em falta.'}, status=400,
        )

    username = identificador
    if '@' in identificador:
        # Permite entrar com o email em vez do nome de utilizador. Só resolve
        # quando o email identifica exatamente UM utilizador — com mais do
        # que um (contas antigas sem unicidade garantida), cai para tentar
        # autenticar o valor tal como foi escrito, que falha de forma segura.
        candidatos = list(User.objects.filter(email__iexact=identificador)[:2])
        if len(candidatos) == 1:
            username = candidatos[0].username

    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse(
            {'ok': False, 'error': 'Nome de utilizador ou palavra-passe errados.'}, status=401,
        )

    if user.esta_sancionado:
        return resposta_conta_sancionada(user)

    if TOTPDevice.objects.filter(user=user, confirmed=True).exists():
        request.session[PRE_2FA_SESSION_KEY] = user.id
        return JsonResponse({'ok': False, 'requires2fa': True})

    login(request, user)
    processar_atividade_diaria(user)

    response = JsonResponse({
        'ok': True,
        'user': _user_payload(user),
    })
    registar_dispositivo(request, response, user)
    return response


def resposta_conta_sancionada(user: User) -> JsonResponse:
    """403 com o motivo da suspensão/banimento e o link para contestar —
    mostrado na página de login em vez de "palavra-passe errada"."""
    from django.utils import timezone

    from apps.moderacao.servicos import token_contestacao, ultima_sancao_ativa

    acao = ultima_sancao_ativa(user)
    if user.banido:
        mensagem = 'A tua conta foi banida por violar as regras da comunidade.'
    else:
        ate = timezone.localtime(user.suspenso_ate).strftime('%d/%m/%Y às %H:%M')
        mensagem = f'A tua conta está suspensa até {ate}.'
    return JsonResponse({
        'ok': False,
        'codigo': 'conta_banida' if user.banido else 'conta_suspensa',
        'error': mensagem,
        'motivo': user.motivo_sancao,
        'ate': user.suspenso_ate.isoformat() if not user.banido and user.suspenso_ate else None,
        'tokenContestacao': token_contestacao(acao) if acao else None,
    }, status=403)


@csrf_exempt
@require_POST
def auth_register_json(request):
    """Registo via JSON (para o Next.js). Cria a conta, autentica a sessão e devolve o utilizador.

    Reaproveita o UserRegisterForm (mesmas regras de validação do registo antigo),
    mapeando o único `password` recebido para password1/password2 do form —
    a confirmação já é validada no lado do cliente antes deste pedido chegar.
    """
    try:
        body = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'Pedido inválido.'}, status=400)

    username = (body.get('username') or '').strip()
    email = (body.get('email') or '').strip()
    password = body.get('password') or ''
    ref = (body.get('ref') or '').strip()

    if not username or not email or not password:
        return JsonResponse(
            {'ok': False, 'error': 'Preenche todos os campos.'}, status=400,
        )

    form = UserRegisterForm(data={
        'username': username,
        'email': email,
        'password1': password,
        'password2': password,
    })

    if not form.is_valid():
        # Devolve a primeira mensagem de erro do form (username/email duplicados,
        # password fraca, etc.).
        primeiro_erro = next(iter(form.errors.values()))[0]
        return JsonResponse({'ok': False, 'error': primeiro_erro}, status=400)

    user = form.save()
    enviar_email_verificacao(user)

    if ref and ref != username:
        referrer = User.objects.filter(username=ref).first()
        if referrer:
            user.convidado_por = referrer
            user.save(update_fields=['convidado_por'])
            creditar_moedas(referrer, 200, 'indicacao_amigo')
            verificar_badges(referrer)

    user = authenticate(username=username, password=password)
    if user is None:
        # Não devia acontecer (acabámos de criar a conta), mas por segurança.
        return JsonResponse(
            {'ok': False, 'error': 'Conta criada, mas falha ao iniciar sessão. Tenta entrar manualmente.'},
            status=500,
        )

    login(request, user)
    processar_atividade_diaria(user)
    request.session[REENVIO_VERIFICACAO_SESSION_KEY] = time.time()

    response = JsonResponse({
        'ok': True,
        'user': _user_payload(user),
    })
    registar_dispositivo(request, response, user)
    return response


@csrf_exempt
@require_POST
def auth_logout_json(request):
    """Logout via JSON: destrói sessão e limpa cookies."""
    logout(request)
    response = JsonResponse({'ok': True})
    response.delete_cookie(settings.SESSION_COOKIE_NAME)
    response.delete_cookie('csrftoken')
    return response


def _ler_json(request):
    try:
        return json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return None


@csrf_exempt
@require_POST
def auth_password_reset(request):
    """Pede um link de recuperação de palavra-passe para o email indicado.

    Responde SEMPRE com sucesso (exista ou não a conta) para não revelar que
    emails estão registados na plataforma.
    """
    body = _ler_json(request)
    if body is None:
        return JsonResponse({'ok': False, 'error': 'Pedido inválido.'}, status=400)

    email = (body.get('email') or '').strip()
    if not email:
        return JsonResponse({'ok': False, 'error': 'Indica o teu email.'}, status=400)

    limite_ip = excedeu_limite(
        f'reset-senha:ip:{ip_do_pedido(request)}', RESET_MAX_POR_IP, RESET_JANELA_IP_SEGUNDOS,
    )
    limite_email = excedeu_limite(
        # Hash em vez do email em claro: sem dados pessoais nas chaves da cache.
        f'reset-senha:email:{hashlib.sha256(email.lower().encode()).hexdigest()[:32]}',
        RESET_MAX_POR_EMAIL,
        RESET_JANELA_EMAIL_SEGUNDOS,
    )
    if limite_ip or limite_email:
        return JsonResponse(
            {'ok': False, 'error': 'Fizeste demasiados pedidos. Espera um pouco antes de tentar de novo.'},
            status=429,
        )

    for user in User.objects.filter(email__iexact=email, is_active=True):
        if user.has_usable_password():
            enviar_email_recuperacao(user)

    return JsonResponse({'ok': True})


@csrf_exempt
@require_POST
def auth_password_reset_validar(request):
    """Confirma se um link de recuperação (uid + token) ainda é válido, para o
    frontend mostrar logo "link expirado" em vez do formulário."""
    body = _ler_json(request)
    if body is None:
        return JsonResponse({'ok': False, 'error': 'Pedido inválido.'}, status=400)

    user = utilizador_do_token_recuperacao(body.get('uid') or '', body.get('token') or '')
    if user is None:
        return JsonResponse({'ok': False, 'error': 'Este link é inválido ou já expirou.'}, status=400)
    return JsonResponse({'ok': True})


@csrf_exempt
@require_POST
def auth_password_reset_confirmar(request):
    """Define a nova palavra-passe a partir de um link de recuperação válido."""
    body = _ler_json(request)
    if body is None:
        return JsonResponse({'ok': False, 'error': 'Pedido inválido.'}, status=400)

    user = utilizador_do_token_recuperacao(body.get('uid') or '', body.get('token') or '')
    if user is None:
        return JsonResponse({'ok': False, 'error': 'Este link é inválido ou já expirou.'}, status=400)

    password = body.get('password') or ''
    try:
        validate_password(password, user)
    except ValidationError as e:
        return JsonResponse({'ok': False, 'error': e.messages[0]}, status=400)

    user.set_password(password)
    update_fields = ['password']
    if user.deve_alterar_senha:
        # Quem recupera a senha por email já escolheu uma própria.
        user.deve_alterar_senha = False
        update_fields.append('deve_alterar_senha')
    if not user.email_verificado:
        # Abrir o link enviado para o email já prova que o endereço é dele.
        user.email_verificado = True
        update_fields.append('email_verificado')
    user.save(update_fields=update_fields)
    return JsonResponse({'ok': True})


@csrf_exempt
@require_POST
def auth_verificar_email(request):
    """Confirma o email a partir do token do link enviado no registo. Não
    exige sessão — o link pode ser aberto noutro dispositivo."""
    body = _ler_json(request)
    if body is None:
        return JsonResponse({'ok': False, 'error': 'Pedido inválido.'}, status=400)

    user = utilizador_do_token_verificacao(body.get('token') or '')
    if user is None:
        return JsonResponse({'ok': False, 'error': 'Este link é inválido ou já expirou.'}, status=400)

    if not user.email_verificado:
        user.email_verificado = True
        user.save(update_fields=['email_verificado'])
    return JsonResponse({'ok': True, 'authenticated': request.user.is_authenticated})


@csrf_exempt
@require_POST
def auth_reenviar_verificacao(request):
    """Reenvia o email de verificação ao utilizador autenticado (no máximo um
    pedido por minuto por sessão, para não servir de canhão de spam)."""
    if not request.user.is_authenticated:
        return JsonResponse({'ok': False, 'error': 'Não autenticado.'}, status=401)

    user = request.user
    if user.email_verificado:
        return JsonResponse({'ok': True, 'jaVerificado': True})
    if not user.email:
        return JsonResponse({'ok': False, 'error': 'A tua conta não tem email associado.'}, status=400)

    ultimo = request.session.get(REENVIO_VERIFICACAO_SESSION_KEY) or 0
    if time.time() - ultimo < REENVIO_VERIFICACAO_INTERVALO_SEGUNDOS:
        return JsonResponse(
            {'ok': False, 'error': 'Acabámos de enviar um email. Espera um minuto antes de pedir outro.'},
            status=429,
        )

    if not enviar_email_verificacao(user):
        return JsonResponse({'ok': False, 'error': 'Não foi possível enviar o email. Tenta mais tarde.'}, status=503)
    request.session[REENVIO_VERIFICACAO_SESSION_KEY] = time.time()
    return JsonResponse({'ok': True})


@require_GET
def auth_me(request):
    """Devolve os dados do utilizador autenticado (ou guest).

    Devolve SEMPRE HTTP 200 para não poluir os logs com "Unauthorized".
    O campo `authenticated` indica se há sessão válida.
    """
    if not request.user.is_authenticated:
        return JsonResponse({
            'ok': True,
            'authenticated': False,
            'user': None,
        })

    # Bug corrigido: `User.eyk_coins`/`User.xp` nunca existiram no modelo —
    # isto devolvia SEMPRE os valores de recurso (2380 moedas, streak 9),
    # mesmo quando a Carteira/Ofensiva reais do utilizador tinham outro
    # saldo. Os dados reais vivem em `user.carteira` e `user.ofensiva`
    # (criadas via `get_or_create` pelos serviços de gamificação).
    try:
        coins = request.user.carteira.saldo
    except Exception:
        coins = 0

    try:
        streak = request.user.ofensiva.dias_atual
    except Exception:
        streak = 0

    payload = _user_payload(request.user)
    payload.setdefault('coins', coins)
    payload.setdefault('streak', streak)
    return JsonResponse({
        'ok': True,
        'authenticated': True,
        'user': payload,
    })


@require_GET
def pesquisar_utilizadores(request):
    """Pesquisa utilizadores por nome/username. Devolve os primeiros 20
    resultados compatíveis, para usar no campo de pesquisa do início."""
    if not request.user.is_authenticated:
        return JsonResponse({'ok': False, 'error': 'Não autenticado.'}, status=401)

    q = (request.GET.get('q') or '').strip()
    if len(q) < 2:
        return JsonResponse({'ok': True, 'utilizadores': []})

    from django.db.models import Q

    users = (
        User.objects.filter(
            Q(username__icontains=q)
            | Q(first_name__icontains=q)
            | Q(last_name__icontains=q)
        )
        .filter(is_active=True, banido=False)
        .exclude(id=request.user.id)
        # Contas de administração nunca devem ser descobríveis por pesquisa
        # pública — só aparecem no painel de administração (que já exige
        # is_staff para aceder), nunca aqui.
        .exclude(Q(is_staff=True) | Q(is_superuser=True))
    )[:20]

    resultados = []
    for u in users:
        is_teacher = getattr(u, 'is_teacher', False)
        foto = None
        if is_teacher:
            from apps.professores.models import Professor
            prof = Professor.objects.filter(user=u).first()
            if prof and prof.foto:
                foto = prof.foto.url
        else:
            from apps.alunos.models import Aluno
            aluno = Aluno.objects.filter(profile=u).first()
            if aluno and aluno.foto:
                foto = aluno.foto.url

        name = u.get_display_name()
        initials = (
            ((u.first_name or u.username or '?')[0])
            + ((u.last_name or '')[0:1] or '')
        ).upper()

        resultados.append({
            'id': u.id,
            'name': name,
            'initials': initials or u.username[0].upper(),
            'username': u.username,
            'isTeacher': is_teacher,
            'foto': foto,
        })

    return JsonResponse({'ok': True, 'utilizadores': resultados})


def _user_payload(user: User) -> dict:
    name = user.get_display_name()
    initials = (
        ((user.first_name or user.username or '?')[0])
        + ((user.last_name or '')[0:1] or '')
    ).upper()

    bio = ''
    foto = None
    if user.is_teacher:
        from apps.professores.models import Professor
        professor = Professor.objects.filter(user=user).first()
        if professor:
            bio = professor.bio or ''
            foto = professor.foto.url if professor.foto else None
    else:
        from apps.alunos.models import Aluno
        aluno = Aluno.objects.filter(profile=user).first()
        if aluno:
            bio = aluno.bio or ''
            foto = aluno.foto.url if aluno.foto else None

    return {
        'id': user.id,
        'name': name,
        'username': user.username,
        'email': user.email,
        'bio': bio,
        'foto': foto,
        'initials': initials or user.username[0].upper(),
        'isTeacher': user.is_teacher if hasattr(user, 'is_teacher') else False,
        'isStudent': user.is_student if hasattr(user, 'is_student') else True,
        'isStaff': bool(user.is_staff),
        'isSuperuser': bool(user.is_superuser),
        'deveAlterarSenha': bool(user.deve_alterar_senha),
        'perfilCompleto': bool(user.perfil_completo),
        'emailVerificado': bool(user.email_verificado),
        'temaPreferido': user.tema_preferido,
        'notifEmailNovidades': bool(user.notif_email_novidades),
        'notifEmailComunidade': bool(user.notif_email_comunidade),
        'notifEmailGamificacao': bool(user.notif_email_gamificacao),
        'preferencias': {
            'velocidadeReproducao': user.velocidade_reproducao,
            'autoplayProximaAula': user.autoplay_proxima_aula,
            'retomarPosicao': user.retomar_posicao,
            'legendasAtivas': user.legendas_ativas,
            'tamanhoTexto': user.tamanho_texto,
            'reduzirAnimacoes': user.reduzir_animacoes,
            'altoContraste': user.alto_contraste,
        },
        'privacidade': {
            'perfilVisibilidade': user.perfil_visibilidade,
            'aparecerRanking': user.aparecer_ranking,
            'mostrarCursos': user.mostrar_cursos_perfil,
            'mostrarConquistas': user.mostrar_conquistas_perfil,
            'mostrarPublicacoes': user.mostrar_publicacoes_perfil,
        },
    }
