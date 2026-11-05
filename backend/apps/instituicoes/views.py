from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import ConviteInstituicao, Instituicao, MembroInstituicao
from .servicos import criar_convite_responsavel, enviar_convite_responsavel, link_do_convite


def _instituicao_json(i: Instituicao) -> dict:
    return {
        'id': i.id,
        'nome': i.nome,
        'tipo': i.tipo,
        'provincia': i.provincia,
        'estado': i.estado,
        'responsavel': {'nome': i.responsavel_nome, 'email': i.responsavel_email},
        'criadaEm': i.criada_em.isoformat(),
        'quotas': {
            'armazenamentoMb': i.armazenamento_mb,
            'ficheiroMaxMb': i.ficheiro_max_mb,
            'utilizadoresMax': i.utilizadores_max,
        },
    }


def _convite_json(c: ConviteInstituicao | None) -> dict | None:
    if not c:
        return None
    expirado = c.estado == ConviteInstituicao.PENDENTE and c.expira_em < timezone.now()
    return {
        'estado': 'expirado' if expirado else c.estado,
        'email': c.email,
        'expiraEm': c.expira_em.isoformat(),
        'emailEnviadoEm': c.email_enviado_em.isoformat() if c.email_enviado_em else None,
        'link': link_do_convite(c) if c.estado == ConviteInstituicao.PENDENTE and not expirado else None,
    }


def _linha_admin(i: Instituicao) -> dict:
    return {**_instituicao_json(i), 'membros': i.total_membros, 'convite': _convite_json(i.convites.first())}


def _com_totais(qs):
    return qs.annotate(total_membros=Count('membros', filter=Q(membros__estado=MembroInstituicao.ATIVO)))


def _erro(mensagem: str, codigo: int = status.HTTP_400_BAD_REQUEST) -> Response:
    return Response({'detail': mensagem}, status=codigo)


