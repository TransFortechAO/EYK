import json

from django.contrib.auth import logout
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from django_otp.plugins.otp_totp.models import TOTPDevice

from apps.moderacao.filtro import ConteudoRecusado, verificar_publicacao

from .models import Aluno


def _json(data, status=200):
    return JsonResponse(data, json_dumps_params={'ensure_ascii': False}, status=status)


def _payload(aluno: Aluno) -> dict:
    return {
        'bio': aluno.bio or '',
        'foto': aluno.foto.url if aluno.foto else None,
        'tem2fa': TOTPDevice.objects.filter(user=aluno.profile, confirmed=True).exists(),
    }


@require_GET
def aluno_perfil_get(request):
    if not request.user.is_authenticated:
        return _json({'ok': False, 'error': 'Não autenticado.'}, 401)
    aluno, _ = Aluno.objects.get_or_create(profile=request.user)
    return _json({'ok': True, **_payload(aluno)})


@csrf_exempt
@require_POST
def aluno_perfil_atualizar(request):
    """Aceita JSON (sem ficheiro) ou multipart (com foto)."""
    if not request.user.is_authenticated:
        return _json({'ok': False, 'error': 'Não autenticado.'}, 401)

    aluno, _ = Aluno.objects.get_or_create(profile=request.user)

    if request.content_type and 'multipart/form-data' in request.content_type:
        bio = request.POST.get('bio')
        foto = request.FILES.get('foto')
        if bio is not None:
            aluno.bio = bio
        if foto is not None:
            aluno.foto = foto
    else:
        try:
            body = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return _json({'ok': False, 'error': 'Pedido inválido.'}, 400)
        if 'bio' in body:
            aluno.bio = body.get('bio') or ''

    try:
        verificar_publicacao(request.user, aluno.bio, 'bio')
    except ConteudoRecusado as erro:
        return _json({'ok': False, 'error': erro.mensagem}, erro.status)

    aluno.save()
    return _json({'ok': True, **_payload(aluno)})


@csrf_exempt
@require_POST
def aluno_apagar_conta(request):
    if not request.user.is_authenticated:
        return _json({'ok': False, 'error': 'Não autenticado.'}, 401)

    user = request.user
    logout(request)
    user.delete()
    return _json({'ok': True})
