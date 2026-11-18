"""Envio direto de ficheiros do browser para o bucket (Backblaze B2, pela API S3).

Sem isto, um vídeo fazia browser → Next.js → Django → disco temporário → B2, e o professor
esperava por todas as passagens. Assim: o servidor regista o envio e devolve um link PUT
assinado (válido por pouco tempo, para aquele nome, tipo e tamanho); o browser envia para o
B2; ao criar o vídeo ou o curso, o servidor confirma no B2 que o ficheiro lá está.

Só funciona com a media num bucket S3 (produção). Sem bucket (desenvolvimento), o frontend
continua a enviar o ficheiro pelo servidor, como antes."""
import logging
import os
import re
import uuid
from datetime import timedelta

from django.conf import settings
from django.core.files.storage import default_storage
from django.utils import timezone

from apps.plataforma.servicos import configuracao, limite_aula_bytes, limite_pdf_bytes, limite_video_bytes

from .models import EnvioDireto

logger = logging.getLogger(__name__)

VALIDADE_LINK_SEG = 6 * 60 * 60
# A partir deste tamanho o ficheiro vai em partes, por várias ligações em paralelo: com a
# latência alta (Angola → B2 na Europa), uma só ligação não aproveita a largura de banda,
# e uma falha só obriga a repetir a parte, não o vídeo todo.
LIMIAR_PARTES = 16 * 1024 * 1024
TAMANHO_PARTE = 10 * 1024 * 1024  # o B2 aceita partes a partir de 5 MB
MAX_PARTES = 10_000
# Envios nunca usados (o professor fechou a página a meio) são apagados ao fim disto.
PRAZO_ABANDONO = timedelta(hours=24)

EXT_VIDEO = {'mp4', 'mov', 'webm', 'm4v', 'mkv', 'avi', '3gp'}

# finalidade → (pasta no bucket, extensões aceites, limite em bytes, mensagem do limite)
FINALIDADES = {
    'video': ('videos/', EXT_VIDEO, limite_video_bytes, lambda: f'Cada vídeo pode ter no máximo {configuracao().limite_video_mb}MB.'),
    'aula': ('videos/', EXT_VIDEO, limite_aula_bytes, lambda: f'Cada aula pode ter no máximo {configuracao().limite_aula_mb}MB.'),
    'recurso_curso': ('cursos/recursos/', {'pdf'}, limite_pdf_bytes, lambda: f'O ficheiro deve ter no máximo {configuracao().limite_pdf_mb}MB.'),
    'recurso_video': ('videos/recursos/', {'pdf'}, limite_pdf_bytes, lambda: f'O ficheiro deve ter no máximo {configuracao().limite_pdf_mb}MB.'),
}


class EnvioInvalido(ValueError):
    """A mensagem vai tal e qual para o professor."""


def disponivel() -> bool:
    if not getattr(settings, 'ENVIO_DIRETO', True):
        return False
    try:
        from storages.backends.s3 import S3Storage
    except ImportError:
        return False
    # default_storage é preguiçoso, mas responde a isinstance com a classe real.
    return isinstance(default_storage, S3Storage)


def _cliente():
    return default_storage.connection.meta.client


def _bucket() -> str:
    return default_storage.bucket_name


def _chave_no_bucket(nome: str) -> str:
    """O nome do ficheiro como o S3Storage o guarda (respeita AWS_LOCATION, se houver)."""
    normalizar = getattr(default_storage, '_normalize_name', None)
    return normalizar(nome) if normalizar else nome


def _nome_seguro(nome: str, maximo: int) -> str:
    base, ext = os.path.splitext(os.path.basename(nome or 'ficheiro'))
    base = re.sub(r'[^A-Za-z0-9._-]+', '-', base).strip('-.') or 'ficheiro'
    ext = re.sub(r'[^A-Za-z0-9.]', '', ext.lower())
    return f'{base[: max(1, maximo - len(ext))]}{ext}'


def extensao(nome: str) -> str:
    return os.path.splitext(nome or '')[1].lstrip('.').lower()


