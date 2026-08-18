// Configuração da API para integração com o backend Django
export const API_BASE_URL = (() => {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
  return raw.replace(/\/$/, '');
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
    try {
      const err = await response.json();
      if (err?.error) msg = `${msg}: ${err.error}`;
    } catch {
      /* body não é JSON */
    }
    const err = new Error(msg) as Error & { status: number; response: Response };
    err.status = response.status;
    err.response = response;
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

// --- Tipos de UI (igual aos do mock-data.ts — compatibilidade total) ------------------

export type AuthUser = {
  id: number;
  name: string;
  username: string;
  email: string;
  bio?: string;
  initials: string;
  isTeacher: boolean;
  isStudent: boolean;
  isStaff: boolean;
  perfilCompleto?: boolean;
  temaPreferido?: 'auto' | 'claro' | 'escuro';
  notifEmailNovidades?: boolean;
  notifEmailComunidade?: boolean;
  notifEmailGamificacao?: boolean;
  coins?: number;
  streak?: number;
  level?: number;
  levelProgress?: number;
  nextLevelCoins?: number;
  streakRecord?: number;
};

export type Course = {
  id: string;
  title: string;
  category: string;
  teacher: string;
  teacherAvatar: string;
  level: "Iniciante" | "Intermédio" | "Avançado";
  durationHours: number;
  lessons: number;
  rating: number;
  students: number;
  progress?: number;
  thumbnail: string;
};

export type Video = {
  id: string;
  title: string;
  teacher: string;
  duration: string;
  views: number;
  daysAgo: number;
  thumbnail: string;
};

export type VideoDetail = {
  id: string;
  title: string;
  description: string;
  teacher: string;
  teacherAvatar: string;
  professorId: number | null;
  thumbnail: string;
  fileUrl: string | null;
  externalUrl: string;
  views: number;
  likes: number;
  createdAt: string;
};

export type VideoComment = {
  id: number;
  autorId: number;
  autorNome: string;
  autorInitials: string;
  parentId: number | null;
  conteudo: string;
  criadoEm: string;
  editadoEm: string | null;
  tempo: string;
  likes: number;
  liked: boolean;
  podeEditar: boolean;
  podeApagar: boolean;
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
};

export type CourseDetail = Course & {
  description: string;
  professorId: number | null;
  inscrito: boolean;
  videos: CourseVideo[];
};

export type Post = {
  id: string;
  author: string;
  initials: string;
  timeAgo: string;
  content: string;
  likes: number;
  comments: number;
  liked?: boolean;
};

export type Comentario = {
  id: number;
  autor_nome: string;
  autor_initials: string;
  conteudo: string;
  time_ago: string;
};

export type Notification = {
  id: string;
  type: "course" | "community" | "gamification" | "system";
  title: string;
  body: string;
  timeAgo: string;
  read?: boolean;
};

export type LeaderRow = {
  rank: number;
  name: string;
  initials: string;
  coins: number;
  streak: number;
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

export type GamePanel = {
  coins: number;
  streak: number;
  streakRecord: number;
  level: number;
  levelProgress: number;
  nextLevelCoins: number;
  initials: string;
  name: string;
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
};

export type AdminUserTipoFiltro = "" | "aluno" | "professor" | "staff";

export type CriarProfessorPayload = {
  username: string;
  email: string;
  password: string;
  nome_publico: string;
  area: string;
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
  total_inscritos: number;
  total_visualizacoes: number;
  videos: ProfessorCursoVideo[];
};

export type ProfessorCursoPayload = {
  titulo: string;
  descricao: string;
  categoria_nome?: string;
  preco?: number | string | null;
  duracao?: string;
  ativo?: boolean;
};

export type ProfessorVideo = {
  id: number;
  titulo: string;
  descricao: string;
  arquivo: string | null;
  url_externa: string;
  thumbnail: string | null;
  criado_em: string;
  ativo: boolean;
  ordem: number;
  total_likes: number;
  total_visualizacoes: number;
};

export type ProfessorVideoPayload = {
  titulo: string;
  descricao?: string;
  url_externa?: string;
  ativo?: boolean;
  arquivo?: File | null;
};

export type CursoEngajamento = {
  curso: ProfessorCurso;
  totalInscritos: number;
  totalVisualizacoes: number;
  totalConcluidos: number;
  taxaConclusao: number;
  inscricoes: { id: number; aluno: string; inscritoEm: string; concluido: boolean }[];
};

export type VideoEngajamento = {
  video: ProfessorVideo;
  totalLikes: number;
  totalDislikes: number;
  totalVisualizacoes: number;
  reacoes: { id: number; utilizador_nome: string; tipo: string }[];
};

// --- Tipos Raw (respostas JSON do Django, antes da normalização) ----------------------

type RawProfessor = { nome_publico?: string };

type RawCourse = {
  id?: number | string;
  titulo?: string | null;
  professor_nome?: string | null;
  professor?: RawProfessor | null;
  categoria_nome?: string | null;
  duracao?: number | string | null;
  total_inscritos?: number | string | null;
  progress?: number | null;
  videos?: RawCourseVideo[] | null;
};

type RawVideo = {
  id?: number | string;
  titulo?: string | null;
  professor_nome?: string | null;
  duracao?: string | null;
  total_visualizacoes?: number | string | null;
  criado_em?: string | null;
};

type RawVideoDetail = RawVideo & {
  descricao?: string | null;
  professor?: number | null;
  arquivo?: string | null;
  url_externa?: string | null;
  total_likes?: number | string | null;
};

type RawVideoComment = {
  id?: number | string;
  autor?: number | null;
  autor_nome?: string | null;
  autor_initials?: string | null;
  parent?: number | null;
  conteudo?: string | null;
  criado_em?: string | null;
  editado_em?: string | null;
  tempo?: string | null;
  total_likes?: number | string | null;
  liked?: boolean | null;
  pode_editar?: boolean | null;
  pode_apagar?: boolean | null;
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
  total_likes?: number | string | null;
};

type RawCourseDetail = RawCourse & {
  descricao?: string | null;
  professor?: number | null;
  inscrito?: boolean | null;
  videos?: RawCourseVideo[] | null;
};

type RawPost = {
  id?: number | string;
  autor_nome?: string | null;
  autor_initials?: string | null;
  time_ago?: string | null;
  conteudo?: string | null;
  likes?: number | string | null;
  comentarios?: number | string | null;
  liked?: boolean | null;
};

type RawNotifType = Notification["type"] | (string & {});

type RawNotif = {
  id?: number | string;
  type?: RawNotifType | null;
  title?: string | null;
  body?: string | null;
  timeAgo?: string | null;
  read?: boolean | null;
};

type RawBadge = {
  id?: string | number;
  name?: string;
  description?: string;
  icon?: string;
  earned?: boolean;
  progress?: number | null;
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

function _appendCursoPayload(formData: FormData, payload: Partial<ProfessorCursoPayload>) {
  if (payload.titulo !== undefined) formData.append('titulo', payload.titulo);
  if (payload.descricao !== undefined) formData.append('descricao', payload.descricao);
  if (payload.categoria_nome !== undefined) formData.append('categoria_nome', payload.categoria_nome);
  if (payload.preco !== undefined && payload.preco !== null) formData.append('preco', String(payload.preco));
  if (payload.duracao !== undefined) formData.append('duracao', payload.duracao);
  if (payload.ativo !== undefined) formData.append('ativo', String(payload.ativo));
}

function _appendVideoPayload(formData: FormData, payload: Omit<Partial<ProfessorVideoPayload>, 'arquivo'>) {
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
  mockCourses, mockVideos, mockPosts, mockNotifications,
  mockLeaderboard, mockBadges, mockWallet, courseCategories,
} from "@/lib/mock-data";

// --- Normalizadores API → UI ----------------------------------------------------------

function normalizeCourse(raw: RawCourse): Course {
  const profNome = raw?.professor_nome || raw?.professor?.nome_publico || "Professor";
  return {
    id: String(raw?.id ?? "c"),
    title: raw?.titulo || "Curso sem título",
    category: raw?.categoria_nome || "Geral",
    teacher: profNome,
    teacherAvatar: initiais(profNome),
    level: "Iniciante",
    durationHours: Number(raw?.duracao ?? 0) || 5,
    lessons: raw?.videos && raw.videos.length > 0 ? raw.videos.length : 20,
    rating: 4.7,
    students: Number(raw?.total_inscritos ?? 0) || 0,
    progress: typeof raw?.progress === "number" ? raw.progress : undefined,
    thumbnail: thumbnailFor(raw?.id ?? "c"),
  };
}

function normalizeVideo(raw: RawVideo): Video {
  const profNome = raw?.professor_nome || "Professor";
  return {
    id: String(raw?.id ?? "v"),
    title: raw?.titulo || "Vídeo",
    teacher: profNome,
    duration: raw?.duracao || "5:00",
    views: Number(raw?.total_visualizacoes ?? 0) || 0,
    daysAgo: daysAgo(raw?.criado_em),
    thumbnail: thumbnailFor(raw?.id ?? "v"),
  };
}

function normalizeVideoDetail(raw: RawVideoDetail): VideoDetail {
  const profNome = raw?.professor_nome || "Professor";
  return {
    id: String(raw?.id ?? "v"),
    title: raw?.titulo || "Vídeo",
    description: raw?.descricao || "",
    teacher: profNome,
    teacherAvatar: initiais(profNome),
    professorId: typeof raw?.professor === "number" ? raw.professor : null,
    thumbnail: thumbnailFor(raw?.id ?? "v"),
    fileUrl: mediaUrl(raw?.arquivo),
    externalUrl: raw?.url_externa || "",
    views: Number(raw?.total_visualizacoes ?? 0) || 0,
    likes: Number(raw?.total_likes ?? 0) || 0,
    createdAt: raw?.criado_em || "",
  };
}

function normalizeVideoComment(raw: RawVideoComment): VideoComment {
  return {
    id: Number(raw?.id ?? 0),
    autorId: Number(raw?.autor ?? 0),
    autorNome: raw?.autor_nome || "Utilizador",
    autorInitials: raw?.autor_initials || "??",
    parentId: typeof raw?.parent === "number" ? raw.parent : null,
    conteudo: raw?.conteudo || "",
    criadoEm: raw?.criado_em || "",
    editadoEm: raw?.editado_em || null,
    tempo: raw?.tempo || "",
    likes: Number(raw?.total_likes ?? 0) || 0,
    liked: Boolean(raw?.liked),
    podeEditar: Boolean(raw?.pode_editar),
    podeApagar: Boolean(raw?.pode_apagar),
    respostas: (raw?.respostas || []).map(normalizeVideoComment),
  };
}

function normalizeCourseVideo(raw: RawCourseVideo): CourseVideo {
  return {
    id: Number(raw?.id ?? 0),
    title: raw?.titulo || "Vídeo",
    description: raw?.descricao || "",
    fileUrl: mediaUrl(raw?.arquivo),
    externalUrl: raw?.url_externa || "",
    thumbnail: mediaUrl(raw?.thumbnail),
    order: Number(raw?.ordem ?? 0),
    likes: Number(raw?.total_likes ?? 0) || 0,
  };
}

function normalizeCourseDetail(raw: RawCourseDetail): CourseDetail {
  return {
    ...normalizeCourse(raw),
    description: raw?.descricao || "",
    professorId: typeof raw?.professor === "number" ? raw.professor : null,
    inscrito: Boolean(raw?.inscrito),
    videos: (raw?.videos || []).map(normalizeCourseVideo),
  };
}

function normalizePost(raw: RawPost): Post {
  return {
    id: String(raw?.id ?? "p"),
    author: raw?.autor_nome || "Anónimo",
    initials: raw?.autor_initials || "??",
    timeAgo: raw?.time_ago || "há pouco",
    content: raw?.conteudo || "",
    likes: Number(raw?.likes ?? 0),
    comments: Number(raw?.comentarios ?? 0),
    liked: Boolean(raw?.liked),
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
  register: async (username: string, email: string, password: string) => {
    const res = await fetchAPI<{ ok: boolean; user: AuthUser; error?: string }>(
      '/accounts/auth/register/',
      {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      },
    );
    return res;
  },
  logout: async () => {
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
    if (tab === "popular") return [...mockVideos].sort((a, b) => b.views - a.views);
    if (tab === "short") return mockVideos.filter((v) => parseInt(v.duration.split(":")[0]) < 6);
    return mockVideos;
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
    return mockPosts;
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
      return await fetchAPI<Comentario[]>(`/api/comunidade/posts/${postId}/comentarios/`);
    } catch {
      return [];
    }
  },
  createComentario: async (postId: string | number, conteudo: string): Promise<Comentario> => {
    return await fetchAPI<Comentario>(
      `/api/comunidade/posts/${postId}/comentarios/`,
      {
        method: 'POST',
        body: JSON.stringify({ conteudo }),
      },
    );
  },

  // =========================================================================
  //  NOTIFICAÇÕES
  // =========================================================================
  getNotificacoes: async (): Promise<Notification[]> => {
    try {
      const res = await fetchAPI<RawNotif[]>('/api/notificacoes/');
      if (Array.isArray(res) && res.length > 0) {
        return res.map(normalizeNotif);
      }
    } catch {
      /* fallback */
    }
    return mockNotifications;
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
      if (res) return res;
    } catch {
      /* fallback */
    }
    return {
      coins: 0, streak: 0, streakRecord: 0, level: 1,
      levelProgress: 0, nextLevelCoins: 500, initials: "?", name: "Estudante",
    };
  },
  getLeaderboard: async (): Promise<LeaderRow[]> => {
    try {
      const res = await fetchAPI<LeaderRow[]>('/api/leaderboard/');
      if (Array.isArray(res) && res.length > 0) {
        return res;
      }
    } catch {
      /* fallback */
    }
    return mockLeaderboard;
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
  admin: {
    // ── Professores ────────────────────────────────────────────────────
    getProfessores: async (): Promise<AdminProfessor[]> => {
      const res = await fetchAPI<{ ok: boolean; professores: AdminProfessor[] }>(
        '/accounts/api/admin/professores/',
      );
      return res?.professores ?? [];
    },

    criarProfessor: async (payload: CriarProfessorPayload): Promise<AdminProfessor> => {
      const res = await fetchAPI<{ ok: boolean; professor: AdminProfessor; errors?: Record<string, string> }>(
        '/accounts/api/admin/professores/criar/',
        { method: 'POST', body: JSON.stringify(payload) },
      );
      return res.professor;
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
    status2FA: async (): Promise<{ ok: boolean; ativo: boolean }> => {
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
  inscreverCurso: async (cursoId: string | number) => {
    return await fetchAPI<{ ok: boolean; concluido: boolean }>(`/api/cursos/${cursoId}/inscrever/`, {
      method: 'POST',
    });
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
    atualizarPerfil: async (dados: Partial<Pick<ProfessorPerfil, 'nome_publico' | 'bio' | 'area'>>): Promise<ProfessorPerfil> => {
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
    criarCurso: async (payload: ProfessorCursoPayload, videos: File[]): Promise<ProfessorCurso> => {
      const formData = new FormData();
      _appendCursoPayload(formData, payload);
      videos.forEach((v) => formData.append('videos', v));
      return await fetchAPI('/api/professor/cursos/', { method: 'POST', body: formData });
    },
    atualizarCurso: async (
      id: number,
      payload: Partial<ProfessorCursoPayload>,
      novosVideos: File[] = [],
    ): Promise<ProfessorCurso> => {
      if (novosVideos.length === 0) {
        return await fetchAPI(`/api/professor/cursos/${id}/`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      const formData = new FormData();
      _appendCursoPayload(formData, payload);
      novosVideos.forEach((v) => formData.append('videos', v));
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
    criarVideo: async (payload: ProfessorVideoPayload): Promise<ProfessorVideo> => {
      const { arquivo, ...resto } = payload;
      if (arquivo) {
        const formData = new FormData();
        _appendVideoPayload(formData, resto);
        formData.append('arquivo', arquivo);
        return await fetchAPI('/api/professor/videos/', { method: 'POST', body: formData });
      }
      return await fetchAPI('/api/professor/videos/', { method: 'POST', body: JSON.stringify(resto) });
    },
    atualizarVideo: async (id: number, payload: Partial<ProfessorVideoPayload>): Promise<ProfessorVideo> => {
      const { arquivo, ...resto } = payload;
      if (arquivo) {
        const formData = new FormData();
        _appendVideoPayload(formData, resto);
        formData.append('arquivo', arquivo);
        return await fetchAPI(`/api/professor/videos/${id}/`, { method: 'PATCH', body: formData });
      }
      return await fetchAPI(`/api/professor/videos/${id}/`, { method: 'PATCH', body: JSON.stringify(resto) });
    },
    apagarVideo: async (id: number): Promise<void> => {
      await fetchAPI(`/api/professor/videos/${id}/`, { method: 'DELETE' });
    },
    getVideoEngajamento: async (id: number): Promise<VideoEngajamento> => {
      return await fetchAPI(`/api/professor/videos/${id}/engajamento/`);
    },
    reordenarVideos: async (ordem: number[]): Promise<{ ok: boolean }> => {
      return await fetchAPI('/api/professor/videos/reordenar/', {
        method: 'POST',
        body: JSON.stringify({ ordem }),
      });
    },
  },
};