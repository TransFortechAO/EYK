from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .acesso import Recusa, sid
from .models import ConviteInstituicao, Instituicao, MembroInstituicao, PedidoAdesao
from .servicos import (
    FINALIDADES,
    FINALIDADES_OBRIGATORIAS,
    auditar,
    criar_convite_responsavel,
    enviar_convite_responsavel,
    link_do_convite,
    registar_consentimento,
)
from .views_escola import adicionar_membro, instituicao_json, membro_json


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
    convite = next((c for c in i.convites.all() if c.papel == 'administrador' and c.canal == 'email'), None)
    return {**instituicao_json(i), 'membros': i.total_membros, 'convite': _convite_json(convite)}


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
            responsavel_email=responsavel_email, criada_por=request.user, canais_aviso=['plataforma', 'email'],
        )
        convite = criar_convite_responsavel(instituicao, request.user)
        auditar(
            instituicao, 'instituicao_criada', f'Espaço criado; convite de administrador para {responsavel_email}.',
            'Equipa EYK', 'equipa_eyk',
        )
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
        antes = instituicao.estado
        instituicao.estado = request.data['estado']
        auditar(
            instituicao, 'instituicao_estado', f'Estado: {antes} → {instituicao.estado}.', 'Equipa EYK', 'equipa_eyk',
        )
    quotas = request.data.get('quotas')
    if quotas is not None:
        try:
            valores = [int(quotas[c]) for c in ('armazenamentoMb', 'ficheiroMaxMb', 'utilizadoresMax')]
        except (KeyError, TypeError, ValueError):
            return _erro('Quotas inválidas.')
        if min(valores) < 1:
            return _erro('As quotas têm de ser maiores do que zero.')
        instituicao.armazenamento_mb, instituicao.ficheiro_max_mb, instituicao.utilizadores_max = valores
        auditar(
            instituicao, 'quotas_alteradas',
            f'Armazenamento {valores[0]} MB · ficheiro {valores[1]} MB · {valores[2]} utilizadores.',
            'Equipa EYK', 'equipa_eyk',
        )
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

def _convite_valido(request, codigo: str) -> ConviteInstituicao:
    """Só depois de confirmar o email da conta se revela a que instituição o convite pertence."""
    convite = (
        ConviteInstituicao.objects.select_related('instituicao', 'grupo', 'aluno')
        .filter(codigo__iexact=(codigo or '').strip())
        .first()
    )
    if not convite:
        raise Recusa('Código não encontrado. Confirma as letras e os números.', status.HTTP_404_NOT_FOUND)
    # O convite por email é pessoal; os códigos partilháveis servem a quem os receber.
    if convite.canal == 'email' and convite.email.lower() != (request.user.email or '').lower():
        raise Recusa('Este convite foi enviado para outro email. Entra com a conta desse email.', status.HTTP_403_FORBIDDEN)
    if convite.estado != ConviteInstituicao.PENDENTE:
        raise Recusa('Este convite já não está ativo.')
    if convite.expira_em < timezone.now():
        raise Recusa('Este convite expirou. Pede um novo à instituição.')
    if convite.usos >= convite.usos_max:
        raise Recusa('Este código já atingiu o número máximo de utilizações.')
    if convite.instituicao.estado in (Instituicao.SUSPENSA, Instituicao.ENCERRADA):
        raise Recusa('A instituição não está a aceitar novos membros.')
    return convite


def _requer_aprovacao(convite: ConviteInstituicao) -> bool:
    return convite.canal == 'codigo' and convite.instituicao.aprovar_pedidos_por_codigo


