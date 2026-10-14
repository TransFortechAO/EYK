"""Geração do PDF do certificado de conclusão de curso (reportlab + qrcode)."""
import io

import qrcode
from django.conf import settings
from django.utils import timezone
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from .models import Inscricao

DOURADO = HexColor('#d4a24a')
DOURADO_CLARO = HexColor('#e2b45c')
FUNDO = HexColor('#0a0a0a')
TEXTO = HexColor('#f5f1e8')
TEXTO_SUAVE = HexColor('#a8a29e')

MESES = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]


def url_verificacao(inscricao: Inscricao) -> str:
    return f'{settings.NEXT_PUBLIC_URL}/certificados/{inscricao.codigo_certificado}'


def _data_por_extenso(data) -> str:
    data = timezone.localtime(data) if timezone.is_aware(data) else data
    return f'{data.day} de {MESES[data.month - 1]} de {data.year}'


def _qr_image(texto: str) -> ImageReader:
    qr = qrcode.QRCode(border=1, box_size=8)
    qr.add_data(texto)
    qr.make(fit=True)
    img = qr.make_image(fill_color='#0a0a0a', back_color='#f5f1e8')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return ImageReader(buf)


def _texto_ajustado(c, texto, fonte, tamanho_max, largura_max, tamanho_min=14):
    """Reduz o tamanho da letra até o texto caber numa linha (nomes/títulos longos)."""
    tamanho = tamanho_max
    while tamanho > tamanho_min and c.stringWidth(texto, fonte, tamanho) > largura_max:
        tamanho -= 1
    return tamanho


def gerar_certificado_pdf(inscricao: Inscricao) -> bytes:
    curso = inscricao.curso
    user = inscricao.aluno.profile
    nome_aluno = user.get_display_name() or user.username
    concluido_em = inscricao.concluido_em or timezone.now()

    largura, altura = landscape(A4)
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(largura, altura))
    c.setTitle(f'Certificado · {curso.titulo}')
    c.setAuthor('EYK — Ekola Ya Kelela')

    # Fundo + molduras
    c.setFillColor(FUNDO)
    c.rect(0, 0, largura, altura, stroke=0, fill=1)
    c.setStrokeColor(DOURADO)
    c.setLineWidth(2.5)
    c.rect(28, 28, largura - 56, altura - 56, stroke=1, fill=0)
    c.setLineWidth(0.6)
    c.rect(38, 38, largura - 76, altura - 76, stroke=1, fill=0)

    centro = largura / 2
    margem_texto = 110

    c.setFillColor(DOURADO)
    c.setFont('Times-Bold', 40)
    c.drawCentredString(centro, altura - 110, 'EYK')
    c.setFillColor(TEXTO_SUAVE)
    c.setFont('Helvetica', 10)
    c.drawCentredString(centro, altura - 128, 'EKOLA YA KELELA')

    c.setFillColor(TEXTO)
    c.setFont('Times-Bold', 30)
    c.drawCentredString(centro, altura - 185, 'Certificado de Conclusão')

    c.setFillColor(TEXTO_SUAVE)
    c.setFont('Helvetica', 13)
    c.drawCentredString(centro, altura - 225, 'Certificamos que')

    tamanho = _texto_ajustado(c, nome_aluno, 'Times-BoldItalic', 36, largura - 2 * margem_texto)
    c.setFillColor(DOURADO_CLARO)
    c.setFont('Times-BoldItalic', tamanho)
    c.drawCentredString(centro, altura - 270, nome_aluno)
    c.setStrokeColor(DOURADO)
    c.setLineWidth(0.8)
    c.line(centro - 200, altura - 282, centro + 200, altura - 282)

    c.setFillColor(TEXTO_SUAVE)
    c.setFont('Helvetica', 13)
    c.drawCentredString(centro, altura - 312, 'concluiu com sucesso o curso')

    titulo = curso.titulo
    tamanho = _texto_ajustado(c, titulo, 'Helvetica-Bold', 22, largura - 2 * margem_texto, tamanho_min=12)
    c.setFillColor(TEXTO)
    c.setFont('Helvetica-Bold', tamanho)
    c.drawCentredString(centro, altura - 345, titulo)

    c.setFillColor(TEXTO_SUAVE)
    c.setFont('Helvetica', 12)
    c.drawCentredString(
        centro, altura - 372,
        f'leccionado por {curso.professor.nome_publico}, a {_data_por_extenso(concluido_em)}.',
    )

    # Rodapé: verificação (QR + código) à esquerda, assinatura à direita
    url = url_verificacao(inscricao)
    qr_lado = 78
    c.drawImage(_qr_image(url), 70, 62, width=qr_lado, height=qr_lado)
    c.setFillColor(TEXTO_SUAVE)
    c.setFont('Helvetica', 8)
    c.drawString(160, 112, 'Verifica a autenticidade em:')
    c.setFillColor(TEXTO)
    c.drawString(160, 100, url)
    c.setFillColor(TEXTO_SUAVE)
    c.drawString(160, 86, f'Código: {inscricao.codigo_certificado}')

    c.setStrokeColor(DOURADO)
    c.line(largura - 270, 100, largura - 80, 100)
    c.setFillColor(TEXTO)
    c.setFont('Helvetica-Bold', 11)
    c.drawCentredString(largura - 175, 84, curso.professor.nome_publico)
    c.setFillColor(TEXTO_SUAVE)
    c.setFont('Helvetica', 9)
    c.drawCentredString(largura - 175, 70, 'Professor do curso')

    c.showPage()
    c.save()
    return buf.getvalue()
