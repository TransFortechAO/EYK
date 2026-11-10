import datetime

from django.conf import settings
from django.db import models

from apps.instituicoes.armazenamento import storage_privado


class ConfiguracaoPlataforma(models.Model):
    """Definições globais editáveis pelos administradores na própria
    plataforma (em vez de exigirem um deploy). Há uma só linha (pk=1) —
    usar sempre `apps.plataforma.servicos.configuracao()`."""
    AVISO_TIPOS = [
        ('info', 'Informação'),
        ('aviso', 'Aviso'),
        ('manutencao', 'Manutenção'),
    ]

    # Limites de upload (vídeo avulso e vídeo de uma aula de curso)
    limite_video_mb = models.PositiveIntegerField(default=500)
    limite_aula_mb = models.PositiveIntegerField(default=500)
    limite_pdf_mb = models.PositiveIntegerField(default=50)

    # Aviso no topo da app (ex: manutenção agendada)
    aviso_ativo = models.BooleanField(default=False)
    aviso_tipo = models.CharField(max_length=15, choices=AVISO_TIPOS, default='manutencao')
    aviso_mensagem = models.CharField(max_length=300, blank=True)

    # Moderação automática
    denuncias_para_ocultar = models.PositiveSmallIntegerField(
        default=3, help_text='Nº de denúncias (de pessoas diferentes) que ocultam um conteúdo até um admin decidir.',
    )
    avisos_para_suspender = models.PositiveSmallIntegerField(
        default=3, help_text='Nº de avisos que levam a uma suspensão automática.',
    )
    dias_suspensao_automatica = models.PositiveSmallIntegerField(default=7)
    dias_conta_nova = models.PositiveSmallIntegerField(
        default=3, help_text='Durante estes dias (ou até confirmar o email), a conta publica com limites e sem links.',
    )

    # Lembrete diário de ofensiva (enviado pelo agendador — Celery beat)
    lembrete_ofensiva_ativo = models.BooleanField(default=True)
    lembrete_ofensiva_hora = models.TimeField(default=datetime.time(18, 0), help_text='Hora de Luanda.')

    # Estado do agendador. Escrito só com `.update()` (não mexe em
    # `atualizado_em`, que serve de "versão" do aviso no topo da app).
    lembrete_ofensiva_ultimo_dia = models.DateField(null=True, blank=True)
    lembrete_ofensiva_ultimo_envio = models.DateTimeField(null=True, blank=True)
    lembrete_ofensiva_ultimo_total = models.PositiveIntegerField(default=0)
    agendador_ultimo_ciclo = models.DateTimeField(null=True, blank=True)

    atualizado_em = models.DateTimeField(auto_now=True)
    atualizado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+',
    )

    class Meta:
        verbose_name = 'Configuração da plataforma'
        verbose_name_plural = 'Configuração da plataforma'

    def __str__(self):
        return 'Configuração da plataforma'


class Anuncio(models.Model):
    """Anúncio ("Novidade") enviado pelos administradores a todos os
    utilizadores — notificação na app e, para quem quer, email. O envio
    corre em segundo plano (Celery), já ou à hora agendada."""
    ESTADOS = [
        ('agendado', 'Agendado'),
        ('pendente', 'Na fila'),
        ('a_enviar', 'A enviar'),
        ('enviado', 'Enviado'),
        ('falhou', 'Falhou'),
    ]

    titulo = models.CharField(max_length=150)
    mensagem = models.TextField()
    link = models.CharField(max_length=255, blank=True)
    enviar_email = models.BooleanField(default=False)
    agendado_para = models.DateTimeField(null=True, blank=True)
    estado = models.CharField(max_length=10, choices=ESTADOS, default='pendente')
    autor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    total_destinatarios = models.PositiveIntegerField(default=0)
    total_emails = models.PositiveIntegerField(default=0)
    criado_em = models.DateTimeField(auto_now_add=True)
    enviado_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-criado_em']

    def __str__(self):
        return self.titulo


class GestoLGA(models.Model):
    """Gesto de Língua Gestual Angolana em vídeo curto (1–2 s, em loop), mostrado
    junto às palavras da plataforma (menus, botões, saudações).
    Só aparece aos utilizadores depois de `validado` — os gestos têm de ser gravados
    e confirmados por pessoas surdas que usam LGA (ver docs/lga-icones-palavras.md)."""
    palavra = models.CharField(max_length=60, unique=True, help_text='Palavra como aparece na plataforma, ex: "Início".')
    video = models.FileField(upload_to='gestos/')
    validado = models.BooleanField(default=False)
    validado_por = models.CharField(
        max_length=120, blank=True, help_text='Quem validou o gesto (pessoa surda / associação).',
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['palavra']

    def __str__(self):
        return self.palavra


class AmostraLGA(models.Model):
    """Amostras voluntárias para investigação de reconhecimento de LGA.

    Os vídeos usam o armazenamento privado e só ficam disponíveis à própria
    pessoa e à equipa autorizada para revisão. Não são gestos públicos.
    """
    ESTADOS = [
        ('pendente', 'Pendente'),
        ('validada', 'Validada'),
        ('rejeitada', 'Rejeitada'),
    ]

    autor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='amostras_lga')
    palavra = models.CharField(max_length=60)
    variante = models.CharField(max_length=80, blank=True, help_text='Província ou variante regional, se conhecida.')
    video = models.FileField(upload_to='lga-amostras/', storage=storage_privado)
    consentimento_versao = models.CharField(max_length=30)
    consentido_em = models.DateTimeField()
    confirmacao_representante = models.BooleanField(default=False)
    estado = models.CharField(max_length=12, choices=ESTADOS, default='pendente')
    nota_revisao = models.CharField(max_length=500, blank=True)
    revisto_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='amostras_lga_revistas',
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    revisto_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-criado_em']

    def __str__(self):
        return f'{self.palavra} — {self.autor}'


class FonteDatasetLGA(models.Model):
    """Vídeo publicado que o sistema sugeriu e uma pessoa pode curar para o dataset."""
    ESTADOS = [
        ('sugerida', 'Sugerida pelo sistema'),
        ('aprovada', 'Aprovada para o dataset'),
        ('rejeitada', 'Rejeitada'),
        ('retirada', 'Autorização retirada'),
    ]

    video = models.OneToOneField('professores.Video', on_delete=models.CASCADE, related_name='fonte_dataset_lga')
    estado = models.CharField(max_length=12, choices=ESTADOS, default='sugerida', db_index=True)
    pontuacao = models.PositiveSmallIntegerField(default=0)
    motivos = models.JSONField(default=list, blank=True)
    palavra = models.CharField(max_length=60, blank=True, help_text='Rótulo do gesto ou palavra visível no segmento.')
    inicio_segundos = models.PositiveIntegerField(null=True, blank=True)
    fim_segundos = models.PositiveIntegerField(null=True, blank=True)
    nota_revisao = models.CharField(max_length=500, blank=True)
    revisto_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='fontes_dataset_lga_revistas',
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-pontuacao', '-atualizado_em']

    def __str__(self):
        return f'{self.video.titulo} ({self.get_estado_display()})'
