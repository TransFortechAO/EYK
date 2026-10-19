from django.utils.timesince import timesince
from rest_framework import serializers

from apps.professores.models import ComentarioVideo, Video
from apps.professores.serializers import RecursoVideoSerializer

from .models import AvaliacaoCurso, Categoria, Curso, RecursoCurso


def _tempo_desde(data):
    ts = timesince(data)
    partes = ts.split(', ')
    return 'há ' + partes[0]


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ['id', 'nome']


class RecursoCursoSerializer(serializers.ModelSerializer):
    arquivo_url = serializers.SerializerMethodField()
    tamanho_mb = serializers.ReadOnlyField()

    class Meta:
        model = RecursoCurso
        fields = ['id', 'nome', 'tipo', 'arquivo_url', 'tamanho_bytes', 'tamanho_mb', 'criado_em']
        read_only_fields = ['id', 'tamanho_bytes', 'tamanho_mb', 'criado_em']

    def get_arquivo_url(self, obj):
        # Devolve o caminho relativo (igual às fotos de perfil/thumbnails) — o
        # frontend resolve para absoluto com `mediaUrl()`.
        return obj.arquivo.url if obj.arquivo else None


class CursoVideoSerializer(serializers.ModelSerializer):
    total_likes = serializers.SerializerMethodField()
    assistido = serializers.SerializerMethodField()
    recursos = serializers.SerializerMethodField()
    posicao_segundos = serializers.SerializerMethodField()
    posicao_atualizada_em = serializers.SerializerMethodField()
    tem_legenda = serializers.SerializerMethodField()

    class Meta:
        model = Video
        fields = [
            'id', 'titulo', 'descricao', 'arquivo', 'url_externa', 'thumbnail', 'ordem',
            'duracao_segundos', 'total_likes', 'assistido', 'recursos',
            'posicao_segundos', 'posicao_atualizada_em', 'tem_legenda',
        ]

    def get_tem_legenda(self, obj):
        return bool(obj.legenda)

    def _minha_posicao(self, obj):
        # `minhas_posicoes` vem de um Prefetch(..., to_attr=...) filtrado pelo
        # utilizador no CursoViewSet — sem ele, cai para uma query direta.
        cached = getattr(obj, 'minhas_posicoes', None)
        if cached is not None:
            return cached[0] if cached else None
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        return obj.posicoes.filter(utilizador=request.user).first()

    def get_posicao_segundos(self, obj):
        posicao = self._minha_posicao(obj)
        return posicao.segundos if posicao else 0

    def get_posicao_atualizada_em(self, obj):
        posicao = self._minha_posicao(obj)
        return posicao.atualizado_em.isoformat() if posicao else None

    def get_total_likes(self, obj):
        return obj.total_likes()

    def get_recursos(self, obj):
        # Recurso da própria aula (ex: slides específicos), distinto dos
        # recursos do curso inteiro em CourseSerializer.get_recursos — o
        # player mostra os dois juntos. Usa `.all()` para reaproveitar o
        # prefetch_related('recursos') da queryset de videos_ativos.
        return RecursoVideoSerializer(obj.recursos.all(), many=True, context=self.context).data

    def get_assistido(self, obj):
        """Se o utilizador autenticado já viu esta aula — usado pelo frontend
        para desbloquear a aula seguinte só depois desta ter sido vista."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        # `obj.visualizacoes.all()` em vez de `.filter(...).exists()`: reaproveita
        # o prefetch_related('visualizacoes') da listagem de cursos (CursoViewSet)
        # em vez de disparar uma query extra por aula.
        return any(v.utilizador_id == request.user.id for v in obj.visualizacoes.all())


class CourseSerializer(serializers.ModelSerializer):
    professor_nome = serializers.CharField(source='professor.nome_publico', read_only=True)
    professor_user_id = serializers.IntegerField(source='professor.user_id', read_only=True)
    professor_foto = serializers.SerializerMethodField()
    categoria_nome = serializers.CharField(source='categoria.nome', read_only=True, allow_null=True)
    total_inscritos = serializers.SerializerMethodField()
    total_visualizacoes = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()
    inscrito = serializers.SerializerMethodField()
    sou_o_professor = serializers.SerializerMethodField()
    duracao_total_segundos = serializers.SerializerMethodField()
    videos = serializers.SerializerMethodField()
    recursos = serializers.SerializerMethodField()
    media_avaliacoes = serializers.SerializerMethodField()
    total_avaliacoes = serializers.SerializerMethodField()
    certificado_disponivel = serializers.SerializerMethodField()

    class Meta:
        model = Curso
        fields = '__all__'

    def get_media_avaliacoes(self, obj):
        # `.all()` reaproveita o prefetch_related('avaliacoes') da listagem.
        avaliacoes = obj.avaliacoes.all()
        if not avaliacoes:
            return None
        return round(sum(a.estrelas for a in avaliacoes) / len(avaliacoes), 1)

    def get_total_avaliacoes(self, obj):
        return len(obj.avaliacoes.all())

    def get_certificado_disponivel(self, obj):
        inscricao = self._get_inscricao(obj)
        return bool(inscricao and inscricao.concluido)

    def get_professor_foto(self, obj):
        prof = obj.professor
        return prof.foto.url if prof and prof.foto else None

    def get_recursos(self, obj):
        # Qualquer utilizador autenticado pode ver/descarregar os recursos do
        # curso (ver nota em `apps.cursos.views.curso_recursos`) — por isso
        # aparecem já aqui, prontos a mostrar no player, sem pedido extra.
        return RecursoCursoSerializer(obj.recursos.all(), many=True, context=self.context).data

    def get_total_inscritos(self, obj):
        return obj.total_inscritos()

    def get_total_visualizacoes(self, obj):
        return obj.total_visualizacoes()

    def _videos_ativos(self, obj):
        # `videos_ativos` é preenchido por um `Prefetch(..., to_attr=...)` na
        # queryset do CursoViewSet (ver get_queryset) — evita uma query (e,
        # sem isto, outra igual em get_duracao_total_segundos) por curso.
        # Fora desse contexto (ex: serializer usado a partir de outro sítio
        # com um único curso), cai de novo para a query direta.
        cached = getattr(obj, 'videos_ativos', None)
        if cached is not None:
            return cached
        return list(obj.videos.filter(ativo=True, oculto=False).order_by('ordem', 'criado_em'))

    def get_videos(self, obj):
        return CursoVideoSerializer(self._videos_ativos(obj), many=True, context=self.context).data

    def get_duracao_total_segundos(self, obj):
        return sum(v.duracao_segundos for v in self._videos_ativos(obj))

    def _aluno_atual(self):
        """Resolve o Aluno do utilizador autenticado UMA SÓ VEZ por listagem,
        não uma vez por curso: numa listagem de N cursos, `self.context` é
        partilhado por todas as instâncias deste serializer (ver
        `Serializer.context` → `self.root._context`), por isso o resultado
        fica em cache aqui e as próximas chamadas não repetem a query."""
        if '_aluno_atual' in self.context:
            return self.context['_aluno_atual']

        request = self.context.get('request')
        aluno = None
        if request and request.user.is_authenticated:
            from apps.alunos.models import Aluno
            aluno = Aluno.objects.filter(profile=request.user).first()
        self.context['_aluno_atual'] = aluno
        return aluno

    def _get_inscricao(self, obj):
        aluno = self._aluno_atual()
        if aluno is None:
            return None
        # Percorre `obj.inscricoes.all()` em Python (em vez de `.filter()`,
        # que bypassa sempre a cache) para reaproveitar o prefetch_related
        # da listagem em vez de uma query SQL extra por curso.
        for inscricao in obj.inscricoes.all():
            if inscricao.aluno_id == aluno.id:
                return inscricao
        return None

    def get_progress(self, obj):
        inscricao = self._get_inscricao(obj)
        if inscricao:
            return 100 if inscricao.concluido else 0
        return 0

    def get_inscrito(self, obj):
        return self._get_inscricao(obj) is not None

    def get_sou_o_professor(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.professor.user_id == request.user.id


class VideoSerializer(serializers.ModelSerializer):
    professor_nome = serializers.CharField(source='professor.nome_publico', read_only=True)
    professor_user_id = serializers.IntegerField(source='professor.user_id', read_only=True)
    professor_foto = serializers.SerializerMethodField()
    total_likes = serializers.SerializerMethodField()
    total_visualizacoes = serializers.SerializerMethodField()
    recursos = serializers.SerializerMethodField()
    tem_legenda = serializers.SerializerMethodField()

    class Meta:
        model = Video
        fields = '__all__'

    def get_tem_legenda(self, obj):
        return bool(obj.legenda)

    def get_professor_foto(self, obj):
        prof = obj.professor
        return prof.foto.url if prof and prof.foto else None

    def get_total_likes(self, obj):
        return obj.total_likes()

    def get_total_visualizacoes(self, obj):
        return obj.total_visualizacoes()

    def get_recursos(self, obj):
        # Qualquer utilizador autenticado pode ver/descarregar — ver nota em
        # CourseSerializer.get_recursos.
        return RecursoVideoSerializer(obj.recursos.all(), many=True, context=self.context).data


class AvaliacaoCursoSerializer(serializers.ModelSerializer):
    autor_nome = serializers.SerializerMethodField()
    autor_user_id = serializers.IntegerField(source='aluno.profile_id', read_only=True)
    autor_foto = serializers.SerializerMethodField()
    tempo = serializers.SerializerMethodField()
    minha = serializers.SerializerMethodField()

    class Meta:
        model = AvaliacaoCurso
        fields = [
            'id', 'estrelas', 'comentario', 'autor_nome', 'autor_user_id', 'autor_foto',
            'criado_em', 'atualizado_em', 'tempo', 'minha', 'oculto',
        ]

    def get_autor_nome(self, obj):
        user = obj.aluno.profile
        return user.get_display_name() or user.username

    def get_autor_foto(self, obj):
        return obj.aluno.foto.url if obj.aluno.foto else None

    def get_tempo(self, obj):
        return _tempo_desde(obj.atualizado_em)

    def get_minha(self, obj):
        request = self.context.get('request')
        return bool(request and request.user.is_authenticated and obj.aluno.profile_id == request.user.id)


class ComentarioVideoSerializer(serializers.ModelSerializer):
    autor_nome = serializers.SerializerMethodField()
    autor_initials = serializers.SerializerMethodField()
    autor_foto = serializers.SerializerMethodField()
    tempo = serializers.SerializerMethodField()
    total_likes = serializers.SerializerMethodField()
    liked = serializers.SerializerMethodField()
    pode_editar = serializers.SerializerMethodField()
    pode_apagar = serializers.SerializerMethodField()
    respostas = serializers.SerializerMethodField()

    class Meta:
        model = ComentarioVideo
        fields = [
            'id', 'autor', 'autor_nome', 'autor_initials', 'autor_foto', 'parent', 'conteudo',
            'criado_em', 'editado_em', 'tempo', 'total_likes', 'liked',
            'pode_editar', 'pode_apagar', 'respostas', 'oculto',
        ]
        read_only_fields = ['id', 'autor', 'criado_em', 'editado_em', 'oculto']

    def get_autor_nome(self, obj):
        return obj.autor.get_display_name()

    def get_autor_initials(self, obj):
        nome = obj.autor.get_display_name()
        partes = nome.strip().split()
        if len(partes) >= 2:
            return (partes[0][0] + partes[-1][0]).upper()
        return nome[:2].upper() if nome else '??'

    def get_autor_foto(self, obj):
        user = obj.autor
        try:
            if getattr(user, 'is_teacher', False):
                from apps.professores.models import Professor
                prof = Professor.objects.filter(user=user).first()
                if prof and prof.foto:
                    return prof.foto.url
            else:
                from apps.alunos.models import Aluno
                aluno = Aluno.objects.filter(profile=user).first()
                if aluno and aluno.foto:
                    return aluno.foto.url
        except Exception:
            pass
        return None

    def get_tempo(self, obj):
        return _tempo_desde(obj.criado_em)

    def get_total_likes(self, obj):
        return obj.total_likes()

    def get_liked(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.reacoes.filter(utilizador=request.user).exists()

    def get_pode_editar(self, obj):
        request = self.context.get('request')
        return bool(request and request.user.is_authenticated and obj.autor_id == request.user.id)

    def get_pode_apagar(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        # Só o autor do comentário ou um super administrador (o dono do vídeo não).
        return obj.autor_id == request.user.id or request.user.is_superuser

    def get_respostas(self, obj):
        if obj.parent_id is not None:
            return []
        respostas = obj.respostas.select_related('autor').order_by('criado_em')
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            from django.db.models import Q
            respostas = respostas.filter(Q(oculto=False) | Q(autor=request.user))
        ocultos = self.context.get('ocultos') or set()
        if ocultos:
            respostas = respostas.exclude(autor_id__in=ocultos)
        return ComentarioVideoSerializer(respostas, many=True, context=self.context).data
