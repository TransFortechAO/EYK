import json
from functools import wraps

from django.contrib.admin.views.decorators import staff_member_required
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db.models import Q
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from apps.professores.models import Professor

from .models import User


def _json_response(data, status=200):
    return JsonResponse(data, json_dumps_params={'ensure_ascii': False}, status=status)


def _staff_json(view_func):
    """Wrapper: login_required + staff_required + @csrf_exempt + JSON error if not staff."""
    @csrf_exempt
    @login_required
    @staff_member_required
    def wrapper(request, *args, **kwargs):
        return view_func(request, *args, **kwargs)

    # Decorator order fix: staff_member_required usa HttpResponseRedirect para login.
    # Queremos JSON 403 em vez disso para chamadas JSON. Vamos reimplementar manualmente.
    return wrapper


def _staff_and_json(view_func):
    @csrf_exempt
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return _json_response({'ok': False, 'error': 'Não autenticado.'}, 401)
        if not request.user.is_staff:
            return _json_response({'ok': False, 'error': 'Permissões de administrador necessárias.'}, 403)
        return view_func(request, *args, **kwargs)
    return wrapped


def _parse_body(request):
    try:
        return json.loads(request.body.decode('utf-8') or '{}')
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


# ─────────────────────────── Professores ────────────────────────────────────

@_staff_and_json
@require_GET
def api_listar_professores(request):
    """GET /accounts/api/admin/professores/  →  lista todos os professores"""
    qs = Professor.objects.select_related('user').order_by('-criado_em')
    data = []
    for p in qs:
        data.append({
            'id': p.id,
            'nome_publico': p.nome_publico,
            'area': p.area,
            'bio': p.bio or '',
            'foto': p.foto.url if p.foto else None,
            'ativo': p.ativo,
            'criado_em': p.criado_em.isoformat(),
            'user': {
                'id': p.user.id,
                'username': p.user.username,
                'email': p.user.email,
                'is_active': p.user.is_active,
                'perfil_completo': p.user.perfil_completo,
                'date_joined': p.user.date_joined.isoformat(),
            }
        })
    return _json_response({'ok': True, 'professores': data})


@_staff_and_json
@require_POST
def api_registar_professor(request):
    """POST /accounts/api/admin/professores/  →  cria user professor + perfil"""
    body = _parse_body(request)
    if body is None:
        return _json_response({'ok': False, 'error': 'Corpo JSON inválido.'}, 400)

    username = (body.get('username') or '').strip()
    email = (body.get('email') or '').strip().lower()
    password = body.get('password') or ''
    nome_publico = (body.get('nome_publico') or '').strip()
    area = (body.get('area') or '').strip()

    errors = {}
    if not username:
        errors['username'] = 'O nome de utilizador é obrigatório.'
    elif User.objects.filter(username=username).exists():
        errors['username'] = 'Este nome de utilizador já existe.'

    if not email:
        errors['email'] = 'O email é obrigatório.'
    else:
        try:
            validate_email(email)
        except ValidationError:
            errors['email'] = 'Introduz um email válido.'
        if not errors.get('email') and User.objects.filter(email__iexact=email).exists():
            errors['email'] = 'Este email já está registado.'

    if not password or len(password) < 6:
        errors['password'] = 'A senha temporária deve ter pelo menos 6 caracteres.'

    if not nome_publico:
        errors['nome_publico'] = 'O nome público é obrigatório.'
    if not area:
        errors['area'] = 'A área de atuação é obrigatória.'

    if errors:
        return _json_response({'ok': False, 'error': 'Há campos inválidos.', 'errors': errors}, 400)

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        is_teacher=True,
        perfil_completo=False,
    )
    prof = Professor.objects.create(
        user=user,
        nome_publico=nome_publico,
        area=area,
    )
    return _json_response({
        'ok': True,
        'message': f'Professor "{username}" registado com sucesso.',
        'professor': {
            'id': prof.id,
            'nome_publico': prof.nome_publico,
            'area': prof.area,
            'ativo': prof.ativo,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'is_active': user.is_active,
                'perfil_completo': user.perfil_completo,
                'date_joined': user.date_joined.isoformat(),
            }
        }
    }, 201)


# ─────────────────────────── Utilizadores ───────────────────────────────────

@_staff_and_json
@require_GET
def api_listar_utilizadores(request):
    """
    GET /accounts/api/admin/utilizadores/?q=&tipo=
    tipo ∈ {aluno, professor, staff}  (vazio = todos)
    """
    q = (request.GET.get('q') or '').strip()
    tipo = (request.GET.get('tipo') or '').strip()

    qs = User.objects.all().order_by('-date_joined')

    if q:
        qs = qs.filter(Q(username__icontains=q) | Q(email__icontains=q))

    if tipo == 'aluno':
        qs = qs.filter(is_student=True)
    elif tipo == 'professor':
        qs = qs.filter(is_teacher=True)
    elif tipo == 'staff':
        qs = qs.filter(is_staff=True)

    users = []
    for u in qs:
        users.append({
            'id': u.id,
            'username': u.username,
            'email': u.email or '',
            'is_staff': u.is_staff,
            'is_superuser': u.is_superuser,
            'is_teacher': u.is_teacher,
            'is_student': u.is_student,
            'is_active': u.is_active,
            'perfil_completo': u.perfil_completo,
            'date_joined': u.date_joined.isoformat(),
            'coins': getattr(u, 'coins', 0),
        })

    return _json_response({'ok': True, 'users': users})


@_staff_and_json
@require_POST
def api_toggle_ativo_usuario(request, user_id):
    """POST /accounts/api/admin/usuarios/<id>/toggle/  →  ativa/desativa conta"""
    try:
        target = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return _json_response({'ok': False, 'error': 'Utilizador não encontrado.'}, 404)

    if target == request.user:
        return _json_response({'ok': False, 'error': 'Não podes ativar/desativar a tua própria conta.'}, 400)
    if target.is_staff or target.is_superuser:
        return _json_response({'ok': False, 'error': 'Não é possível ativar/desativar outra conta de administrador.'}, 400)

    target.is_active = not target.is_active
    target.save()
    estado = 'ativada' if target.is_active else 'desativada'
    return _json_response({
        'ok': True,
        'message': f'Conta de "{target.username}" {estado} com sucesso.',
        'is_active': target.is_active,
    })


@_staff_and_json
@require_POST
def api_apagar_usuario(request, user_id):
    """POST /accounts/api/admin/usuarios/<id>/apagar/  →  apaga a conta"""
    try:
        target = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return _json_response({'ok': False, 'error': 'Utilizador não encontrado.'}, 404)

    if target == request.user:
        return _json_response({'ok': False, 'error': 'Não podes apagar a tua própria conta por aqui.'}, 400)
    if target.is_staff or target.is_superuser:
        return _json_response({'ok': False, 'error': 'Não é possível apagar outra conta de administrador.'}, 400)

    username = target.username
    target.delete()
    return _json_response({
        'ok': True,
        'message': f'Utilizador "{username}" apagado com sucesso.',
    })
