// Configuração da API para integração com o backend Django
export const API_BASE_URL = (() => {
  // "/" (produção no Render) → caminhos relativos: o Next.js reencaminha
  // /api, /accounts, /media… para o Django (ver next.config.ts).
  const env = process.env.NEXT_PUBLIC_API_URL;
  if (env) return env.replace(/\/$/, '');

  // Sem NEXT_PUBLIC_API_URL definido: deriva o endereço da API a partir de
  // onde o browser está a aceder à app (mesmo host, porta 8000). Isto faz
  // o acesso pela rede local funcionar sem configuração — aceder por
  // http://192.168.x.x:3000 chama automaticamente http://192.168.x.x:8000,
  // em vez de tentar sempre "localhost" (que, visto de outro dispositivo,
  // aponta para esse dispositivo, não para o servidor Django).
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return 'http://localhost:8000';
})();

// Resolve um caminho de media relativo (ex: "/media/videos/x.mp4") devolvido
// pelo Django para um URL absoluto que o browser consegue carregar.
export function mediaUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:/i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// Lê o cookie "csrftoken" diretamente do browser. Importante: o Django roda
// este cookie para um valor novo sempre que a sessão muda (login, logout,
// confirmação de 2FA) — por isso não podemos guardar o token em cache numa
// variável em memória (ficaria desatualizado e todos os POST/PATCH/DELETE
// seguintes falhavam com 403 "CSRF Failed"). Lemos sempre o valor atual.
function readCsrfCookie(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

async function getCsrfToken(): Promise<string> {
  const fromCookie = readCsrfCookie();
  if (fromCookie) return fromCookie;
  // Cookie ainda não existe (primeira visita nesta sessão do browser) — pede
  // ao backend para o definir.
  try {
    const res = await fetch(`${API_BASE_URL}/accounts/auth/csrf/`, {
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.csrfToken) return data.csrfToken;
    }
  } catch {
    /* ignora */
  }
  return readCsrfCookie();
}

/**
 * Função genérica para fazer requisições à API Django.
 */
export async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const startsWithHttp = /^https?:/i.test(endpoint);
  const url = startsWithHttp ? endpoint : `${API_BASE_URL}${endpoint}`;

  const method = (options.method || 'GET').toUpperCase();
  const existingHeaders = options.headers as Record<string, string> | undefined;
  const hasContentTypeHeader =
    !!existingHeaders &&
    Object.keys(existingHeaders).some((k) => k.toLowerCase() === 'content-type');
  const isJSONBody =
    options.body != null && typeof options.body === 'string' && !hasContentTypeHeader;

  const headers: Record<string, string> = {
    ...(isJSONBody ? { 'Content-Type': 'application/json' } : {}),
    ...existingHeaders,
  };

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = await getCsrfToken();
    if (token) headers['X-CSRFToken'] = token;
  }

  const config: RequestInit = {
    ...options,
    method,
    headers,
    credentials: 'include',
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    let msg = `${response.status} ${response.statusText}`;
    let data: unknown = null;
    try {
      data = await response.json();
      const body = data as { error?: unknown; detail?: unknown } | null;
      if (body?.error) msg = `${msg}: ${body.error}`;
      else if (typeof body?.detail === 'string') msg = `${msg}: ${body.detail}`;
    } catch {
      /* body não é JSON */
    }
    const err = new Error(msg) as Error & { status: number; response: Response; data: unknown };
    err.status = response.status;
    err.response = response;
    err.data = data;
    throw err;
  }

  const text = await response.text();
  if (!text) return undefined as unknown as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

/**
 * Mensagem de erro legível para mostrar ao utilizador: usa o `error`/`detail`
 * devolvido pelo Django quando existe, sem o prefixo "403 Forbidden: ".
 */
export function mensagemDeErro(err: unknown, fallback: string): string {
  const data = (err as { data?: { error?: unknown; detail?: unknown } } | null)?.data;
  if (typeof data?.error === 'string' && data.error) return data.error;
  if (typeof data?.detail === 'string' && data.detail) return data.detail;
  return fallback;
}

// --- Tipos de UI (igual aos do mock-data.ts — compatibilidade total) ------------------

export type AuthUser = {
  id: number;
  name: string;
  username: string;
  email: string;
  bio?: string;
  foto?: string | null;
  initials: string;
  isTeacher: boolean;
  isStudent: boolean;
  isStaff: boolean;
  isSuperuser?: boolean;
  deveAlterarSenha?: boolean;
  perfilCompleto?: boolean;
  emailVerificado?: boolean;
  temaPreferido?: 'auto' | 'claro' | 'escuro';
  notifEmailNovidades?: boolean;
  notifEmailComunidade?: boolean;
  notifEmailGamificacao?: boolean;
  preferencias?: PreferenciasUtilizador;
  privacidade?: PrivacidadeUtilizador;
  coins?: number;
  streak?: number;
  level?: number;
  levelProgress?: number;
  nextLevelCoins?: number;
  streakRecord?: number;
};

export type TamanhoTexto = 'normal' | 'grande' | 'muito_grande';

export type PreferenciasUtilizador = {
  velocidadeReproducao: number;
  autoplayProximaAula: boolean;
  retomarPosicao: boolean;
  legendasAtivas: boolean;
  tamanhoTexto: TamanhoTexto;
  reduzirAnimacoes: boolean;
  altoContraste: boolean;
};

export type PrivacidadeUtilizador = {
  perfilVisibilidade: 'todos' | 'cursos';
  aparecerRanking: boolean;
  mostrarCursos: boolean;
  mostrarConquistas: boolean;
  mostrarPublicacoes: boolean;
};

export type Course = {
  id: string;
  title: string;
  category: string;
  teacher: string;
  teacherAvatar: string;
  teacherFoto: string | null;
  teacherUserId: number | null;
  level: "Iniciante" | "Intermédio" | "Avançado";
  durationHours: number;
  durationLabel: string;
  lessons: number;
  students: number;
  progress?: number;
  thumbnail: string;
  publishedAt: string | null;
  recursos: CursoRecurso[];
  /** Média das avaliações (1-5) ou null se ainda ninguém avaliou. */
  rating: number | null;
  ratingCount: number;
  /** O aluno autenticado concluiu o curso e pode descarregar o certificado. */
  certificadoDisponivel: boolean;
};

export type Video = {
  id: string;
  title: string;
  teacher: string;
  teacherFoto: string | null;
  teacherUserId: number | null;
  duration: string;
  views: number;
  daysAgo: number;
  thumbnail: string;
  publishedAt: string | null;
};

export type VideoDetail = {
  id: string;
  title: string;
  description: string;
  teacher: string;
  teacherAvatar: string;
  teacherFoto: string | null;
  professorId: number | null;
  teacherUserId: number | null;
  thumbnail: string;
  fileUrl: string | null;
  externalUrl: string;
  views: number;
  likes: number;
  createdAt: string;
  durationSeconds: number;
  durationLabel: string;
  recursos: CursoRecurso[];
  temLegenda: boolean;
};

export type VideoComment = {
  id: number;
  autorId: number;
  autorNome: string;
  autorInitials: string;
  autorFoto: string | null;
  parentId: number | null;
  conteudo: string;
  criadoEm: string;
  editadoEm: string | null;
  tempo: string;
  likes: number;
  liked: boolean;
  podeEditar: boolean;
  podeApagar: boolean;
  /** Ocultado pela moderação (só o próprio autor o continua a ver). */
  oculto: boolean;
  respostas: VideoComment[];
};

export type CourseVideo = {
  id: number;
  title: string;
  description: string;
  fileUrl: string | null;
  externalUrl: string;
  thumbnail: string | null;
  order: number;
  likes: number;
  durationSeconds: number;
  durationLabel: string;
  /** Se o utilizador autenticado já viu esta aula — usado para desbloquear a próxima. */
  watched: boolean;
  /** Recurso(s) PDF anexado(s) a esta aula em concreto (distinto dos recursos do curso todo). */
  recursos: CursoRecurso[];
  /** Onde o utilizador parou nesta aula ("retomar onde ficaste"), em segundos. */
  positionSeconds: number;
  positionUpdatedAt: string | null;
  temLegenda: boolean;
};

export type PerfilPublico = {
  id: number;
  name: string;
  initials: string;
  isTeacher: boolean;
  membroDesde: string | null;
  souEu: boolean;
  foto: string | null;
  /** O dono só mostra o perfil a quem partilha cursos com ele (ou bloqueou-te). */
  privado: boolean;
  /** Tu bloqueaste este utilizador. */
  bloqueado: boolean;
  nomePublico: string | null;
  bio: string;
  area: string | null;
  seguidores: number | null;
  aSeguir: boolean;
  professorId: number | null;
  totalCursos: number | null;
  totalVideos: number | null;
  cursos: { id: number; titulo: string; thumbnail: string | null; alunos: number; media: number | null }[];
  videos: { id: number; titulo: string; thumbnail: string | null; views: number; duracaoSegundos: number }[];
  cursosConcluidos: number | null;
  listaCursosConcluidos: { cursoId: number; titulo: string; concluidoEm: string | null; certificado: string | null }[] | null;
  conquistas: { id: string; nome: string; descricao: string; icone: string }[] | null;
  nivel: number | null;
  publicacoes: PublicacaoPerfil[] | null;
};

export type PublicacaoPerfil = {
  id: number;
  conteudo: string;
  tempo: string;
  criadoEm: string;
  gostos: number;
  comentarios: number;
  oculto: boolean;
};

export type MeuPerfil = {
  perfil: PerfilPublico;
  conta: { username: string; email: string; emailVerificado: boolean; membroDesde: string | null };
  estatisticas: {
    moedas: number;
    xp: number;
    nivel: number;
    ofensiva: number;
    cursosInscritos: number;
    cursosConcluidos: number;
    publicacoes: number;
    comentarios: number;
  };
  certificados: { cursoId: number; curso: string; professor: string; concluidoEm: string | null; codigo: string }[];
  emCurso: { cursoId: number; curso: string; inscritoEm: string }[];
  publicacoes: PublicacaoPerfil[];
  avaliacoes: { cursoId: number; curso: string; estrelas: number; comentario: string; oculto: boolean; tempo: string }[];
};

export type SessaoAtiva = {
  id: number;
  dispositivo: string;
  ip: string | null;
  criadaEm: string;
  ultimaAtividade: string;
  atual: boolean;
};

export type UtilizadorResumo = { id: number; nome: string; username: string; foto: string | null };

// =================== Moderação ===============================================

export type TipoConteudoDenuncia =
  | 'post' | 'comentario' | 'comentario_video' | 'video' | 'curso' | 'avaliacao' | 'utilizador';

export type MotivoDenuncia = { id: string; label: string };

export type HistoricoModeracao = UtilizadorResumo & {
  avisos: number;
  suspensoes: number;
  denunciasRecebidas: number;
  banido: boolean;
  suspensoAte: string | null;
};

