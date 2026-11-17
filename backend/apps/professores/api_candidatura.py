"""A candidatura do próprio: completar o formulário de competências, juntar documentos e
submeter. A decisão é da equipa EYK (Fase 2)."""
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.validators import URLValidator
from django.db import transaction
from django.urls import reverse
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.notificacoes import notificar
from apps.instituicoes.armazenamento import categoria_de, servir

from .candidaturas import EDITAVEIS, TransicaoInvalida, mudar_estado
from .conduta import VERSAO as CONDUTA_VERSAO
from .models import CandidaturaProfessor, DocumentoCandidatura

MAX_DOCUMENTOS = 10
MAX_MB = 200
CAMPOS = {'area': 100, 'telefone': 30, 'apresentacao': 1000, 'experiencia': 4000}


def _erro(mensagem: str, codigo=status.HTTP_400_BAD_REQUEST):
    return Response({'detail': mensagem}, status=codigo)


def _url_valido(valor: str) -> bool:
    try:
        URLValidator(schemes=['http', 'https'])(valor)
        return True
    except ValidationError:
        return False


def _documento_json(d: DocumentoCandidatura) -> dict:
    return {
        'id': d.id,
        'tipo': d.tipo,
        'titulo': d.titulo,
        'nome': d.nome_ficheiro or None,
        'tamanhoBytes': d.tamanho_bytes,
        'link': d.link or None,
        # O ficheiro só sai por aqui, depois de verificar quem pede.
        'url': reverse('candidatura-documento', args=[d.id]) if d.ficheiro else None,
    }


def candidatura_json(c: CandidaturaProfessor) -> dict:
    return {
        'estado': c.estado,
        'nome': c.nome,
        'email': c.email,
        'telefone': c.telefone,
        'area': c.area,
        'apresentacao': c.apresentacao,
        'tipoQualificacao': c.tipo_qualificacao or None,
        'experiencia': c.experiencia,
        'portefolioUrl': c.portefolio_url,
        'mensagem': c.mensagem_decisao or None,
        'submetidaEm': c.submetida_em.isoformat() if c.submetida_em else None,
        'referencias': c.referencias or [],
        'condutaVersao': c.conduta_versao or None,
        'editavel': c.estado in EDITAVEIS,
        'documentos': [_documento_json(d) for d in c.documentos.all()],
    }


def _minha(request) -> CandidaturaProfessor | None:
    return CandidaturaProfessor.objects.filter(user=request.user).prefetch_related('documentos').first()


def _exigir_editavel(c: CandidaturaProfessor | None):
    if not c:
        return _erro('Não tens uma candidatura a professor.', status.HTTP_404_NOT_FOUND)
    if c.estado not in EDITAVEIS:
        return _erro('A candidatura já foi enviada. Aguarda a decisão da equipa EYK.')
    return None


@api_view(['GET', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def minha_candidatura(request):
    c = _minha(request)
    if request.method == 'GET':
        return Response({'candidatura': candidatura_json(c) if c else None})

    if (recusa := _exigir_editavel(c)):
        return recusa
    d = request.data
    for campo, maximo in CAMPOS.items():
        if campo in d:
            valor = (d.get(campo) or '').strip()
            if len(valor) > maximo:
                return _erro(f'O campo «{campo}» tem no máximo {maximo} caracteres.')
            setattr(c, campo, valor)
    if 'tipoQualificacao' in d:
        tipo = d.get('tipoQualificacao') or ''
        if tipo not in ('', 'formal', 'competencia'):
            return _erro('Tipo de qualificação inválido.')
        c.tipo_qualificacao = tipo
    if 'referencias' in d:
        refs = d.get('referencias') or []
        if not isinstance(refs, list) or len(refs) > 2:
            return _erro('Indica no máximo duas referências.')
        limpas = []
        for r in refs:
            nome = (str((r or {}).get('nome') or '')).strip()[:120]
            contacto = (str((r or {}).get('contacto') or '')).strip()[:120]
            relacao = (str((r or {}).get('relacao') or '')).strip()[:120]
            if nome or contacto:
                if not nome or not contacto:
                    return _erro('Cada referência precisa de nome e contacto.')
                limpas.append({'nome': nome, 'contacto': contacto, 'relacao': relacao})
        c.referencias = limpas
    if 'portefolioUrl' in d:
        url = (d.get('portefolioUrl') or '').strip()
        if url and not _url_valido(url):
            return _erro('O link do portefólio não é válido (começa por https://).')
        c.portefolio_url = url
    c.save()
    return Response({'candidatura': candidatura_json(c)})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, JSONParser])
