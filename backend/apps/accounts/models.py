from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    TEMA_CHOICES = [
        ('auto', 'Automático (segue o sistema)'),
        ('claro', 'Claro'),
        ('escuro', 'Escuro'),
    ]

    is_student = models.BooleanField(default=False)
    is_teacher = models.BooleanField(default=False)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    morada = models.CharField(max_length=200, null=True, blank=True)
    perfil_completo = models.BooleanField(default=False)
    email_verificado = models.BooleanField(default=False)
    # Contas criadas por um administrador (professores e outros administradores)
    # nascem com uma senha temporária: no primeiro acesso o frontend obriga a
    # definir uma nova, e o campo volta a False quando a senha muda.
    deve_alterar_senha = models.BooleanField(default=False)
    convidado_por = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='convidados',
        help_text='Utilizador cujo link de convite foi usado para criar esta conta.',
    )

    tema_preferido = models.CharField(max_length=10, choices=TEMA_CHOICES, default='auto')
    notif_email_novidades = models.BooleanField(default=True)
    notif_email_comunidade = models.BooleanField(default=True)
    notif_email_gamificacao = models.BooleanField(default=True)

    # ── Reprodução e acessibilidade ──
    VELOCIDADES = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]
    TAMANHO_TEXTO_CHOICES = [
        ('normal', 'Normal'),
        ('grande', 'Grande'),
        ('muito_grande', 'Muito grande'),
    ]
    velocidade_reproducao = models.FloatField(default=1.0)
    autoplay_proxima_aula = models.BooleanField(default=True)
    retomar_posicao = models.BooleanField(default=True)
    legendas_ativas = models.BooleanField(default=True)
    tamanho_texto = models.CharField(max_length=15, choices=TAMANHO_TEXTO_CHOICES, default='normal')
    reduzir_animacoes = models.BooleanField(default=False)
    alto_contraste = models.BooleanField(default=False)

    # ── Privacidade ──
    VISIBILIDADE_CHOICES = [
        ('todos', 'Toda a gente'),
        ('cursos', 'Só quem está nos mesmos cursos'),
    ]
    perfil_visibilidade = models.CharField(max_length=10, choices=VISIBILIDADE_CHOICES, default='todos')
    aparecer_ranking = models.BooleanField(default=True)
    mostrar_cursos_perfil = models.BooleanField(default=True)
    mostrar_conquistas_perfil = models.BooleanField(default=True)
    mostrar_publicacoes_perfil = models.BooleanField(default=True)

    # ── Moderação ──
    # Distinto de `is_active` (que o admin usa para desativar contas): uma
    # conta suspensa/banida ainda se autentica, mas o login devolve o motivo
    # e o link para contestar, em vez de "palavra-passe errada".
    suspenso_ate = models.DateTimeField(null=True, blank=True)
    banido = models.BooleanField(default=False)
    motivo_sancao = models.TextField(blank=True)

    def __str__(self):
        return self.username

    def get_display_name(self) -> str:
        """Nome para exibição, com a inicial de cada palavra em maiúscula
        (ex: "joão silva" -> "João Silva"), mesmo que o utilizador se tenha
        registado com o nome todo em minúsculas."""
        full = (self.get_full_name() or self.username or '').strip()
        return ' '.join(word.capitalize() for word in full.split())

    @property
    def esta_suspenso(self) -> bool:
        return bool(self.suspenso_ate and self.suspenso_ate > timezone.now())

    @property
    def esta_sancionado(self) -> bool:
        return self.banido or self.esta_suspenso


class Notificacao(models.Model):
    TIPOS = [
        ('novidade', 'Novidade da Plataforma'),
        ('conquista', 'Conquista'),
        ('saque', 'Saque'),
        ('lancamento', 'Lançamento'),
        ('comunidade', 'Comunidade'),
        ('moderacao', 'Moderação'),
    ]
    utilizador = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notificacoes')
    tipo = models.CharField(max_length=20, choices=TIPOS, default='novidade')
    mensagem = models.TextField()
    # Caminho do frontend a abrir ao clicar (ex: "/comunidade?post=3").
    link = models.CharField(max_length=255, blank=True)
    lida = models.BooleanField(default=False)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-criado_em']

    def __str__(self):
        return f'[{self.tipo}] {self.utilizador.username}'


class SessaoAtiva(models.Model):
    """Uma sessão iniciada (um browser/dispositivo), para o utilizador ver onde
    tem sessão aberta e terminar as outras. A sessão em si continua no
    SESSION_ENGINE do Django; aqui ficam só os metadados."""
    utilizador = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessoes_ativas')
    session_key = models.CharField(max_length=40, unique=True)
    dispositivo = models.CharField(max_length=120, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    criada_em = models.DateTimeField(auto_now_add=True)
    ultima_atividade = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-ultima_atividade']

    def __str__(self):
        return f'{self.utilizador.username} · {self.dispositivo}'


class DispositivoConhecido(models.Model):
    """Dispositivos onde o utilizador já iniciou sessão, identificados por um
    cookie de longa duração. Um login num dispositivo desconhecido gera um
    alerta por email."""
    utilizador = models.ForeignKey(User, on_delete=models.CASCADE, related_name='dispositivos')
    identificador = models.CharField(max_length=64)
    descricao = models.CharField(max_length=120, blank=True)
    primeiro_login = models.DateTimeField(auto_now_add=True)
    ultimo_login = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('utilizador', 'identificador')

    def __str__(self):
        return f'{self.utilizador.username} · {self.descricao}'