export type ItemFilaModeracao = {
  chave: string;
  tipo: TipoConteudoDenuncia;
  tipoLabel: string;
  objetoId: number;
  existe: boolean;
  oculto: boolean;
  ocultavel: boolean;
  apagavel: boolean;
  conteudo: string;
  link: string | null;
  total: number;
  gravidade: number;
  motivos: { id: string; label: string; total: number }[];
  primeira: string;
  ultima: string;
  descricoes: { motivo: string; descricao: string; denunciante: string; criadaEm: string }[];
  autor: HistoricoModeracao | null;
};

export type DecisaoConteudo = 'manter' | 'ocultar' | 'restaurar' | 'apagar';
export type Sancao = 'aviso' | 'suspensao' | 'banimento';

export type AcaoModeracaoRegisto = {
  id: number;
  tipo: string;
  tipoLabel: string;
  moderador: string;
  automatica: boolean;
  alvo: UtilizadorResumo | null;
  motivo: string;
  conteudoTipo: string | null;
  conteudo: string;
  duracaoDias: number | null;
  revertida: boolean;
  criadaEm: string;
};

export type AcaoPublica = {
  tipo: string;
  tipoLabel: string;
  motivo: string;
  criadaEm: string;
  duracaoDias: number | null;
  conteudo: string;
};

export type ContestacaoAdmin = {
  id: number;
  utilizador: UtilizadorResumo;
  texto: string;
  estado: 'pendente' | 'aceite' | 'recusada';
  resposta: string;
  criadaEm: string;
  acao: AcaoPublica;
};

export type PalavraProibida = { id: number; termo: string; acao: 'bloquear' | 'sinalizar'; acaoLabel: string };

// =================== Plataforma ==============================================

export type ConfigPublica = {
  aviso: { ativo: boolean; tipo: 'info' | 'aviso' | 'manutencao'; mensagem: string; versao: string };
  limites: { videoMb: number; pdfMb: number };
};

export type ConfigAdmin = {
  limite_video_mb: number;
  limite_pdf_mb: number;
  denuncias_para_ocultar: number;
  avisos_para_suspender: number;
  dias_suspensao_automatica: number;
  dias_conta_nova: number;
  aviso_ativo: boolean;
  aviso_tipo: 'info' | 'aviso' | 'manutencao';
  aviso_mensagem: string;
  lembrete_ofensiva_ativo: boolean;
  /** "HH:MM", hora de Luanda. */
  lembrete_ofensiva_hora: string;
  lembrete_ofensiva_ultimo_envio: string | null;
  lembrete_ofensiva_ultimo_total: number;
  /** `imediato`: sem Celery (desenvolvimento) — as tarefas correm no próprio
   * pedido e não há agendador. `ativo`: o beat deu sinal nos últimos 15 min. */
  agendador: { modo: 'imediato' | 'celery'; ultimoCiclo: string | null; ativo: boolean };
  atualizado_em: string | null;
  atualizado_por: string | null;
};

export type Anuncio = {
  id: number;
  titulo: string;
  mensagem: string;
  link: string;
  enviarEmail: boolean;
  estado: 'agendado' | 'pendente' | 'a_enviar' | 'enviado' | 'falhou';
  estadoLabel: string;
  agendadoPara: string | null;
  autor: string | null;
  totalDestinatarios: number;
  totalEmails: number;
  criadoEm: string;
  enviadoEm: string | null;
};

export type CategoriaAdmin = { id: number; nome: string; totalCursos: number };


export type CourseDetail = Course & {
  description: string;
  professorId: number | null;
  inscrito: boolean;
  souOProfessor: boolean;
  videos: CourseVideo[];
};

export type Post = {
  id: string;
  author: string;
  authorId: number | null;
  initials: string;
  authorFoto: string | null;
  timeAgo: string;
  content: string;
  likes: number;
  comments: number;
  liked?: boolean;
  oculto?: boolean;
};

export type Comentario = {
  id: number;
  autorId: number;
  autor_nome: string;
  autor_initials: string;
  autor_foto: string | null;
  parentId: number | null;
  conteudo: string;
  time_ago: string;
  editadoEm: string | null;
  likes: number;
  liked: boolean;
  podeEditar: boolean;
  podeApagar: boolean;
  oculto: boolean;
  respostas: Comentario[];
};

export type Notification = {
  id: string;
  type: "course" | "community" | "gamification" | "system";
  title: string;
  body: string;
  timeAgo: string;
  read?: boolean;
  /** Página a abrir ao clicar (ex: "/comunidade?post=3"). */
  link?: string | null;
};

export type LeaderRow = {
  rank: number;
  userId: number | null;
  name: string;
  initials: string;
  foto?: string | null;
  coins: number;
  streak: number;
  isMe?: boolean;
};

export type ProfessorLeaderRow = {
  rank: number;
  userId: number | null;
  name: string;
  initials: string;
  coins: number;
  isMe?: boolean;
};

export type Badge = {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  progress?: number;
};

export type WalletEntry = {
  id: string;
  label: string;
  delta: number;
  date: string;
};

export type Category = {
  id: number | null;
  nome: string;
};

export type UtilizadorPesquisa = {
  id: number;
  name: string;
  initials: string;
  username: string;
  isTeacher: boolean;
  foto: string | null;
};

export type GamePanel = {
  coins: number;
  xp: number;
  streak: number;
  streakRecord: number;
  level: number;
  levelProgress: number;
  nextLevelXp: number;
  initials: string;
  name: string;
  foto?: string | null;
};

// =================== Tipos ADMIN (Painel de Gestão) ========================

export type AdminProfessorUser = {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  perfil_completo: boolean;
  date_joined: string;
};

export type AdminProfessor = {
  id: number;
  nome_publico: string;
  area: string;
  bio: string;
  foto: string | null;
  ativo: boolean;
  criado_em: string;
  user: AdminProfessorUser;
};

export type AdminUser = {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
  is_superuser: boolean;
  is_teacher: boolean;
  is_student: boolean;
  is_active: boolean;
  perfil_completo: boolean;
  date_joined: string;
  coins: number;
  banido: boolean;
  suspenso_ate: string | null;
  motivo_sancao: string;
};

export type AdminUserTipoFiltro = "" | "aluno" | "professor" | "staff";

export type CriarProfessorPayload = {
  username: string;
  email: string;
  /** Opcional: vazio = o servidor gera uma senha temporária. */
  password?: string;
  nome_publico: string;
  /** Opcional: o professor preenche-a no próprio perfil. */
  area?: string;
};

export type CandidaturaProfessorPayload = {
  nome: string;
  email: string;
  telefone?: string;
  area?: string;
  apresentacao?: string;
};

export type CriarAdministradorPayload = {
  username: string;
  email: string;
  nome?: string;
  /** Opcional: vazio = o servidor gera uma senha temporária. */
  password?: string;
};

/** Resultado da criação de uma conta por um administrador. */
export type ContaCriada = {
  message: string;
  /** False se o email de boas-vindas não pôde ser enviado. */
  email_enviado: boolean;
  /** Só vem quando o email falhou: o admin tem de a passar à pessoa. */
  senha_temporaria?: string;
  username: string;
  email: string;
};

// =================== Tipos: perfil, segurança, professor =====================

export type PerfilAluno = {
  ok: boolean;
  bio: string;
  foto: string | null;
  tem2fa: boolean;
};

export type ProfessorPerfil = {
  id: number;
  nome_publico: string;
  bio: string;
  area: string;
  foto: string | null;
  ativo: boolean;
  criado_em: string;
  username: string;
  email: string;
  tem_2fa: boolean;
  seguidores: number;
};

export type ProfessorCursoVideo = {
  id: number;
  titulo: string;
  arquivo: string | null;
  url_externa: string;
  thumbnail: string | null;
  ordem: number;
  duracao_segundos: number;
  recursos: ProfessorRecurso[];
  oculto: boolean;
  tem_legenda: boolean;
};

export type ProfessorCurso = {
  id: number;
  titulo: string;
  descricao: string;
  categoria: string | null;
  preco: string | null;
  duracao: string | null;
  thumbnail: string | null;
  ativo: boolean;
  publicado_em: string | null;
  criado_em: string;
  atualizado_em: string;
  total_inscritos: number;
  total_visualizacoes: number;
  conclusao_media: number;
  duracao_total_segundos: number;
  videos: ProfessorCursoVideo[];
  recursos: ProfessorRecurso[];
  oculto: boolean;
};

export type CursoRecurso = {
  id: number;
  nome: string;
  tipo: string;
  arquivoUrl: string;
  tamanhoBytes: number;
  tamanhoMb: number;
  criadoEm: string;
};

// Vem direto do backend sem normalização (como o resto de ProfessorCurso/
// ProfessorVideo) — por isso em snake_case, ao contrário de CursoRecurso.
// `arquivo_url` é relativo: resolve com `mediaUrl()` ao usar.
export type ProfessorRecurso = {
  id: number;
  nome: string;
  tipo: string;
  arquivo_url: string | null;
  tamanho_bytes: number;
  tamanho_mb: number;
  criado_em: string;
};

export type ProfessorCursoPayload = {
  titulo: string;
  descricao: string;
  categoria_nome?: string;
  ativo?: boolean;
  thumbnail?: File | null;
};

export type ProfessorVideo = {
  id: number;
  titulo: string;
  descricao: string;
  arquivo: string | null;
  url_externa: string;
  thumbnail: string | null;
  criado_em: string;
  atualizado_em: string;
  ativo: boolean;
  ordem: number;
  total_likes: number;
  total_visualizacoes: number;
  total_comentarios: number;
  duracao_segundos: number;
  recursos: ProfessorRecurso[];
  oculto: boolean;
  tem_legenda: boolean;
};

export type ProfessorVideoPayload = {
  titulo: string;
  descricao?: string;
  url_externa?: string;
  ativo?: boolean;
  arquivo?: File | null;
  thumbnail?: File | null;
};

export type AulaEngajamento = {
  id: number;
  titulo: string;
  ordem: number;
  duracaoSegundos: number;
  totalVisualizacoes: number;
  totalLikes: number;
  totalComentarios: number;
};

export type CursoEngajamento = {
  curso: ProfessorCurso;
  totalInscritos: number;
  totalVisualizacoes: number;
  totalConcluidos: number;
  taxaConclusao: number;
  totalAulas: number;
  totalGostos: number;
  totalComentarios: number;
  visualizadoresUnicos: number;
  mediaVisualizacoesPorAula: number;
  mediaAvaliacoes: number | null;
  totalAvaliacoes: number;
  avaliacoesRecentes: { id: number; aluno: string; estrelas: number; comentario: string; atualizadoEm: string }[];
  aulas: AulaEngajamento[];
  inscricoes: { id: number; aluno: string; inscritoEm: string; concluido: boolean }[];
};

