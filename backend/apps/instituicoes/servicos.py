import datetime
import logging
import secrets

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from apps.accounts.emails import _link_frontend

from .models import Consentimento, ConviteInstituicao, PerfilAluno, RegistoAuditoria

logger = logging.getLogger(__name__)

VALIDADE_CONVITE_DIAS = 14
# Sem letras e números que se confundem (0/O, 1/I), para se poder ditar o código.
ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
TAMANHO_CODIGO = 12
TAMANHO_CODIGO_PARTILHADO = 8

# Espelho de TEXTO_CONSENTIMENTO (frontend/app/lib/instituicoes/demo.ts).
VERSAO_TEXTO_CONSENTIMENTO = '2026-10.2'
FINALIDADES = {
    'utilizacao': 'Utilização da plataforma',
    'fotografias': 'Fotografias e vídeos na turma',
    'relatorios': 'Relatórios',
    'respostas_video': 'Respostas em vídeo',
}
FINALIDADES_OBRIGATORIAS = ('utilizacao',)

ROTULO_PAPEL = {
    'administrador': 'Administrador',
    'coordenador': 'Coordenador',
    'educador': 'Educador',
    'familia': 'Família ou tutor',
    'aluno': 'Aluno',
}


def gerar_codigo(tamanho: int = TAMANHO_CODIGO) -> str:
    while True:
        codigo = ''.join(secrets.choice(ALFABETO_CODIGO) for _ in range(tamanho))
        if not ConviteInstituicao.objects.filter(codigo=codigo).exists():
            return codigo


def link_do_convite(convite: ConviteInstituicao) -> str:
    return _link_frontend('/instituicao/aderir', codigo=convite.codigo)


def auditar(instituicao, acao: str, detalhe: str, quem: str, origem: str = 'instituicao') -> None:
    RegistoAuditoria.objects.create(instituicao=instituicao, acao=acao, detalhe=detalhe, quem=quem[:200], origem=origem)


def criar_convite_responsavel(instituicao, criado_por) -> ConviteInstituicao:
    """Novo convite de administrador; os pendentes do responsável deixam de valer."""
    instituicao.convites.filter(
        estado=ConviteInstituicao.PENDENTE, papel='administrador', canal='email',
    ).update(estado=ConviteInstituicao.CANCELADO)
    return ConviteInstituicao.objects.create(
        instituicao=instituicao,
        codigo=gerar_codigo(),
        email=instituicao.responsavel_email,
        papel='administrador',
        criado_por=criado_por,
        expira_em=timezone.now() + datetime.timedelta(days=VALIDADE_CONVITE_DIAS),
    )


def _email_sai_mesmo() -> bool:
    """Em desenvolvimento os emails só aparecem no terminal do Django."""
    return 'console' not in settings.EMAIL_BACKEND


def _enviar_convite(convite: ConviteInstituicao, assunto: str, corpo: str) -> bool:
    """Envia sem rebentar o pedido: se falhar, fica o link para o passar à mão.
    Devolve True só se o email saiu para a caixa de correio."""
    try:
        send_mail(assunto, corpo, settings.DEFAULT_FROM_EMAIL, [convite.email])
    except Exception:
        logger.exception('Falha ao enviar o convite %s', convite.pk)
        return False
    convite.email_enviado_em = timezone.now()
    convite.save(update_fields=['email_enviado_em'])
    return _email_sai_mesmo()


def enviar_convite_responsavel(convite: ConviteInstituicao) -> bool:
    instituicao = convite.instituicao
    corpo = (
        f'Olá {instituicao.responsavel_nome},\n\n'
        f'A {instituicao.nome} já tem um espaço na EYK — Ekola Ya Kelela, e foste indicado(a) como '
        'responsável. Com este convite ficas administrador(a) da instituição.\n\n'
        f'Aceita aqui: {link_do_convite(convite)}\n\n'
        f'Se ainda não tens conta, cria-a com este email ({convite.email}): o convite só funciona com ele.\n'
        f'O convite é válido durante {VALIDADE_CONVITE_DIAS} dias e é pessoal; não o reencaminhes.\n\n'
        'Se não esperavas este email, podes ignorá-lo.\n\n'
        'Equipa EYK'
    )
    return _enviar_convite(convite, f'EYK · Convite para administrar {instituicao.nome}', corpo)


def enviar_convite_membro(convite: ConviteInstituicao) -> bool:
    instituicao = convite.instituicao
    validade = max((convite.expira_em - timezone.now()).days, 1)
    corpo = (
        'Olá,\n\n'
        f'A {instituicao.nome} convidou-te para a EYK — Ekola Ya Kelela, como {ROTULO_PAPEL[convite.papel]}.\n\n'
        f'Aceita aqui: {link_do_convite(convite)}\n\n'
        f'Se ainda não tens conta, cria-a com este email ({convite.email}): o convite só funciona com ele.\n'
        f'O convite é válido durante {validade} dias.\n\n'
        'Se não esperavas este email, podes ignorá-lo.\n\n'
        'Equipa EYK'
    )
    return _enviar_convite(convite, f'EYK · Convite da {instituicao.nome}', corpo)


def registar_consentimento(aluno: PerfilAluno, tutor, finalidade: str, aceite: bool, com_apoio: bool = False) -> None:
    """Guarda sempre um registo novo — nunca edita. Sem o consentimento de utilização a
    criança não tem perfil ativo."""
    anterior = (
        Consentimento.objects.filter(aluno=aluno, tutor=tutor, finalidade=finalidade).order_by('-registado_em', '-id')
    ).first()
    if anterior and anterior.aceite == aceite and anterior.versao_texto == VERSAO_TEXTO_CONSENTIMENTO:
        return
    nome = tutor.utilizador.get_display_name()
    Consentimento.objects.create(
        instituicao=aluno.instituicao, aluno=aluno, tutor=tutor, tutor_nome=nome, finalidade=finalidade,
        aceite=aceite, versao_texto=VERSAO_TEXTO_CONSENTIMENTO, com_apoio=com_apoio,
    )
    consequencia = ''
    if finalidade == 'utilizacao':
        if aceite and aluno.estado != PerfilAluno.ATIVO:
            aluno.estado = PerfilAluno.ATIVO
            aluno.save(update_fields=['estado'])
            consequencia = ' O perfil ficou ativo.'
        elif not aceite and aluno.estado == PerfilAluno.ATIVO:
            aluno.estado = PerfilAluno.RETIRADO
            aluno.save(update_fields=['estado'])
            consequencia = ' A criança saiu dos relatórios e o perfil ficou inativo.'
    decisao = 'aceite' if aceite else ('retirado' if anterior else 'recusado')
    auditar(
        aluno.instituicao, 'consentimento_alterado',
        f'{aluno.nome} — {FINALIDADES.get(finalidade, finalidade)}: {decisao}.{consequencia}', f'{nome} (tutor)',
    )
