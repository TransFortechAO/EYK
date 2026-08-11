// Configuração da API para integração com o backend Django
export const API_BASE_URL = (() => {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  return raw.replace(/\/$/, '');
})();

// Cache em memória do CSRF token (evita pedidos extra)
let _cachedCsrf: string | null = null;

async function getCsrfToken(): Promise<string> {
  if (_cachedCsrf) return _cachedCsrf;
  try {
    const res = await fetch(`${API_BASE_URL}/accounts/auth/csrf/`, {
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.csrfToken) _cachedCsrf = data.csrfToken;
    }
  } catch {
    /* ignora */
  }
  return _cachedCsrf || '';
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
  initials: string;
  isTeacher: boolean;
  isStudent: boolean;
  isStaff: boolean;
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
  cover: string;
};

export type Video = {
  id: string;
  title: string;
  teacher: string;
  duration: string;
  views: number;
  daysAgo: number;
  cover: string;
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
};

type RawVideo = {
  id?: number | string;
  titulo?: string | null;
  professor_nome?: string | null;
  duracao?: string | null;
  total_visualizacoes?: number | string | null;
  criado_em?: string | null;
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

function coverFor(idLike: number | string): string {
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
    lessons: 20,
    rating: 4.7,
    students: Number(raw?.total_inscritos ?? 0) || 0,
    progress: typeof raw?.progress === "number" ? raw.progress : undefined,
    cover: coverFor(raw?.id ?? "c"),
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
    cover: coverFor(raw?.id ?? "v"),
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
    const res = await fetchAPI<{ ok: boolean; user: AuthUser; error?: string }>(
      '/accounts/auth/login/',
      {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      },
    );
    return res;
  },
  logout: async () => {
    const res = await fetchAPI<{ ok: boolean }>('/accounts/auth/logout/', {
      method: 'POST',
    });
    _cachedCsrf = null;
    return res;
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
    } catch {
      /* fallback para mock */
    }
    return mockCourses;
  },
  getCurso: async (id: number): Promise<Course | null> => {
    try {
      const res = await fetchAPI<RawCourse>(`/api/cursos/${id}/`);
      if (res) return normalizeCourse(res);
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
};