export type AvaliacaoCurso = {
  id: number;
  estrelas: number;
  comentario: string;
  autorNome: string;
  autorUserId: number | null;
  autorFoto: string | null;
  atualizadoEm: string;
  tempo: string;
  minha: boolean;
  oculto: boolean;
};

export type ResumoAvaliacoes = {
  media: number | null;
  total: number;
  /** Nº de avaliações por nº de estrelas ("1".."5"). */
  distribuicao: Record<string, number>;
};

export type AvaliacoesCurso = {
  resumo: ResumoAvaliacoes;
  podeAvaliar: boolean;
  minha: AvaliacaoCurso | null;
  avaliacoes: AvaliacaoCurso[];
};

export type CertificadoVerificado = {
  valido: boolean;
  codigo: string;
  aluno: string;
  curso: string;
  cursoId: number;
  professor: string;
  concluidoEm: string | null;
};

export type SerieSemanal = { semana: string; n: number }[];

export type MetricasPlataforma = {
  geradoEm: string;
  totais: {
    utilizadores: number;
    alunos: number;
    professores: number;
    cursos: number;
    videos: number;
    inscricoes: number;
    conclusoes: number;
    taxaConclusao: number;
    avaliacoes: number;
    mediaAvaliacoes: number | null;
    emailsPorVerificar: number;
  };
  ativos: { hoje: number; semana: number; mes: number; retencao30d: number | null };
  crescimento: { utilizadores: SerieSemanal; inscricoes: SerieSemanal; conclusoes: SerieSemanal };
  coortes: { semana: string; novos: number; ativos7d: number; taxa: number | null }[];
  topCursos: {
    id: number;
    titulo: string;
    professor: string;
    inscritos: number;
    concluidos: number;
    taxaConclusao: number;
    mediaAvaliacoes: number | null;
  }[];
  topVideos: {
    id: number;
    titulo: string;
    professor: string;
    curso: string | null;
    cursoId: number | null;
    views: number;
    espectadores: number;
  }[];
};

export type VideoEngajamento = {
  video: ProfessorVideo;
  totalLikes: number;
  totalDislikes: number;
  totalVisualizacoes: number;
  totalVisualizadoresUnicos: number;
  totalComentarios: number;
  taxaAprovacao: number | null;
  cursoId: number | null;
  outrasAulasDoCurso: AulaEngajamento[];
  reacoes: { id: number; utilizador: number; utilizador_nome: string; tipo: string }[];
};

// --- Tipos Raw (respostas JSON do Django, antes da normalização) ----------------------

type RawProfessor = { nome_publico?: string };

type RawCourse = {
  id?: number | string;
  titulo?: string | null;
  professor_nome?: string | null;
  professor?: RawProfessor | null;
  professor_user_id?: number | null;
  professor_foto?: string | null;
  categoria_nome?: string | null;
  duracao?: number | string | null;
  duracao_total_segundos?: number | null;
  total_inscritos?: number | string | null;
  progress?: number | null;
  thumbnail?: string | null;
  publicado_em?: string | null;
  criado_em?: string | null;
  videos?: RawCourseVideo[] | null;
  recursos?: RawCursoRecurso[] | null;
  media_avaliacoes?: number | null;
  total_avaliacoes?: number | null;
  certificado_disponivel?: boolean | null;
};

type RawVideo = {
  id?: number | string;
  titulo?: string | null;
  professor_nome?: string | null;
  professor_user_id?: number | null;
  professor_foto?: string | null;
  duracao?: string | null;
  duracao_segundos?: number | null;
  total_visualizacoes?: number | string | null;
  criado_em?: string | null;
  thumbnail?: string | null;
};

type RawVideoDetail = RawVideo & {
  descricao?: string | null;
  professor?: number | null;
  arquivo?: string | null;
  url_externa?: string | null;
  total_likes?: number | string | null;
  duracao_segundos?: number | string | null;
  recursos?: RawCursoRecurso[] | null;
  tem_legenda?: boolean | null;
};

type RawVideoComment = {
  id?: number | string;
  autor?: number | null;
  autor_nome?: string | null;
  autor_initials?: string | null;
  autor_foto?: string | null;
  parent?: number | null;
  conteudo?: string | null;
  criado_em?: string | null;
  editado_em?: string | null;
  tempo?: string | null;
  total_likes?: number | string | null;
  liked?: boolean | null;
  pode_editar?: boolean | null;
  pode_apagar?: boolean | null;
  oculto?: boolean | null;
  respostas?: RawVideoComment[] | null;
};

type RawCourseVideo = {
  id?: number | string;
  titulo?: string | null;
  descricao?: string | null;
  arquivo?: string | null;
  url_externa?: string | null;
  thumbnail?: string | null;
  ordem?: number | null;
  duracao_segundos?: number | null;
  total_likes?: number | string | null;
  assistido?: boolean | null;
  recursos?: RawCursoRecurso[] | null;
  posicao_segundos?: number | null;
  posicao_atualizada_em?: string | null;
  tem_legenda?: boolean | null;
};

type RawAvaliacaoCurso = {
  id?: number;
  estrelas?: number;
  comentario?: string | null;
  autor_nome?: string | null;
  autor_user_id?: number | null;
  autor_foto?: string | null;
  atualizado_em?: string | null;
  tempo?: string | null;
  minha?: boolean | null;
  oculto?: boolean | null;
};

type RawPerfilPublico = Partial<PerfilPublico>;

type RawCourseDetail = RawCourse & {
  descricao?: string | null;
  professor?: number | null;
  inscrito?: boolean | null;
  sou_o_professor?: boolean | null;
  videos?: RawCourseVideo[] | null;
};

type RawPost = {
  id?: number | string;
  autor?: number | null;
  autor_nome?: string | null;
  autor_initials?: string | null;
  autor_foto?: string | null;
  time_ago?: string | null;
  conteudo?: string | null;
  likes?: number | string | null;
  comentarios?: number | string | null;
  liked?: boolean | null;
  oculto?: boolean | null;
};

type RawNotifType = Notification["type"] | (string & {});

type RawNotif = {
  id?: number | string;
  type?: RawNotifType | null;
  title?: string | null;
  body?: string | null;
  timeAgo?: string | null;
  read?: boolean | null;
  link?: string | null;
};

type RawBadge = {
  id?: string | number;
  name?: string;
  description?: string;
  icon?: string;
  earned?: boolean;
  progress?: number | null;
};

type RawCursoRecurso = {
  id?: number | string;
  nome?: string | null;
  tipo?: string | null;
  arquivo_url?: string | null;
  tamanho_bytes?: number | string | null;
  tamanho_mb?: number | string | null;
  criado_em?: string | null;
};

type RawComentario = {
  id?: number | string;
  autor?: number | null;
  autor_nome?: string | null;
  autor_initials?: string | null;
  autor_foto?: string | null;
  parent?: number | null;
  conteudo?: string | null;
  time_ago?: string | null;
  editado_em?: string | null;
  total_likes?: number | string | null;
  liked?: boolean | null;
  pode_editar?: boolean | null;
  pode_apagar?: boolean | null;
  oculto?: boolean | null;
  respostas?: RawComentario[] | null;
};

type RawWalletEntry = {
  id?: string | number;
  label?: string | null;
  delta?: number | string | null;
  date?: string | null;
};

// --- Helpers internos -----------------------------------------------------------------

const COVERS = [
  "linear-gradient(135deg,#B8892F,#E8C878)",
  "linear-gradient(135deg,#2C1810,#8B5E34)",
  "linear-gradient(135deg,#3D5A80,#98C1D9)",
  "linear-gradient(135deg,#7B2D26,#D69F7E)",
  "linear-gradient(135deg,#2F4858,#86BBD8)",
  "linear-gradient(135deg,#4A4E69,#C9ADA7)",
];

function thumbnailFor(idLike: number | string): string {
  const s = String(idLike);
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += s.charCodeAt(i);
  return COVERS[sum % COVERS.length];
}

// Usa a imagem de capa real (enviada pelo professor ou gerada automaticamente
// a partir de um frame do vídeo) quando existir; caso contrário mantém o
// gradiente decorativo gerado a partir do id.
function coverOuThumbnail(idLike: number | string, thumbnail?: string | null): string {
  const url = mediaUrl(thumbnail);
  if (url) return `url('${url}') center / cover no-repeat`;
  return thumbnailFor(idLike);
}

function daysAgo(d?: string | null): number {
  if (!d) return 1;
  try {
    const dt = new Date(d);
    const ms = Date.now() - dt.getTime();
    return Math.max(1, Math.floor(ms / (24 * 3600 * 1000)));
  } catch {
    return 1;
  }
}

// Formata uma data ISO como "agora mesmo" / "há N minutos" / "há N horas" /
// "há N dias", para listas de conteúdo do professor (cursos, vídeos).
export function tempoRelativo(iso?: string | null): string {
  if (!iso) return "";
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    // `new Date(string_invalida)` não lança erro — dá "Invalid Date", e
    // `.getTime()` disso é NaN. Sem este check, todas as comparações abaixo
    // (NaN < x) são sempre falsas e cai-se no "return" final com NaN dentro
    // da frase ("há NaN dias") — bug real, confirmado em teste.
    if (Number.isNaN(diffMs)) return "";
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "agora mesmo";
    if (diffMin < 60) return `há ${diffMin} minuto${diffMin === 1 ? "" : "s"}`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `há ${diffH} hora${diffH === 1 ? "" : "s"}`;
    const diffD = Math.floor(diffH / 24);
    return `há ${diffD} dia${diffD === 1 ? "" : "s"}`;
  } catch {
    return "";
  }
}