def validar(finalidade: str, nome: str, tamanho: int) -> None:
    if finalidade not in FINALIDADES:
        raise EnvioInvalido('Tipo de envio inválido.')
    _pasta, extensoes, limite, mensagem = FINALIDADES[finalidade]
    if extensao(nome) not in extensoes:
        raise EnvioInvalido('Apenas são aceites ficheiros PDF.' if extensoes == {'pdf'} else 'Formato de vídeo não suportado.')
    if tamanho <= 0:
        raise EnvioInvalido('O ficheiro está vazio.')
    if tamanho > limite():
        raise EnvioInvalido(mensagem())


def tamanho_da_parte(tamanho: int) -> int:
    return max(TAMANHO_PARTE, -(-tamanho // MAX_PARTES))


def preparar(professor, finalidade: str, nome: str, tamanho: int, tipo: str) -> tuple[EnvioDireto, dict]:
    """Regista o envio e devolve como o browser o envia: um link PUT, ou (ficheiros
    grandes) um link por parte."""
    validar(finalidade, nome, tamanho)
    pasta = FINALIDADES[finalidade][0]
    prefixo = f'{pasta}{uuid.uuid4().hex[:16]}-'
    # O FileField dos vídeos e recursos guarda até 100 caracteres.
    chave = prefixo + _nome_seguro(nome, 100 - len(prefixo))
    tipo = (tipo or 'application/octet-stream')[:100]
    envio = EnvioDireto.objects.create(
        professor=professor, finalidade=finalidade, chave=chave,
        nome=os.path.basename(nome)[:255], tamanho_bytes=tamanho, tipo_conteudo=tipo,
    )
    if tamanho >= LIMIAR_PARTES:
        return envio, _preparar_partes(envio)
    url = _cliente().generate_presigned_url(
        'put_object',
        Params={
            'Bucket': _bucket(),
            'Key': _chave_no_bucket(chave),
            'ContentType': tipo,
            # Assinado: o B2 recusa um ficheiro com outro tamanho.
            'ContentLength': tamanho,
        },
        ExpiresIn=VALIDADE_LINK_SEG,
    )
    return envio, {'url': url, 'metodo': 'PUT', 'cabecalhos': {'Content-Type': tipo}}


def _preparar_partes(envio: EnvioDireto) -> dict:
    cliente, chave = _cliente(), _chave_no_bucket(envio.chave)
    upload_id = cliente.create_multipart_upload(Bucket=_bucket(), Key=chave, ContentType=envio.tipo_conteudo)['UploadId']
    envio.upload_id = upload_id
    envio.save(update_fields=['upload_id'])
    parte = tamanho_da_parte(envio.tamanho_bytes)
    partes = []
    for numero, inicio in enumerate(range(0, envio.tamanho_bytes, parte), start=1):
        tamanho = min(parte, envio.tamanho_bytes - inicio)
        url = cliente.generate_presigned_url(
            'upload_part',
            Params={
                'Bucket': _bucket(), 'Key': chave, 'UploadId': upload_id,
                'PartNumber': numero, 'ContentLength': tamanho,
            },
            ExpiresIn=VALIDADE_LINK_SEG,
        )
        partes.append({'numero': numero, 'inicio': inicio, 'tamanho': tamanho, 'url': url})
    return {'partes': partes}


def _partes_no_bucket(envio: EnvioDireto) -> dict[int, tuple[str, int]]:
    """Número da parte → (ETag, tamanho), como o B2 as tem (não depende do browser)."""
    cliente, partes, marcador = _cliente(), {}, 0
    while True:
        r = cliente.list_parts(
            Bucket=_bucket(), Key=_chave_no_bucket(envio.chave), UploadId=envio.upload_id,
            MaxParts=1000, PartNumberMarker=marcador,
        )
        for parte in r.get('Parts', []):
            partes[int(parte['PartNumber'])] = (parte['ETag'], int(parte['Size']))
        if not r.get('IsTruncated'):
            return partes
        marcador = int(r['NextPartNumberMarker'])


def concluir(professor, envio_id, partes=None) -> EnvioDireto:
    """Junta as partes que o browser enviou num só ficheiro. Confirma no B2 que estão lá
    todas, com o tamanho combinado."""
    envio = EnvioDireto.objects.filter(pk=envio_id, professor=professor, usado_em__isnull=True).first()
    if not envio or not envio.upload_id:
        raise EnvioInvalido('Envio de ficheiro inválido. Escolhe o ficheiro de novo.')
    parte = tamanho_da_parte(envio.tamanho_bytes)
    esperadas = {
        numero: min(parte, envio.tamanho_bytes - inicio)
        for numero, inicio in enumerate(range(0, envio.tamanho_bytes, parte), start=1)
    }
    try:
        no_bucket = _partes_no_bucket(envio)
    except Exception:
        logger.exception('Não consegui listar as partes do envio %s', envio.pk)
        raise EnvioInvalido(f'Não foi possível confirmar o envio de "{envio.nome}". Tenta de novo.') from None
    if {n: t for n, (_e, t) in no_bucket.items()} != esperadas:
        raise EnvioInvalido(f'O ficheiro "{envio.nome}" chegou incompleto. Tenta enviá-lo de novo.')
    try:
        _cliente().complete_multipart_upload(
            Bucket=_bucket(), Key=_chave_no_bucket(envio.chave), UploadId=envio.upload_id,
            MultipartUpload={'Parts': [{'PartNumber': n, 'ETag': no_bucket[n][0]} for n in sorted(no_bucket)]},
        )
    except Exception:
        logger.exception('O B2 não juntou as partes do envio %s', envio.pk)
        raise EnvioInvalido(f'Não foi possível juntar as partes de "{envio.nome}". Tenta enviá-lo de novo.') from None
    return envio


def _tamanho_no_bucket(chave: str) -> int | None:
    try:
        return int(_cliente().head_object(Bucket=_bucket(), Key=_chave_no_bucket(chave))['ContentLength'])
    except Exception:
        return None


def confirmar(professor, envio_id, finalidade: str) -> EnvioDireto:
    """O envio é deste professor, para isto, ainda não foi usado e o ficheiro está no bucket
    com o tamanho combinado. Marca-o como usado (quem chama está numa transação)."""
    try:
        envio_id = int(envio_id)
    except (TypeError, ValueError):
        raise EnvioInvalido('Envio de ficheiro inválido.') from None
    envio = (
        EnvioDireto.objects.select_for_update()
        .filter(pk=envio_id, professor=professor, finalidade=finalidade, usado_em__isnull=True)
        .first()
    )
    if not envio:
        raise EnvioInvalido('Envio de ficheiro inválido ou já usado. Escolhe o ficheiro de novo.')
    tamanho = _tamanho_no_bucket(envio.chave)
    if tamanho is None:
        raise EnvioInvalido(f'O ficheiro "{envio.nome}" não chegou ao armazenamento. Tenta enviá-lo de novo.')
    if tamanho != envio.tamanho_bytes:
        raise EnvioInvalido(f'O ficheiro "{envio.nome}" chegou incompleto. Tenta enviá-lo de novo.')
    envio.usado_em = timezone.now()
    envio.save(update_fields=['usado_em'])
    return envio


def limpar_abandonados() -> int:
    """Apaga do bucket (e da lista) os envios nunca usados. Devolve quantos."""
    antigos = EnvioDireto.objects.filter(usado_em__isnull=True, criado_em__lt=timezone.now() - PRAZO_ABANDONO)
    total = 0
    for envio in antigos[:500]:
        try:
            if envio.upload_id:
                # Partes de um envio a meio: o B2 guarda-as (e cobra-as) até se abortar.
                try:
                    _cliente().abort_multipart_upload(
                        Bucket=_bucket(), Key=_chave_no_bucket(envio.chave), UploadId=envio.upload_id,
                    )
                except Exception:
                    pass
            default_storage.delete(envio.chave)
        except Exception:
            logger.exception('Não consegui apagar o envio abandonado %s', envio.chave)
            continue
        envio.delete()
        total += 1
    return total