def documentos(request):
    c = _minha(request)
    if (recusa := _exigir_editavel(c)):
        return recusa
    if c.documentos.count() >= MAX_DOCUMENTOS:
        return _erro(f'No máximo {MAX_DOCUMENTOS} documentos.')
    tipo = request.data.get('tipo')
    if tipo not in dict(DocumentoCandidatura.TIPOS):
        return _erro('Escolhe o tipo do documento.')
    titulo = (request.data.get('titulo') or '').strip()[:150]
    enviado = request.FILES.get('ficheiro')
    link = (request.data.get('link') or '').strip()
    if not enviado and not link:
        return _erro('Junta um ficheiro ou um link.')
    if link and not _url_valido(link):
        return _erro('O link não é válido (começa por https://).')
    if enviado:
        if not categoria_de(enviado.name):
            return _erro('Tipo de ficheiro não permitido. Aceitamos PDF, documentos, imagens e vídeos.')
        if enviado.size > MAX_MB * 1024 * 1024:
            return _erro(f'O ficheiro pode ter até {MAX_MB} MB. Para vídeos maiores, junta um link.')
    doc = DocumentoCandidatura.objects.create(
        candidatura=c, tipo=tipo, titulo=titulo, ficheiro=enviado or None, link=link if not enviado else '',
        nome_ficheiro=enviado.name[:255] if enviado else '', tamanho_bytes=enviado.size if enviado else 0,
    )
    return Response(_documento_json(doc), status=status.HTTP_201_CREATED)


@api_view(['GET', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def documento(request, documento_id):
    doc = DocumentoCandidatura.objects.select_related('candidatura').filter(pk=documento_id).first()
    # Só o próprio e a equipa EYK; para os outros, o documento não existe.
    if not doc or (doc.candidatura.user_id != request.user.id and not request.user.is_staff):
        return _erro('Documento não encontrado.', status.HTTP_404_NOT_FOUND)
    if request.method == 'GET':
        if not doc.ficheiro:
            return _erro('Este documento é um link.', status.HTTP_404_NOT_FOUND)
        return servir(request, doc.ficheiro, doc.nome_ficheiro or 'documento')
    if doc.candidatura.user_id != request.user.id:
        return _erro('Só o candidato pode remover os seus documentos.', status.HTTP_403_FORBIDDEN)
    if (recusa := _exigir_editavel(doc.candidatura)):
        return recusa
    if doc.ficheiro:
        doc.ficheiro.delete(save=False)
    doc.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


def _o_que_falta(c: CandidaturaProfessor) -> str | None:
    docs = list(c.documentos.all())
    if not c.area.strip():
        return 'Indica a área em que queres ensinar.'
    if not c.tipo_qualificacao:
        return 'Escolhe o tipo de qualificação: formal ou competência demonstrada.'
    if c.tipo_qualificacao == 'formal' and not any(d.tipo in ('diploma', 'certificado') for d in docs):
        return 'Junta pelo menos um diploma ou certificado.'
    if not any(d.tipo == 'identidade' for d in docs):
        return 'Junta o teu documento de identificação (só a equipa EYK o vê).'
    if not c.referencias:
        return 'Indica pelo menos uma referência (alguém que confirme o teu trabalho).'
    if c.tipo_qualificacao == 'competencia':
        if not c.experiencia.strip():
            return 'Descreve a tua experiência: o que já ensinaste ou fizeste nesta área.'
        # O documento de identificação não é uma evidência de competência.
        if not [d for d in docs if d.tipo != 'identidade'] and not c.portefolio_url:
            return 'Mostra o teu trabalho: junta um portefólio, um vídeo de demonstração ou outra evidência.'
    return None


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def submeter(request):
    c = _minha(request)
    if (recusa := _exigir_editavel(c)):
        return recusa
    if (falta := _o_que_falta(c)):
        return _erro(falta)
    if not request.data.get('aceitarConduta'):
        return _erro('Aceita o código de conduta dos professores para enviar a candidatura.')
    with transaction.atomic():
        c.conduta_versao = CONDUTA_VERSAO
        c.conduta_aceite_em = timezone.now()
        c.save(update_fields=['conduta_versao', 'conduta_aceite_em', 'atualizado_em'])
        try:
            mudar_estado(c, CandidaturaProfessor.SUBMETIDA, request.user, 'Candidatura enviada pelo candidato.')
        except TransicaoInvalida as erro:
            return _erro(str(erro))
        c.submetida_em = timezone.now()
        c.save(update_fields=['submetida_em', 'atualizado_em'])
    # A equipa EYK fica a saber que há uma candidatura para analisar.
    for conta in get_user_model().objects.filter(is_staff=True, is_active=True):
        notificar(
            conta, 'novidade', f'Nova candidatura a professor: {c.nome} ({c.area}).',
            link='/configuracoes/administracao/candidaturas', enviar_por_email=False,
        )
    return Response({'candidatura': candidatura_json(c)})