// Formata uma data ISO/"YYYY-MM-DD" como "12 mar 2026", para a data de
// publicação em cards de curso/vídeo.
export function formatarDataCurta(iso?: string | null): string {
  if (!iso) return "";
  try {
    const data = new Date(iso);
    // Mesmo problema que tempoRelativo: uma data inválida não lança erro,
    // e sem este check isto mostrava o texto literal "Invalid Date" na UI.
    if (Number.isNaN(data.getTime())) return "";
    return data.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

// Formata segundos como "M:SS" (duração de uma aula/vídeo individual).
//
// Arredonda o TOTAL primeiro (não os minutos e segundos em separado): isso
// evita produzir "1:60" quando os segundos restantes arredondam para 60 —
// bug real, confirmado em teste, reprodutível mesmo com segundos inteiros
// perto de uma fronteira de minuto.
export function formatarDuracaoCurta(segundos?: number | null): string {
  if (!segundos || segundos <= 0) return "";
  const total = Math.round(segundos);
  const min = Math.floor(total / 60);
  const seg = total % 60;
  return `${min}:${String(seg).padStart(2, "0")}`;
}

// Formata segundos como "1h 20min" / "45min" (duração total de um curso).
//
// Mesma correção que formatarDuracaoCurta: arredonda o total de minutos
// primeiro. Sem isto, qualquer curso com duração entre 59m30s e 59m59s
// (ou a mesma janela em qualquer fronteira de hora) mostrava "60min" em
// vez de "1h" — bug real, confirmado em teste com segundos inteiros.
export function formatarDuracaoLonga(segundos?: number | null): string {
  if (!segundos || segundos <= 0) return "";
  const totalMin = Math.round(segundos / 60);
  const horas = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (horas === 0) return `${min}min`;
  if (min === 0) return `${horas}h`;
  return `${horas}h ${min}min`;
}

function _appendCursoPayload(formData: FormData, payload: Partial<ProfessorCursoPayload>) {
  if (payload.titulo !== undefined) formData.append('titulo', payload.titulo);
  if (payload.descricao !== undefined) formData.append('descricao', payload.descricao);
  if (payload.categoria_nome !== undefined) formData.append('categoria_nome', payload.categoria_nome);
  if (payload.ativo !== undefined) formData.append('ativo', String(payload.ativo));
}

function _appendVideoPayload(
  formData: FormData,
  payload: Omit<Partial<ProfessorVideoPayload>, 'arquivo' | 'thumbnail'>,
) {
  if (payload.titulo !== undefined) formData.append('titulo', payload.titulo);
  if (payload.descricao !== undefined) formData.append('descricao', payload.descricao);
  if (payload.url_externa !== undefined) formData.append('url_externa', payload.url_externa);
  if (payload.ativo !== undefined) formData.append('ativo', String(payload.ativo));
}

function initiais(name: string): string {
  const partes = (name || "U").trim().split(/\s+/);
  if (partes.length >= 2) return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  return (partes[0].slice(0, 2)).toUpperCase();
}

// --- Fallback mock (enquanto a base de dados estiver vazia) ---------------------------

import {
  mockVideos, mockPosts,
  mockLeaderboard, mockBadges, mockWallet, courseCategories,
} from "@/lib/mock-data";
import { limparCacheApiOffline } from "@/lib/offline";

// Os mocks de Video/Post (usados só como fallback antes de a BD ter dados)
// não têm foto de professor/autor — completa com `null` para bater com os
// tipos normalizados da API.
const mockVideosComFoto: Video[] = mockVideos.map((v) => ({ ...v, teacherFoto: null }));
const mockPostsComFoto: Post[] = mockPosts.map((p) => ({ ...p, authorFoto: null }));

// --- Normalizadores API → UI ----------------------------------------------------------

function normalizeCourse(raw: RawCourse): Course {
  const profNome = raw?.professor_nome || raw?.professor?.nome_publico || "Professor";
  const duracaoTotalSegundos = Number(raw?.duracao_total_segundos ?? 0) || 0;
  return {
    id: String(raw?.id ?? "c"),
    title: raw?.titulo || "Curso sem título",
    category: raw?.categoria_nome || "Geral",
    teacher: profNome,
    teacherAvatar: initiais(profNome),
    teacherFoto: mediaUrl(raw?.professor_foto) ?? null,
    teacherUserId: typeof raw?.professor_user_id === "number" ? raw.professor_user_id : null,
    level: "Iniciante",
    durationHours: Math.round((duracaoTotalSegundos / 3600) * 10) / 10,
    durationLabel: formatarDuracaoLonga(duracaoTotalSegundos),
    lessons: raw?.videos && raw.videos.length > 0 ? raw.videos.length : 0,
    students: Number(raw?.total_inscritos ?? 0) || 0,
    progress: typeof raw?.progress === "number" ? raw.progress : undefined,
    thumbnail: coverOuThumbnail(raw?.id ?? "c", raw?.thumbnail),
    publishedAt: raw?.publicado_em || raw?.criado_em || null,
    recursos: (raw?.recursos || []).map(normalizeCursoRecurso),
    rating: typeof raw?.media_avaliacoes === "number" ? raw.media_avaliacoes : null,
    ratingCount: Number(raw?.total_avaliacoes ?? 0) || 0,
    certificadoDisponivel: Boolean(raw?.certificado_disponivel),
  };
}

function normalizeVideo(raw: RawVideo): Video {
  const profNome = raw?.professor_nome || "Professor";
  return {
    id: String(raw?.id ?? "v"),
    title: raw?.titulo || "Vídeo",
    teacher: profNome,
    teacherFoto: mediaUrl(raw?.professor_foto) ?? null,
    teacherUserId: typeof raw?.professor_user_id === "number" ? raw.professor_user_id : null,
    duration: formatarDuracaoCurta(raw?.duracao_segundos),
    views: Number(raw?.total_visualizacoes ?? 0) || 0,
    daysAgo: daysAgo(raw?.criado_em),
    thumbnail: coverOuThumbnail(raw?.id ?? "v", raw?.thumbnail),
    publishedAt: raw?.criado_em || null,
  };
}

function normalizeVideoDetail(raw: RawVideoDetail): VideoDetail {
  const profNome = raw?.professor_nome || "Professor";
  const durationSeconds = Number(raw?.duracao_segundos ?? 0) || 0;
  return {
    id: String(raw?.id ?? "v"),
    title: raw?.titulo || "Vídeo",
    description: raw?.descricao || "",
    teacher: profNome,
    teacherAvatar: initiais(profNome),
    teacherFoto: mediaUrl(raw?.professor_foto) ?? null,
    professorId: typeof raw?.professor === "number" ? raw.professor : null,
    teacherUserId: typeof raw?.professor_user_id === "number" ? raw.professor_user_id : null,
    thumbnail: coverOuThumbnail(raw?.id ?? "v", raw?.thumbnail),
    fileUrl: mediaUrl(raw?.arquivo),
    externalUrl: raw?.url_externa || "",
    views: Number(raw?.total_visualizacoes ?? 0) || 0,
    likes: Number(raw?.total_likes ?? 0) || 0,
    createdAt: raw?.criado_em || "",
    durationSeconds,
    durationLabel: formatarDuracaoCurta(durationSeconds),
    recursos: (raw?.recursos || []).map(normalizeCursoRecurso),
    temLegenda: Boolean(raw?.tem_legenda),
  };
}

function normalizeVideoComment(raw: RawVideoComment): VideoComment {
  return {
    id: Number(raw?.id ?? 0),
    autorId: Number(raw?.autor ?? 0),
    autorNome: raw?.autor_nome || "Utilizador",
    autorInitials: raw?.autor_initials || "??",
    autorFoto: mediaUrl(raw?.autor_foto) ?? null,
    parentId: typeof raw?.parent === "number" ? raw.parent : null,
    conteudo: raw?.conteudo || "",
    criadoEm: raw?.criado_em || "",
    editadoEm: raw?.editado_em || null,
    tempo: raw?.tempo || "",
    likes: Number(raw?.total_likes ?? 0) || 0,
    liked: Boolean(raw?.liked),
    podeEditar: Boolean(raw?.pode_editar),
    podeApagar: Boolean(raw?.pode_apagar),
    oculto: Boolean(raw?.oculto),
    respostas: (raw?.respostas || []).map(normalizeVideoComment),
  };
}

function normalizeCourseVideo(raw: RawCourseVideo): CourseVideo {
  const durationSeconds = Number(raw?.duracao_segundos ?? 0) || 0;
  return {
    id: Number(raw?.id ?? 0),
    title: raw?.titulo || "Vídeo",
    description: raw?.descricao || "",
    fileUrl: mediaUrl(raw?.arquivo),
    externalUrl: raw?.url_externa || "",
    thumbnail: mediaUrl(raw?.thumbnail),
    order: Number(raw?.ordem ?? 0),
    likes: Number(raw?.total_likes ?? 0) || 0,
    durationSeconds,
    durationLabel: formatarDuracaoCurta(durationSeconds),
    watched: Boolean(raw?.assistido),
    recursos: (raw?.recursos || []).map(normalizeCursoRecurso),
    positionSeconds: Number(raw?.posicao_segundos ?? 0) || 0,
    positionUpdatedAt: raw?.posicao_atualizada_em || null,
    temLegenda: Boolean(raw?.tem_legenda),
  };
}

function normalizeAvaliacao(raw: RawAvaliacaoCurso): AvaliacaoCurso {
  return {
    id: Number(raw?.id ?? 0),
    estrelas: Number(raw?.estrelas ?? 0) || 0,
    comentario: raw?.comentario || "",
    autorNome: raw?.autor_nome || "Aluno",
    autorUserId: typeof raw?.autor_user_id === "number" ? raw.autor_user_id : null,
    autorFoto: mediaUrl(raw?.autor_foto),
    atualizadoEm: raw?.atualizado_em || "",
    tempo: raw?.tempo || "",
    minha: Boolean(raw?.minha),
    oculto: Boolean(raw?.oculto),
  };
}

function normalizePerfilPublico(raw: RawPerfilPublico): PerfilPublico {
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  return {
    id: Number(raw?.id ?? 0),
    name: raw?.name || "Utilizador",
    initials: raw?.initials || "??",
    isTeacher: Boolean(raw?.isTeacher),
    membroDesde: raw?.membroDesde || null,
    souEu: Boolean(raw?.souEu),
    foto: mediaUrl(raw?.foto),
    privado: Boolean(raw?.privado),
    bloqueado: Boolean(raw?.bloqueado),
    nomePublico: raw?.nomePublico || null,
    bio: raw?.bio || "",
    area: raw?.area || null,
    seguidores: num(raw?.seguidores),
    aSeguir: Boolean(raw?.aSeguir),
    professorId: num(raw?.professorId),
    totalCursos: num(raw?.totalCursos),
    totalVideos: num(raw?.totalVideos),
    cursos: (raw?.cursos || []).map((c) => ({ ...c, thumbnail: mediaUrl(c.thumbnail) })),
    videos: (raw?.videos || []).map((v) => ({ ...v, thumbnail: mediaUrl(v.thumbnail) })),
    cursosConcluidos: num(raw?.cursosConcluidos),
    listaCursosConcluidos: raw?.listaCursosConcluidos ?? null,
    conquistas: raw?.conquistas ?? null,
    nivel: num(raw?.nivel),
    publicacoes: raw?.publicacoes ?? null,
  };
}

function normalizeCourseDetail(raw: RawCourseDetail): CourseDetail {
  return {
    ...normalizeCourse(raw),
    description: raw?.descricao || "",
    professorId: typeof raw?.professor === "number" ? raw.professor : null,
    inscrito: Boolean(raw?.inscrito),
    souOProfessor: Boolean(raw?.sou_o_professor),
    videos: (raw?.videos || []).map(normalizeCourseVideo),
  };
}

function normalizePost(raw: RawPost): Post {
  return {
    id: String(raw?.id ?? "p"),
    author: raw?.autor_nome || "Anónimo",
    authorId: typeof raw?.autor === "number" ? raw.autor : null,
    initials: raw?.autor_initials || "??",
    authorFoto: mediaUrl(raw?.autor_foto) ?? null,
    timeAgo: raw?.time_ago || "há pouco",
    content: raw?.conteudo || "",
    likes: Number(raw?.likes ?? 0),
    comments: Number(raw?.comentarios ?? 0),
    liked: Boolean(raw?.liked),
    oculto: Boolean(raw?.oculto),
  };
}

function normalizeNotif(raw: RawNotif): Notification {
  return {
    id: String(raw?.id ?? "n"),
    type: (raw?.type as Notification["type"]) || "system",
    title: raw?.title || "Notificação",
    body: raw?.body || "",
    timeAgo: raw?.timeAgo || "",
    read: Boolean(raw?.read),
    link: raw?.link || null,
  };
}

function normalizeCursoRecurso(raw: RawCursoRecurso): CursoRecurso {
  return {
    id: Number(raw?.id ?? 0),
    nome: raw?.nome || "Recurso",
    tipo: raw?.tipo || "pdf",
    arquivoUrl: mediaUrl(raw?.arquivo_url) ?? "",
    tamanhoBytes: Number(raw?.tamanho_bytes ?? 0) || 0,
    tamanhoMb: Number(raw?.tamanho_mb ?? 0) || 0,
    criadoEm: raw?.criado_em || "",
  };
}

function normalizeComentario(raw: RawComentario): Comentario {
  return {
    id: Number(raw?.id ?? 0),
    autorId: Number(raw?.autor ?? 0),
    autor_nome: raw?.autor_nome || "Utilizador",
    autor_initials: raw?.autor_initials || "??",
    autor_foto: mediaUrl(raw?.autor_foto),
    parentId: typeof raw?.parent === "number" ? raw.parent : null,
    conteudo: raw?.conteudo || "",
    time_ago: raw?.time_ago || "há pouco",
    editadoEm: raw?.editado_em || null,
    likes: Number(raw?.total_likes ?? 0) || 0,
    liked: Boolean(raw?.liked),
    podeEditar: Boolean(raw?.pode_editar),
    podeApagar: Boolean(raw?.pode_apagar),
    oculto: Boolean(raw?.oculto),
    respostas: (raw?.respostas || []).map(normalizeComentario),
  };
}

// --- Funções específicas para recursos ------------------------------------------------

export const api = {
  // =========================================================================
  //  AUTENTICAÇÃO
  // =========================================================================
  login: async (username: string, password: string) => {
    const res = await fetchAPI<{ ok: boolean; user?: AuthUser; error?: string; requires2fa?: boolean }>(
      '/accounts/auth/login/',
      {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      },
    );
    return res;
  },
  verificar2FA: async (codigo: string) => {
    const res = await fetchAPI<{ ok: boolean; user: AuthUser; error?: string }>(
      '/accounts/auth/verificar-2fa/',
      { method: 'POST', body: JSON.stringify({ codigo }) },
    );
    return res;
  },
  // NOTA: assume que existe (ou vai ser criado) o endpoint '/accounts/auth/register/'
  // no backend Django, seguindo a mesma convenção de '/accounts/auth/login/'.
  // Confirmar com o backend antes de usar em produção.
  register: async (username: string, email: string, password: string, ref?: string) => {
    const res = await fetchAPI<{ ok: boolean; user: AuthUser; error?: string }>(
      '/accounts/auth/register/',
      {
        method: 'POST',
        body: JSON.stringify(ref ? { username, email, password, ref } : { username, email, password }),
      },
    );
    return res;
  },
  logout: async () => {
    limparCacheApiOffline();
    return await fetchAPI<{ ok: boolean }>('/accounts/auth/logout/', {
      method: 'POST',
    });
  },
  me: async () => {
    const res = await fetchAPI<{ ok: boolean; authenticated: boolean; user: AuthUser | null }>(
      '/accounts/auth/me/',
    );
    return res;
  },
  pedirRecuperacaoSenha: async (email: string) => {
    return await fetchAPI<{ ok: boolean }>('/accounts/auth/password-reset/', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
  validarLinkRecuperacao: async (uid: string, token: string) => {
    return await fetchAPI<{ ok: boolean }>('/accounts/auth/password-reset/validar/', {
      method: 'POST',
      body: JSON.stringify({ uid, token }),
    });
  },
  redefinirSenha: async (uid: string, token: string, password: string) => {
    return await fetchAPI<{ ok: boolean }>('/accounts/auth/password-reset/confirmar/', {
      method: 'POST',
      body: JSON.stringify({ uid, token, password }),
    });
  },
  // --- Candidatura pública a professor (sem intervenção de administradores) ---
  enviarCandidaturaProfessor: async (dados: CandidaturaProfessorPayload) => {
    return await fetchAPI<{ ok: boolean; email: string }>('/accounts/auth/professor/candidatura/', {
      method: 'POST',
      body: JSON.stringify(dados),
    });
  },
  validarCandidaturaProfessor: async (token: string) => {
    return await fetchAPI<{ ok: boolean; nome: string; email: string }>(
      '/accounts/auth/professor/candidatura/validar/',
      { method: 'POST', body: JSON.stringify({ token }) },
    );
  },
  concluirCandidaturaProfessor: async (token: string, password: string) => {
    return await fetchAPI<{ ok: boolean; user: AuthUser | null }>(
      '/accounts/auth/professor/candidatura/concluir/',
      { method: 'POST', body: JSON.stringify({ token, password }) },
    );
  },
  verificarEmail: async (token: string) => {
    return await fetchAPI<{ ok: boolean; authenticated: boolean }>('/accounts/auth/verificar-email/', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },
  reenviarVerificacaoEmail: async () => {
    return await fetchAPI<{ ok: boolean; jaVerificado?: boolean }>('/accounts/auth/reenviar-verificacao/', {
      method: 'POST',
    });
  },

  // =========================================================================
  //  CATEGORIAS
  // =========================================================================
  getCategories: async (): Promise<string[]> => {
    try {
      const res = await fetchAPI<Category[]>('/api/categorias/');
      if (Array.isArray(res) && res.length > 0) {
        return res.map((c) => c.nome || "Todos");
      }
    } catch {
      /* fallback */
    }
    return courseCategories;
  },

  // =========================================================================
  //  CURSOS
  // =========================================================================
  getCursos: async (): Promise<Course[]> => {
    try {
      const res = await fetchAPI<RawCourse[]>('/api/cursos/');
      if (Array.isArray(res) && res.length > 0) {
        return res.map(normalizeCourse);
      }
      return []; // array vazio em vez de mock
    } catch {
      return []; // ou throw new Error('Falha ao carregar cursos')
    }
  },
  getCurso: async (id: number | string): Promise<CourseDetail | null> => {
    try {
      const res = await fetchAPI<RawCourseDetail>(`/api/cursos/${id}/`);
      if (res) return normalizeCourseDetail(res);
    } catch {
      /* fallback */
    }
    return null;
  },

  // =========================================================================
  //  VÍDEOS
  // =========================================================================
  getVideos: async (tab: "recent" | "popular" | "short" = "recent"): Promise<Video[]> => {
    try {
      const res = await fetchAPI<RawVideo[]>(`/api/videos/?tab=${tab}`);
      if (Array.isArray(res) && res.length > 0) {
        return res.map(normalizeVideo);
      }
    } catch {
      /* fallback */
    }
    if (tab === "popular") return [...mockVideosComFoto].sort((a, b) => b.views - a.views);
    if (tab === "short") return mockVideosComFoto.filter((v) => parseInt(v.duration.split(":")[0]) < 6);
    return mockVideosComFoto;
  },
  getVideo: async (id: number | string): Promise<VideoDetail | null> => {
    try {
      const res = await fetchAPI<RawVideoDetail>(`/api/videos/${id}/`);
      if (res) return normalizeVideoDetail(res);
    } catch {
      /* vídeo não encontrado ou erro de rede */
    }
    return null;
  },

  getPerfilPublico: async (userId: number | string, comoVisitante = false): Promise<PerfilPublico | null> => {
    try {
      const res = await fetchAPI<{ ok: boolean; perfil: RawPerfilPublico }>(
        `/accounts/api/perfil/${userId}/${comoVisitante ? '?como_visitante=1' : ''}`,
      );
      if (res?.perfil) return normalizePerfilPublico(res.perfil);
    } catch {
      /* perfil não encontrado ou erro de rede */
    }
    return null;
  },
  pesquisarUtilizadores: async (q: string): Promise<UtilizadorPesquisa[]> => {
    try {
      const res = await fetchAPI<{ ok: boolean; utilizadores: UtilizadorPesquisa[] }>(
        `/accounts/api/pesquisar-utilizadores/?q=${encodeURIComponent(q)}`,
      );
      if (res?.utilizadores && Array.isArray(res.utilizadores)) {
        return res.utilizadores.map((u) => ({
          ...u,
          foto: mediaUrl(u.foto),
        }));
      }
    } catch {
      /* erro na pesquisa */
    }
    return [];
  },

  toggleSeguirProfessor: (professorId: number | string) =>
    fetchAPI<{ seguindo: boolean; seguidores: number }>(`/api/professores/${professorId}/seguir/`, {
      method: 'POST',
    }),

  // =========================================================================
  //  COMUNIDADE (posts, comentários, reações)
  // =========================================================================
  getPosts: async (): Promise<Post[]> => {
    try {
      const res = await fetchAPI<RawPost[]>('/api/comunidade/posts/');
      if (Array.isArray(res) && res.length > 0) {
        return res.map(normalizePost);
      }
    } catch {
      /* fallback */
    }
    return mockPostsComFoto;
  },
  createPost: async (conteudo: string): Promise<Post> => {
    const res = await fetchAPI<RawPost>('/api/comunidade/posts/', {
      method: 'POST',
      body: JSON.stringify({ conteudo }),
    });
    return normalizePost(res);
  },
  reactPost: async (postId: string | number): Promise<{ liked: boolean; likes: number }> => {
    const res = await fetchAPI<{ liked: boolean; likes: number }>(
      `/api/comunidade/posts/${postId}/reagir/`,
      { method: 'POST' },
    );
    return res;
  },
  getComentarios: async (postId: string | number): Promise<Comentario[]> => {
    try {
      const res = await fetchAPI<RawComentario[]>(`/api/comunidade/posts/${postId}/comentarios/`);
      return Array.isArray(res) ? res.map(normalizeComentario) : [];
    } catch {
      return [];
    }
  },
  createComentario: async (
    postId: string | number,
    conteudo: string,
    parentId?: number,
  ): Promise<Comentario> => {
    const res = await fetchAPI<RawComentario>(
      `/api/comunidade/posts/${postId}/comentarios/`,
      {
        method: 'POST',
        body: JSON.stringify(parentId ? { conteudo, parent: parentId } : { conteudo }),
      },
    );
    return normalizeComentario(res);
  },
  editarComentario: async (
    postId: string | number,
    comentarioId: number,
    conteudo: string,
  ): Promise<Comentario> => {
    const res = await fetchAPI<RawComentario>(`/api/comunidade/posts/${postId}/comentarios/${comentarioId}/`, {
      method: 'PATCH',
      body: JSON.stringify({ conteudo }),
    });
    return normalizeComentario(res);
  },
  apagarComentario: async (postId: string | number, comentarioId: number): Promise<void> => {
    await fetchAPI(`/api/comunidade/posts/${postId}/comentarios/${comentarioId}/`, { method: 'DELETE' });
  },
  reagirComentario: async (
    postId: string | number,
    comentarioId: number,
  ): Promise<{ liked: boolean; totalLikes: number }> => {
    return await fetchAPI(`/api/comunidade/posts/${postId}/comentarios/${comentarioId}/reagir/`, {
      method: 'POST',
    });
  },

  // =========================================================================
  //  NOTIFICAÇÕES
  // =========================================================================
  getNotificacoes: async (): Promise<Notification[]> => {
    // Sem notificações reais devolve lista vazia — não se mostram exemplos
    // inventados, que davam a ideia de haver novidades que não existem.
    try {
      const res = await fetchAPI<RawNotif[]>('/api/notificacoes/');
      return Array.isArray(res) ? res.map(normalizeNotif) : [];
    } catch {
      return [];
    }
  },
  /** Quantas notificações por ler (para o número no sino do topo). */
  getNotificacoesNaoLidas: async (): Promise<number> => {
    try {
      const res = await fetchAPI<{ count: number }>('/api/notificacoes/nao-lidas/');
      return typeof res?.count === 'number' ? res.count : 0;
    } catch {
      return 0;
    }
  },
  marcarNotificacaoLida: async (id: number | string): Promise<{ ok: boolean; read: boolean }> => {
    try {
      return await fetchAPI<{ ok: boolean; read: boolean }>(
        `/api/notificacoes/${id}/marcar-lida/`,
        { method: 'POST' },
      );
    } catch {
      return { ok: false, read: false };
    }
  },

  // =========================================================================
  //  GAMIFICAÇÃO
  // =========================================================================
  getDadosGamificacao: async (): Promise<GamePanel> => {
    try {
      const res = await fetchAPI<GamePanel>('/api/gamificacao/');
      if (res) return { ...res, foto: mediaUrl(res.foto) };
    } catch {
      /* fallback */
    }
    return {
      coins: 0, xp: 0, streak: 0, streakRecord: 0, level: 1,
      levelProgress: 0, nextLevelXp: 500, initials: "?", name: "Estudante",
    };
  },
  getLeaderboard: async (): Promise<LeaderRow[]> => {
    try {
      const res = await fetchAPI<LeaderRow[]>('/api/leaderboard/');
      if (Array.isArray(res) && res.length > 0) {
        return res.map((row) => ({ ...row, foto: mediaUrl(row.foto) }));
      }
    } catch {
      /* fallback */
    }
    return mockLeaderboard;
  },
  getLeaderboardProfessores: async (): Promise<ProfessorLeaderRow[]> => {
    try {
      const res = await fetchAPI<ProfessorLeaderRow[]>('/api/leaderboard/professores/');
      if (Array.isArray(res)) return res;
    } catch {
      /* fallback */
    }
    return [];
  },
  getBadges: async (): Promise<Badge[]> => {
    try {
      const res = await fetchAPI<RawBadge[]>('/api/badges/');
      if (Array.isArray(res) && res.length > 0) {
        return res.map((b) => ({
          id: String(b.id ?? "b"),
          name: b.name || "Badge",
          description: b.description || "",
          icon: b.icon || "Sparkles",
          earned: Boolean(b.earned),
          progress: typeof b.progress === "number" ? b.progress : undefined,
        }));
      }
    } catch {
      /* fallback */
    }
    return mockBadges;
  },
  getCarteira: async (): Promise<WalletEntry[]> => {
    try {
      const res = await fetchAPI<RawWalletEntry[]>('/api/carteira/');
      if (Array.isArray(res) && res.length > 0) {
        return res.map((t) => ({
          id: String(t.id),
          label: t.label || "Transação",
          delta: Number(t.delta) || 0,
          date: t.date || "",
        }));
      }
    } catch {
      /* fallback */
    }
    return mockWallet;
  },

  // =========================================================================
  //  UTILIZADOR (deprecado — mantido para compatibilidade)
  // =========================================================================
  getUsuario: async (): Promise<AuthUser> => {
    const res = await fetchAPI<{ ok: boolean; user: AuthUser }>('/accounts/auth/me/');
    return res.user;
  },
  atualizarUsuario: (dados: unknown) =>
    fetchAPI<unknown>('/accounts/auth/me/', {
      method: 'PUT',
      body: JSON.stringify(dados),
    }),

  // =========================================================================
  //  ADMINISTRAÇÃO (exige user.is_staff)
  // =========================================================================
  moderacao: {
    motivos: async (): Promise<MotivoDenuncia[]> => {
      const res = await fetchAPI<{ motivos: MotivoDenuncia[] }>('/api/moderacao/denuncias/');
      return res?.motivos ?? [];
    },
    denunciar: async (
      tipo: TipoConteudoDenuncia,
      id: number | string,
      motivo: string,
      descricao: string,
    ): Promise<{ ok: boolean; jaDenunciado: boolean }> => {
      return await fetchAPI('/api/moderacao/denuncias/', {
        method: 'POST',
        body: JSON.stringify({ tipo, id: Number(id), motivo, descricao }),
      });
    },
    alternarBloqueio: async (userId: number): Promise<{ bloqueado: boolean }> => {
      return await fetchAPI(`/api/moderacao/bloquear/${userId}/`, { method: 'POST' });
    },
    bloqueados: async (): Promise<(UtilizadorResumo & { bloqueadoEm: string })[]> => {
      return await fetchAPI('/api/moderacao/bloqueados/');
    },
    verContestacao: async (token: string) => {
      return await fetchAPI<{
        acao: AcaoPublica;
        contestavel: boolean;
        contestacao: { estado: string; resposta: string; criadaEm: string } | null;
      }>(`/api/moderacao/contestar/?token=${encodeURIComponent(token)}`);
    },
    contestar: async (token: string, texto: string): Promise<{ ok: boolean }> => {
      return await fetchAPI('/api/moderacao/contestar/', { method: 'POST', body: JSON.stringify({ token, texto }) });
    },
  },

  plataforma: {
    /** Aviso do topo + limites de upload. Nunca lança erro. */
    config: async (): Promise<ConfigPublica | null> => {
      try {
        return await fetchAPI<ConfigPublica>('/api/plataforma/config/');
      } catch {
        return null;
      }
    },
  },

  admin: {
    // ── Moderação ──────────────────────────────────────────────────────
    filaModeracao: async (estado: 'pendente' | 'resolvida' | 'rejeitada' = 'pendente') => {
      return await fetchAPI<{ itens: ItemFilaModeracao[]; contadores: { pendentes: number; contestacoes: number } }>(
        `/api/moderacao/admin/fila/?estado=${estado}`,
      );
    },
    resolverDenuncias: async (payload: {
      tipo: TipoConteudoDenuncia;
      objetoId: number;
      conteudo: DecisaoConteudo;
      sancao: Sancao | null;
      motivo: string;
      dias?: number;
    }): Promise<{ ok: boolean; denunciasResolvidas: number; rejeitadas: boolean }> => {
      return await fetchAPI('/api/moderacao/admin/resolver/', { method: 'POST', body: JSON.stringify(payload) });
    },
    sancionar: async (
      userId: number,
      sancao: Sancao | 'levantar',
      motivo: string,
      dias?: number,
    ): Promise<{ ok: boolean; utilizador: HistoricoModeracao }> => {
      return await fetchAPI(`/api/moderacao/admin/utilizadores/${userId}/sancao/`, {
        method: 'POST',
        body: JSON.stringify({ sancao, motivo, dias }),
      });
    },
    registoModeracao: async (): Promise<AcaoModeracaoRegisto[]> => {
      return await fetchAPI('/api/moderacao/admin/registo/');
    },
    contestacoes: async (estado: 'pendente' | 'aceite' | 'recusada' = 'pendente'): Promise<ContestacaoAdmin[]> => {
      return await fetchAPI(`/api/moderacao/admin/contestacoes/?estado=${estado}`);
    },
    responderContestacao: async (id: number, aceitar: boolean, resposta: string): Promise<{ ok: boolean }> => {
      return await fetchAPI(`/api/moderacao/admin/contestacoes/${id}/responder/`, {
        method: 'POST',
        body: JSON.stringify({ aceitar, resposta }),
      });
    },
    palavras: async (): Promise<PalavraProibida[]> => {
      return await fetchAPI('/api/moderacao/admin/palavras/');
    },
    adicionarPalavra: async (termo: string, acao: 'bloquear' | 'sinalizar'): Promise<PalavraProibida[]> => {
      return await fetchAPI('/api/moderacao/admin/palavras/', { method: 'POST', body: JSON.stringify({ termo, acao }) });
    },
    apagarPalavra: async (id: number): Promise<void> => {
      await fetchAPI(`/api/moderacao/admin/palavras/${id}/`, { method: 'DELETE' });
    },

    // ── Plataforma ─────────────────────────────────────────────────────
    getConfig: async (): Promise<ConfigAdmin> => {
      return await fetchAPI('/api/plataforma/admin/config/');
    },
    atualizarConfig: async (dados: Partial<ConfigAdmin>): Promise<ConfigAdmin> => {
      return await fetchAPI('/api/plataforma/admin/config/', { method: 'PATCH', body: JSON.stringify(dados) });
    },
    anuncios: async (): Promise<Anuncio[]> => {
      return await fetchAPI('/api/plataforma/admin/anuncios/');
    },
    enviarAnuncio: async (dados: {
      titulo: string;
      mensagem: string;
      link?: string;
      enviar_email: boolean;
      /** ISO 8601 com fuso; sem isto, sai já. */
      agendado_para?: string;
    }): Promise<Anuncio> => {
      return await fetchAPI('/api/plataforma/admin/anuncios/', { method: 'POST', body: JSON.stringify(dados) });
    },
    cancelarAnuncio: async (id: number): Promise<void> => {
      await fetchAPI(`/api/plataforma/admin/anuncios/${id}/`, { method: 'DELETE' });
    },
    enviarLembreteOfensiva: async (): Promise<ConfigAdmin> => {
      return await fetchAPI('/api/plataforma/admin/lembrete-ofensiva/enviar/', { method: 'POST' });
    },
    categorias: async (): Promise<CategoriaAdmin[]> => {
      return await fetchAPI('/api/plataforma/admin/categorias/');
    },
    criarCategoria: async (nome: string): Promise<CategoriaAdmin[]> => {
      return await fetchAPI('/api/plataforma/admin/categorias/', { method: 'POST', body: JSON.stringify({ nome }) });
    },
    renomearCategoria: async (id: number, nome: string): Promise<CategoriaAdmin[]> => {
      return await fetchAPI(`/api/plataforma/admin/categorias/${id}/`, { method: 'PATCH', body: JSON.stringify({ nome }) });
    },
    apagarCategoria: async (id: number): Promise<CategoriaAdmin[]> => {
      return await fetchAPI(`/api/plataforma/admin/categorias/${id}/`, { method: 'DELETE' });
    },

    // ── Métricas ───────────────────────────────────────────────────────
    getMetricas: async (): Promise<MetricasPlataforma> => {
      return await fetchAPI<MetricasPlataforma & { ok: boolean }>('/accounts/api/admin/metricas/');
    },

    // ── Professores ────────────────────────────────────────────────────
    getProfessores: async (): Promise<AdminProfessor[]> => {
      const res = await fetchAPI<{ ok: boolean; professores: AdminProfessor[] }>(
        '/accounts/api/admin/professores/',
      );
      return res?.professores ?? [];
    },

    criarProfessor: async (payload: CriarProfessorPayload): Promise<ContaCriada> => {
      const res = await fetchAPI<{
        ok: boolean; message: string; email_enviado: boolean; senha_temporaria?: string;
        user: { username: string; email: string };
      }>(
        '/accounts/api/admin/professores/criar/',
        { method: 'POST', body: JSON.stringify(payload) },
      );
      return {
        message: res.message,
        email_enviado: res.email_enviado,
        senha_temporaria: res.senha_temporaria,
        username: res.user.username,
        email: res.user.email,
      };
    },

    /** Só um super administrador pode criar outro. */
    criarAdministrador: async (payload: CriarAdministradorPayload): Promise<ContaCriada> => {
      const res = await fetchAPI<{
        ok: boolean; message: string; email_enviado: boolean; senha_temporaria?: string;
        user: { username: string; email: string };
      }>(
        '/accounts/api/admin/administradores/criar/',
        { method: 'POST', body: JSON.stringify(payload) },
      );
      return {
        message: res.message,
        email_enviado: res.email_enviado,
        senha_temporaria: res.senha_temporaria,
        username: res.user.username,
        email: res.user.email,
      };
    },

    // ── Utilizadores ───────────────────────────────────────────────────
    getUtilizadores: async (
      params: { q?: string; tipo?: AdminUserTipoFiltro } = {},
    ): Promise<AdminUser[]> => {
      const usp = new URLSearchParams();
      if (params.q) usp.set('q', params.q);
      if (params.tipo) usp.set('tipo', params.tipo);
      const qs = usp.toString();
      const res = await fetchAPI<{ ok: boolean; users: AdminUser[] }>(
        `/accounts/api/admin/utilizadores/${qs ? `?${qs}` : ''}`,
      );
      return res?.users ?? [];
    },

    toggleAtivoUtilizador: async (userId: number): Promise<{ is_active: boolean; message: string }> => {
      const res = await fetchAPI<{ ok: boolean; is_active: boolean; message: string }>(
        `/accounts/api/admin/utilizadores/${userId}/toggle/`,
        { method: 'POST' },
      );
      return { is_active: res.is_active, message: res.message };
    },

    apagarUtilizador: async (userId: number): Promise<{ message: string }> => {
      const res = await fetchAPI<{ ok: boolean; message: string }>(
        `/accounts/api/admin/utilizadores/${userId}/apagar/`,
        { method: 'POST' },
      );
      return { message: res.message };
    },
  },

  // =========================================================================
  //  PERFIL (aluno) + ONBOARDING
  // =========================================================================
  perfil: {
    getAluno: async (): Promise<PerfilAluno> => {
      return await fetchAPI<PerfilAluno>('/aluno/api/perfil/');
    },
    atualizarAluno: async (bio: string, foto?: File | null): Promise<PerfilAluno> => {
      if (foto) {
        const formData = new FormData();
        formData.append('bio', bio);
        formData.append('foto', foto);
        return await fetchAPI<PerfilAluno>('/aluno/api/perfil/atualizar/', {
          method: 'POST',
          body: formData,
        });
      }
      return await fetchAPI<PerfilAluno>('/aluno/api/perfil/atualizar/', {
        method: 'POST',
        body: JSON.stringify({ bio }),
      });
    },
    meu: async (): Promise<MeuPerfil> => {
      const res = await fetchAPI<MeuPerfil & { ok: boolean; perfil: RawPerfilPublico }>('/accounts/api/meu-perfil/');
      return { ...res, perfil: normalizePerfilPublico(res.perfil) };
    },
    completar: async (): Promise<{ ok: boolean; user: AuthUser }> => {
      return await fetchAPI('/accounts/api/perfil/completar/', { method: 'POST' });
    },
    apagarContaAluno: async (): Promise<{ ok: boolean }> => {
      return await fetchAPI('/aluno/api/apagar-conta/', { method: 'POST' });
    },
  },

  // =========================================================================
  //  PREFERÊNCIAS + SEGURANÇA
  // =========================================================================
  preferencias: {
    atualizar: async (dados: {
      tema_preferido?: 'auto' | 'claro' | 'escuro';
      notif_email_novidades?: boolean;
      notif_email_comunidade?: boolean;
      notif_email_gamificacao?: boolean;
      velocidade_reproducao?: number;
      autoplay_proxima_aula?: boolean;
      retomar_posicao?: boolean;
      legendas_ativas?: boolean;
      tamanho_texto?: TamanhoTexto;
      reduzir_animacoes?: boolean;
      alto_contraste?: boolean;
      perfil_visibilidade?: 'todos' | 'cursos';
      aparecer_ranking?: boolean;
      mostrar_cursos_perfil?: boolean;
      mostrar_conquistas_perfil?: boolean;
      mostrar_publicacoes_perfil?: boolean;
    }): Promise<{ ok: boolean; user: AuthUser }> => {
      return await fetchAPI('/accounts/api/preferencias/', {
        method: 'POST',
        body: JSON.stringify(dados),
      });
    },
  },

  seguranca: {
    alterarSenha: async (senhaAtual: string, novaSenha: string): Promise<{ ok: boolean; error?: string }> => {
      return await fetchAPI('/accounts/api/seguranca/alterar-senha/', {
        method: 'POST',
        body: JSON.stringify({ senha_atual: senhaAtual, nova_senha: novaSenha }),
      });
    },
    alterarEmail: async (
      senhaAtual: string,
      novoEmail: string,
    ): Promise<{ ok: boolean; error?: string; user?: AuthUser }> => {
      return await fetchAPI('/accounts/api/seguranca/alterar-email/', {
        method: 'POST',
        body: JSON.stringify({ senha_atual: senhaAtual, novo_email: novoEmail }),
      });
    },
    novosCodigos2FA: async (senhaAtual: string): Promise<{ ok: boolean; codigosBackup: string[] }> => {
      return await fetchAPI('/accounts/api/seguranca/2fa/novos-codigos/', {
        method: 'POST',
        body: JSON.stringify({ senha_atual: senhaAtual }),
      });
    },
    sessoes: async (): Promise<SessaoAtiva[]> => {
      const res = await fetchAPI<{ ok: boolean; sessoes: SessaoAtiva[] }>('/accounts/api/seguranca/sessoes/');
      return res?.sessoes ?? [];
    },
    terminarSessao: async (id: number): Promise<void> => {
      await fetchAPI(`/accounts/api/seguranca/sessoes/${id}/terminar/`, { method: 'POST' });
    },
    terminarOutrasSessoes: async (): Promise<{ ok: boolean; terminadas: number }> => {
      return await fetchAPI('/accounts/api/seguranca/sessoes/terminar-outras/', { method: 'POST' });
    },
    exportarDadosUrl: () => `${API_BASE_URL}/accounts/api/exportar-dados/`,
    status2FA: async (): Promise<{ ok: boolean; ativo: boolean; codigosRestantes?: number }> => {
      return await fetchAPI('/accounts/api/seguranca/2fa/status/');
    },
    iniciar2FA: async (): Promise<{ ok: boolean; qrBase64: string; secret: string; error?: string }> => {
      return await fetchAPI('/accounts/api/seguranca/2fa/iniciar/', { method: 'POST' });
    },
    confirmar2FA: async (codigo: string): Promise<{ ok: boolean; codigosBackup?: string[]; error?: string }> => {
      return await fetchAPI('/accounts/api/seguranca/2fa/confirmar/', {
        method: 'POST',
        body: JSON.stringify({ codigo }),
      });
    },
    desativar2FA: async (): Promise<{ ok: boolean }> => {
      return await fetchAPI('/accounts/api/seguranca/2fa/desativar/', { method: 'POST' });
    },
  },

  // =========================================================================
  //  VÍDEOS / CURSOS: interações do aluno
  // =========================================================================
  reagirVideo: async (videoId: string | number, tipo: 'like' | 'dislike' = 'like') => {
    return await fetchAPI<{ likes: number; dislikes: number }>(`/api/videos/${videoId}/reagir/`, {
      method: 'POST',
      body: JSON.stringify({ tipo }),
    });
  },
  /** Onde o utilizador parou neste vídeo (0 se nunca viu). Nunca lança erro. */
  getPosicaoVideo: async (videoId: string | number): Promise<number> => {
    try {
      const res = await fetchAPI<{ segundos: number }>(`/api/videos/${videoId}/posicao/`);
      return Number(res?.segundos ?? 0) || 0;
    } catch {
      return 0;
    }
  },
  /** Guarda a posição de reprodução. `keepalive` deixa o pedido terminar
   * mesmo que a página esteja a fechar (ex: o aluno sai a meio da aula). */
  guardarPosicaoVideo: async (videoId: string | number, segundos: number, keepalive = false): Promise<void> => {
    try {
      await fetchAPI(`/api/videos/${videoId}/posicao/`, {
        method: 'PUT',
        body: JSON.stringify({ segundos: Math.floor(segundos) }),
        keepalive,
      });
    } catch {
      // guardar a posição não é crítico — nunca deve interromper a reprodução
    }
  },
  registarViewVideo: async (
    videoId: string | number,
  ): Promise<{ novaView: boolean; cursoConcluido: boolean } | null> => {
    try {
      return await fetchAPI(`/api/videos/${videoId}/registar-view/`, { method: 'POST' });
    } catch {
      // tracking de view não é crítico — nunca deve interromper a reprodução
      return null;
    }
  },

  // =========================================================================
  //  COMENTÁRIOS EM VÍDEOS (avulsos ou aulas de curso)
  // =========================================================================
  comentariosVideo: {
    listar: async (videoId: string | number): Promise<VideoComment[]> => {
      const res = await fetchAPI<RawVideoComment[]>(`/api/videos/${videoId}/comentarios/`);
      return Array.isArray(res) ? res.map(normalizeVideoComment) : [];
    },
    criar: async (videoId: string | number, conteudo: string, parentId?: number): Promise<VideoComment> => {
      const res = await fetchAPI<RawVideoComment>(`/api/videos/${videoId}/comentarios/`, {
        method: 'POST',
        body: JSON.stringify(parentId ? { conteudo, parent: parentId } : { conteudo }),
      });
      return normalizeVideoComment(res);
    },
    editar: async (videoId: string | number, comentarioId: number, conteudo: string): Promise<VideoComment> => {
      const res = await fetchAPI<RawVideoComment>(`/api/videos/${videoId}/comentarios/${comentarioId}/`, {
        method: 'PATCH',
        body: JSON.stringify({ conteudo }),
      });
      return normalizeVideoComment(res);
    },
    apagar: async (videoId: string | number, comentarioId: number): Promise<void> => {
      await fetchAPI(`/api/videos/${videoId}/comentarios/${comentarioId}/`, { method: 'DELETE' });
    },
    reagir: async (videoId: string | number, comentarioId: number): Promise<{ liked: boolean; totalLikes: number }> => {
      return await fetchAPI(`/api/videos/${videoId}/comentarios/${comentarioId}/reagir/`, { method: 'POST' });
    },
  },
  /** WebVTT do vídeo, como blob URL local (o <track> não aceita outra
   * origem sem CORS no próprio <video>). Devolve null se falhar. */
  carregarLegenda: async (videoId: string | number): Promise<string | null> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/videos/${videoId}/legenda/`, { credentials: 'include' });
      if (!res.ok) return null;
      return URL.createObjectURL(new Blob([await res.text()], { type: 'text/vtt' }));
    } catch {
      return null;
    }
  },
  certificadoUrl: (cursoId: string | number) => `${API_BASE_URL}/api/cursos/${cursoId}/certificado/`,
  verificarCertificado: async (codigo: string): Promise<CertificadoVerificado | null> => {
    try {
      return await fetchAPI<CertificadoVerificado>(`/api/certificados/${encodeURIComponent(codigo)}/`);
    } catch {
      return null;
    }
  },
  avaliacoes: {
    listar: async (cursoId: string | number): Promise<AvaliacoesCurso> => {
      const res = await fetchAPI<{
        resumo: ResumoAvaliacoes;
        podeAvaliar: boolean;
        minha: RawAvaliacaoCurso | null;
        avaliacoes: RawAvaliacaoCurso[];
      }>(`/api/cursos/${cursoId}/avaliacoes/`);
      return {
        resumo: res.resumo,
        podeAvaliar: Boolean(res.podeAvaliar),
        minha: res.minha ? normalizeAvaliacao(res.minha) : null,
        avaliacoes: (res.avaliacoes || []).map(normalizeAvaliacao),
      };
    },
    avaliar: async (
      cursoId: string | number,
      estrelas: number,
      comentario: string,
    ): Promise<{ avaliacao: AvaliacaoCurso; resumo: ResumoAvaliacoes }> => {
      const res = await fetchAPI<{ avaliacao: RawAvaliacaoCurso; resumo: ResumoAvaliacoes }>(
        `/api/cursos/${cursoId}/avaliacoes/`,
        { method: 'POST', body: JSON.stringify({ estrelas, comentario }) },
      );
      return { avaliacao: normalizeAvaliacao(res.avaliacao), resumo: res.resumo };
    },
    apagar: async (cursoId: string | number): Promise<{ resumo: ResumoAvaliacoes }> => {
      return await fetchAPI(`/api/cursos/${cursoId}/avaliacoes/`, { method: 'DELETE' });
    },
  },
  inscreverCurso: async (cursoId: string | number) => {
    return await fetchAPI<{ ok: boolean; concluido: boolean }>(`/api/cursos/${cursoId}/inscrever/`, {
      method: 'POST',
    });
  },
  listarRecursosCurso: async (cursoId: string | number): Promise<CursoRecurso[]> => {
    try {
      const res = await fetchAPI<RawCursoRecurso[]>(`/api/cursos/${cursoId}/recursos/`);
      if (Array.isArray(res)) return res.map(normalizeCursoRecurso);
    } catch {
      /* falha ao listar — devolve vazio */
    }
    return [];
  },
  adicionarRecursoCurso: async (
    cursoId: string | number,
    payload: { nome: string; arquivo: File; tipo?: string },
  ): Promise<CursoRecurso> => {
    const formData = new FormData();
    formData.append('nome', payload.nome);
    formData.append('arquivo', payload.arquivo);
    formData.append('tipo', payload.tipo || 'pdf');
    const res = await fetchAPI<RawCursoRecurso>(`/api/cursos/${cursoId}/recursos/`, {
      method: 'POST',
      body: formData,
    });
    return normalizeCursoRecurso(res);
  },
  apagarRecursoCurso: async (cursoId: string | number, recursoId: number): Promise<void> => {
    await fetchAPI(`/api/cursos/${cursoId}/recursos/${recursoId}/`, { method: 'DELETE' });
  },
  seguirProfessor: async (professorId: string | number) => {
    return await fetchAPI<{ seguindo: boolean; seguidores: number }>(
      `/api/professores/${professorId}/seguir/`,
      { method: 'POST' },
    );
  },

  // =========================================================================
  //  DASHBOARD DO PROFESSOR
  // =========================================================================
  professor: {
    getPerfil: async (): Promise<ProfessorPerfil> => {
      return await fetchAPI('/api/professor/perfil/');
    },
    atualizarPerfil: async (
      dados: Partial<Pick<ProfessorPerfil, 'nome_publico' | 'bio' | 'area'>>,
      foto?: File | null,
    ): Promise<ProfessorPerfil> => {
      if (foto) {
        const formData = new FormData();
        Object.entries(dados).forEach(([k, v]) => {
          if (v !== undefined) formData.append(k, String(v));
        });
        formData.append('foto', foto);
        return await fetchAPI('/api/professor/perfil/', { method: 'PATCH', body: formData });
      }
      return await fetchAPI('/api/professor/perfil/', {
        method: 'PATCH',
        body: JSON.stringify(dados),
      });
    },
    apagarConta: async (): Promise<{ ok: boolean }> => {
      return await fetchAPI('/api/professor/apagar-conta/', { method: 'POST' });
    },

    getCursos: async (): Promise<ProfessorCurso[]> => {
      return await fetchAPI('/api/professor/cursos/');
    },
    criarCurso: async (
      payload: ProfessorCursoPayload,
      videos: File[],
      recursos: File[] = [],
    ): Promise<ProfessorCurso> => {
      const formData = new FormData();
      _appendCursoPayload(formData, payload);
      if (payload.thumbnail) formData.append('thumbnail', payload.thumbnail);
      videos.forEach((v) => formData.append('videos', v));
      recursos.forEach((r) => formData.append('recursos', r));
      return await fetchAPI('/api/professor/cursos/', { method: 'POST', body: formData });
    },
    atualizarCurso: async (
      id: number,
      payload: Partial<ProfessorCursoPayload>,
      novosVideos: File[] = [],
      novosRecursos: File[] = [],
    ): Promise<ProfessorCurso> => {
      if (novosVideos.length === 0 && novosRecursos.length === 0 && !payload.thumbnail) {
        return await fetchAPI(`/api/professor/cursos/${id}/`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      const formData = new FormData();
      _appendCursoPayload(formData, payload);
      if (payload.thumbnail) formData.append('thumbnail', payload.thumbnail);
      novosVideos.forEach((v) => formData.append('videos', v));
      novosRecursos.forEach((r) => formData.append('recursos', r));
      return await fetchAPI(`/api/professor/cursos/${id}/`, { method: 'PATCH', body: formData });
    },
    apagarCurso: async (id: number): Promise<void> => {
      await fetchAPI(`/api/professor/cursos/${id}/`, { method: 'DELETE' });
    },
    apagarVideoCurso: async (cursoId: number, videoId: number): Promise<void> => {
      await fetchAPI(`/api/professor/cursos/${cursoId}/videos/${videoId}/`, { method: 'DELETE' });
    },
    getCursoEngajamento: async (id: number): Promise<CursoEngajamento> => {
      return await fetchAPI(`/api/professor/cursos/${id}/engajamento/`);
    },

    getVideos: async (): Promise<ProfessorVideo[]> => {
      return await fetchAPI('/api/professor/videos/');
    },
    criarVideo: async (payload: ProfessorVideoPayload, recursos: File[] = []): Promise<ProfessorVideo> => {
      const { arquivo, thumbnail, ...resto } = payload;
      if (arquivo || thumbnail || recursos.length > 0) {
        const formData = new FormData();
        _appendVideoPayload(formData, resto);
        if (arquivo) formData.append('arquivo', arquivo);
        if (thumbnail) formData.append('thumbnail', thumbnail);
        recursos.forEach((r) => formData.append('recursos', r));
        return await fetchAPI('/api/professor/videos/', { method: 'POST', body: formData });
      }
      return await fetchAPI('/api/professor/videos/', { method: 'POST', body: JSON.stringify(resto) });
    },
    atualizarVideo: async (
      id: number,
      payload: Partial<ProfessorVideoPayload>,
      novosRecursos: File[] = [],
    ): Promise<ProfessorVideo> => {
      const { arquivo, thumbnail, ...resto } = payload;
      if (arquivo || thumbnail || novosRecursos.length > 0) {
        const formData = new FormData();
        _appendVideoPayload(formData, resto);
        if (arquivo) formData.append('arquivo', arquivo);
        if (thumbnail) formData.append('thumbnail', thumbnail);
        novosRecursos.forEach((r) => formData.append('recursos', r));
        return await fetchAPI(`/api/professor/videos/${id}/`, { method: 'PATCH', body: formData });
      }
      return await fetchAPI(`/api/professor/videos/${id}/`, { method: 'PATCH', body: JSON.stringify(resto) });
    },
    apagarVideo: async (id: number): Promise<void> => {
      await fetchAPI(`/api/professor/videos/${id}/`, { method: 'DELETE' });
    },
    apagarRecursoVideo: async (videoId: number, recursoId: number): Promise<void> => {
      await fetchAPI(`/api/professor/videos/${videoId}/recursos/${recursoId}/`, { method: 'DELETE' });
    },
    getVideoEngajamento: async (id: number): Promise<VideoEngajamento> => {
      return await fetchAPI(`/api/professor/videos/${id}/engajamento/`);
    },
    carregarLegenda: async (videoId: number, ficheiro: File): Promise<{ ok: boolean; tem_legenda: boolean }> => {
      const formData = new FormData();
      formData.append('legenda', ficheiro);
      return await fetchAPI(`/api/professor/videos/${videoId}/legenda/`, { method: 'POST', body: formData });
    },
    removerLegenda: async (videoId: number): Promise<{ ok: boolean; tem_legenda: boolean }> => {
      return await fetchAPI(`/api/professor/videos/${videoId}/legenda/`, { method: 'DELETE' });
    },
    reordenarVideos: async (ordem: number[]): Promise<{ ok: boolean }> => {
      return await fetchAPI('/api/professor/videos/reordenar/', {
        method: 'POST',
        body: JSON.stringify({ ordem }),
      });
    },
  },
};