# ── Equipa EYK ───────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAdminUser])
def admin_instituicoes(request):
    if request.method == 'GET':
        return Response([_linha_admin(i) for i in _com_totais(Instituicao.objects.prefetch_related('convites'))])

    dados = request.data
    nome = (dados.get('nome') or '').strip()
    tipo = dados.get('tipo') or 'escola'
    provincia = (dados.get('provincia') or '').strip()
    responsavel_nome = (dados.get('responsavelNome') or '').strip()
    responsavel_email = (dados.get('responsavelEmail') or '').strip()
    if not nome or not provincia or not responsavel_nome:
        return _erro('Indica o nome, a província e o responsável.')
    if tipo not in dict(Instituicao.TIPOS):
        return _erro('Tipo de instituição inválido.')
    try:
        validate_email(responsavel_email)
    except ValidationError:
        return _erro('Email do responsável inválido.')

    with transaction.atomic():
        instituicao = Instituicao.objects.create(
            nome=nome, tipo=tipo, provincia=provincia, responsavel_nome=responsavel_nome,
            responsavel_email=responsavel_email, criada_por=request.user,
        )
        convite = criar_convite_responsavel(instituicao, request.user)
    email_enviado = enviar_convite_responsavel(convite)
    linha = _linha_admin(_com_totais(Instituicao.objects).get(pk=instituicao.pk))
    return Response({**linha, 'emailEnviado': email_enviado}, status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@permission_classes([permissions.IsAdminUser])
def admin_instituicao(request, pk):
    instituicao = get_object_or_404(_com_totais(Instituicao.objects), pk=pk)
    if instituicao.estado == Instituicao.ENCERRADA:
        return _erro('Uma instituição encerrada não pode ser alterada.')
    if 'estado' in request.data:
        if request.data['estado'] not in dict(Instituicao.ESTADOS):
            return _erro('Estado inválido.')
        instituicao.estado = request.data['estado']
    quotas = request.data.get('quotas')
    if quotas is not None:
        try:
            valores = [int(quotas[c]) for c in ('armazenamentoMb', 'ficheiroMaxMb', 'utilizadoresMax')]
        except (KeyError, TypeError, ValueError):
            return _erro('Quotas inválidas.')
        if min(valores) < 1:
            return _erro('As quotas têm de ser maiores do que zero.')
        instituicao.armazenamento_mb, instituicao.ficheiro_max_mb, instituicao.utilizadores_max = valores
    instituicao.save()
    return Response(_linha_admin(instituicao))


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def admin_reenviar_convite(request, pk):
    instituicao = get_object_or_404(_com_totais(Instituicao.objects), pk=pk)
    if instituicao.estado == Instituicao.ENCERRADA:
        return _erro('A instituição está encerrada.')
    if instituicao.membros.filter(papel='administrador', estado=MembroInstituicao.ATIVO).exists():
        return _erro('Esta instituição já tem administrador.')
    convite = criar_convite_responsavel(instituicao, request.user)
    email_enviado = enviar_convite_responsavel(convite)
    return Response({**_linha_admin(instituicao), 'emailEnviado': email_enviado})


# ── Quem recebe o convite ────────────────────────────────────────────────────

def _convite_valido(request, codigo: str):
    """Devolve (convite, None) ou (None, resposta de erro). Só depois de confirmar o
    email da conta se revela a que instituição o convite pertence."""
    convite = (
        ConviteInstituicao.objects.select_related('instituicao').filter(codigo__iexact=(codigo or '').strip()).first()
    )
    if not convite:
        return None, _erro('Código não encontrado. Confirma as letras e os números.', status.HTTP_404_NOT_FOUND)
    if convite.email.lower() != (request.user.email or '').lower():
        return None, _erro(
            'Este convite foi enviado para outro email. Entra com a conta desse email.', status.HTTP_403_FORBIDDEN,
        )
    if convite.estado != ConviteInstituicao.PENDENTE:
        return None, _erro('Este convite já não está ativo.')
    if convite.expira_em < timezone.now():
        return None, _erro('Este convite expirou. Pede um novo à equipa EYK.')
    if convite.instituicao.estado in (Instituicao.SUSPENSA, Instituicao.ENCERRADA):
        return None, _erro('A instituição não está a aceitar novos membros.')
    return convite, None


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def consultar_convite(request, codigo):
    convite, erro = _convite_valido(request, codigo)
    if erro:
        return erro
    return Response({
        'instituicao': convite.instituicao.nome,
        'papel': convite.papel,
        'jaMembro': convite.instituicao.membros.filter(
            utilizador=request.user, estado=MembroInstituicao.ATIVO,
        ).exists(),
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def aceitar_convite(request, codigo):
    with transaction.atomic():
        convite, erro = _convite_valido(request, codigo)
        if erro:
            return erro
        # Dois cliques seguidos não podem aceitar o mesmo convite duas vezes.
        convite = ConviteInstituicao.objects.select_for_update().select_related('instituicao').get(pk=convite.pk)
        if convite.estado != ConviteInstituicao.PENDENTE:
            return _erro('Este convite já não está ativo.')
        MembroInstituicao.objects.update_or_create(
            instituicao=convite.instituicao, utilizador=request.user,
            defaults={'papel': convite.papel, 'estado': MembroInstituicao.ATIVO},
        )
        convite.estado = ConviteInstituicao.ACEITE
        convite.aceite_por = request.user
        convite.aceite_em = timezone.now()
        convite.save(update_fields=['estado', 'aceite_por', 'aceite_em'])
        instituicao = convite.instituicao
        if instituicao.estado == Instituicao.PREPARACAO:
            instituicao.estado = Instituicao.ATIVA
            instituicao.save(update_fields=['estado'])
    return Response({'instituicaoId': instituicao.id, 'instituicao': instituicao.nome, 'papel': convite.papel})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def minhas_pertencas(request):
    """As instituições ativas a que esta conta pertence."""
    membros = MembroInstituicao.objects.select_related('instituicao').filter(
        utilizador=request.user, estado=MembroInstituicao.ATIVO, instituicao__estado=Instituicao.ATIVA,
    )
    return Response([
        {
            'instituicao': _instituicao_json(m.instituicao),
            'membro': {'id': m.id, 'papel': m.papel, 'desde': m.desde.isoformat()},
        }
        for m in membros
    ])