def _pede_consentimento(convite: ConviteInstituicao) -> bool:
    return convite.papel == 'familia' and convite.aluno_id is not None


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def consultar_convite(request, codigo):
    convite = _convite_valido(request, codigo)
    return Response({
        'instituicao': convite.instituicao.nome,
        'papel': convite.papel,
        'grupo': convite.grupo.nome if convite.grupo else None,
        'aluno': {'id': sid(convite.aluno_id), 'nome': convite.aluno.nome} if convite.aluno else None,
        'requerAprovacao': _requer_aprovacao(convite),
        'pedeConsentimento': _pede_consentimento(convite),
        'jaMembro': convite.instituicao.membros.filter(
            utilizador=request.user, estado=MembroInstituicao.ATIVO,
        ).exists(),
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def aceitar_convite(request, codigo):
    decisoes = request.data.get('consentimentos') or {}
    with transaction.atomic():
        # Dois cliques seguidos não podem gastar o mesmo convite duas vezes.
        pk = _convite_valido(request, codigo).pk
        ConviteInstituicao.objects.select_for_update().get(pk=pk)
        convite = _convite_valido(request, codigo)
        instituicao = convite.instituicao
        if _pede_consentimento(convite) and not all(decisoes.get(f) for f in FINALIDADES_OBRIGATORIAS):
            raise Recusa('Sem o consentimento de utilização, a criança não pode ter perfil na instituição.')

        ja_pedido = _requer_aprovacao(convite) and instituicao.pedidos_adesao.filter(
            utilizador=request.user, estado=PedidoAdesao.PENDENTE,
        ).exists()
        if ja_pedido:
            return Response({
                'resultado': 'pendente', 'instituicaoId': sid(instituicao.id), 'instituicao': instituicao.nome,
                'papel': convite.papel,
            })

        convite.usos += 1
        if convite.usos >= convite.usos_max and convite.canal != 'codigo':
            convite.estado = ConviteInstituicao.ACEITE
        convite.aceite_por = request.user
        convite.aceite_em = timezone.now()
        convite.save(update_fields=['usos', 'estado', 'aceite_por', 'aceite_em'])

        if _requer_aprovacao(convite):
            PedidoAdesao.objects.create(
                instituicao=instituicao, convite=convite, utilizador=request.user, papel=convite.papel,
                grupo=convite.grupo,
            )
            return Response({
                'resultado': 'pendente', 'instituicaoId': sid(instituicao.id), 'instituicao': instituicao.nome,
                'papel': convite.papel,
            })

        membro = adicionar_membro(instituicao, request.user, convite.papel, convite.grupo)
        if convite.papel == 'administrador' and membro.papel != 'administrador':
            membro.papel = 'administrador'
            membro.save(update_fields=['papel'])
        nome = request.user.get_display_name()
        auditar(instituicao, 'membro_adicionado', f'{nome} aderiu como {convite.papel} (convite {convite.codigo}).', nome)
        if convite.aluno:
            convite.aluno.tutores.add(membro)
            auditar(instituicao, 'vinculo_criado', f'{nome} é agora tutor de {convite.aluno.nome}.', nome)
            com_apoio = bool(request.data.get('comApoio'))
            for finalidade in FINALIDADES:
                registar_consentimento(convite.aluno, membro, finalidade, bool(decisoes.get(finalidade)), com_apoio)
        if instituicao.estado == Instituicao.PREPARACAO and convite.papel == 'administrador':
            instituicao.estado = Instituicao.ATIVA
            instituicao.save(update_fields=['estado'])
    return Response({
        'resultado': 'membro', 'instituicaoId': sid(instituicao.id), 'instituicao': instituicao.nome,
        'papel': membro.papel,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def minhas_pertencas(request):
    """As instituições ativas a que esta conta pertence."""
    membros = list(
        MembroInstituicao.objects.select_related('instituicao', 'utilizador').prefetch_related('grupos').filter(
            utilizador=request.user, estado=MembroInstituicao.ATIVO, instituicao__estado=Instituicao.ATIVA,
        )
    )
    MembroInstituicao.objects.filter(pk__in=[m.pk for m in membros]).update(ultimo_acesso=timezone.now())
    return Response([{'instituicao': instituicao_json(m.instituicao), 'membro': membro_json(m)} for m in membros])
