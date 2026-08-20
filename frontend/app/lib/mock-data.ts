export type Course = {
  id: string;
  title: string;
  category: string;
  teacher: string;
  teacherAvatar: string;
  teacherUserId: number | null;
  level: "Iniciante" | "Intermédio" | "Avançado";
  durationHours: number;
  durationLabel: string;
  lessons: number;
  students: number;
  progress?: number;
  thumbnail: string; // gradient css
  publishedAt: string | null;
};

export type Video = {
  id: string;
  title: string;
  teacher: string;
  teacherUserId: number | null;
  duration: string;
  views: number;
  daysAgo: number;
  thumbnail: string;
  publishedAt: string | null;
};

export type Post = {
  id: string;
  author: string;
  authorId: number | null;
  initials: string;
  timeAgo: string;
  content: string;
  likes: number;
  comments: number;
  liked?: boolean;
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
  userId: number | null;
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
  icon: string; // lucide icon name
  earned: boolean;
  progress?: number;
};

export type WalletEntry = {
  id: string;
  label: string;
  delta: number;
  date: string;
};

export const covers = [
  "linear-gradient(135deg,#B8892F,#E8C878)",
  "linear-gradient(135deg,#2C1810,#8B5E34)",
  "linear-gradient(135deg,#3D5A80,#98C1D9)",
  "linear-gradient(135deg,#7B2D26,#D69F7E)",
  "linear-gradient(135deg,#2F4858,#86BBD8)",
  "linear-gradient(135deg,#4A4E69,#C9ADA7)",
];

export const mockCourses: Course[] = [
  {
    id: "c1",
    title: "Fundamentos de Investimento",
    category: "Finanças",
    teacher: "Ana Costa",
    teacherAvatar: "AC",
    teacherUserId: null,
    level: "Iniciante",
    durationHours: 6.5,
    durationLabel: "6h 30min",
    lessons: 24,
    students: 1284,
    progress: 42,
    thumbnail: covers[0],
    publishedAt: "2026-05-12",
  },
  {
    id: "c2",
    title: "Design de Produto do Zero",
    category: "Design",
    teacher: "Rui Martins",
    teacherAvatar: "RM",
    teacherUserId: null,
    level: "Intermédio",
    durationHours: 12,
    durationLabel: "12h",
    lessons: 38,
    students: 892,
    progress: 12,
    thumbnail: covers[1],
    publishedAt: "2026-04-03",
  },
  {
    id: "c3",
    title: "Marketing Digital Avançado",
    category: "Marketing",
    teacher: "Beatriz Lopes",
    teacherAvatar: "BL",
    teacherUserId: null,
    level: "Avançado",
    durationHours: 9,
    durationLabel: "9h",
    lessons: 30,
    students: 2103,
    thumbnail: covers[2],
    publishedAt: "2026-06-01",
  },
  {
    id: "c4",
    title: "Introdução ao Copywriting",
    category: "Escrita",
    teacher: "João Neves",
    teacherAvatar: "JN",
    teacherUserId: null,
    level: "Iniciante",
    durationHours: 4.5,
    durationLabel: "4h 30min",
    lessons: 18,
    students: 654,
    thumbnail: covers[3],
    publishedAt: "2026-07-15",
  },
  {
    id: "c5",
    title: "Produtividade Radical",
    category: "Desenvolvimento pessoal",
    teacher: "Sofia Ramos",
    teacherAvatar: "SR",
    teacherUserId: null,
    level: "Intermédio",
    durationHours: 5,
    durationLabel: "5h",
    lessons: 20,
    students: 3410,
    thumbnail: covers[4],
    publishedAt: "2026-03-20",
  },
  {
    id: "c6",
    title: "Fotografia com Telemóvel",
    category: "Criativo",
    teacher: "Diogo Faria",
    teacherAvatar: "DF",
    teacherUserId: null,
    level: "Iniciante",
    durationHours: 3.5,
    durationLabel: "3h 30min",
    lessons: 14,
    students: 421,
    thumbnail: covers[5],
    publishedAt: "2026-07-28",
  },
];

export const courseCategories = [
  "Todos",
  "Finanças",
  "Design",
  "Marketing",
  "Escrita",
  "Desenvolvimento pessoal",
  "Criativo",
];

export const mockVideos: Video[] = [
  { id: "v1", title: "Como definir metas SMART em 5 minutos", teacher: "Sofia Ramos", teacherUserId: null, duration: "5:24", views: 12400, daysAgo: 2, thumbnail: covers[4], publishedAt: "2026-08-18" },
  { id: "v2", title: "3 princípios de composição visual", teacher: "Rui Martins", teacherUserId: null, duration: "8:12", views: 8320, daysAgo: 4, thumbnail: covers[1], publishedAt: "2026-08-16" },
  { id: "v3", title: "O erro mais comum ao investir", teacher: "Ana Costa", teacherUserId: null, duration: "6:48", views: 15680, daysAgo: 1, thumbnail: covers[0], publishedAt: "2026-08-19" },
  { id: "v4", title: "Escreve headlines que convertem", teacher: "João Neves", teacherUserId: null, duration: "4:02", views: 5240, daysAgo: 7, thumbnail: covers[3], publishedAt: "2026-08-13" },
  { id: "v5", title: "Anúncios pagos: por onde começar", teacher: "Beatriz Lopes", teacherUserId: null, duration: "11:30", views: 9840, daysAgo: 5, thumbnail: covers[2], publishedAt: "2026-08-15" },
  { id: "v6", title: "Fotografa comida como um pro", teacher: "Diogo Faria", teacherUserId: null, duration: "7:18", views: 3420, daysAgo: 9, thumbnail: covers[5], publishedAt: "2026-08-11" },
];

export const mockPosts: Post[] = [
  {
    id: "p1",
    author: "Ema Fernandes",
    authorId: null,
    initials: "EF",
    timeAgo: "há 2 horas",
    content: "Acabei o módulo 3 de Fundamentos de Investimento — os exercícios práticos fizeram toda a diferença. Recomendo muito começar por aqui se ainda não sabem por onde ir 🔥",
    likes: 24,
    comments: 6,
    liked: true,
  },
  {
    id: "p2",
    author: "Miguel Tavares",
    authorId: null,
    initials: "MT",
    timeAgo: "há 5 horas",
    content: "Alguém já experimentou a nova metodologia de estudo da Sofia Ramos? Estou a testar há uma semana e a minha produtividade duplicou.",
    likes: 12,
    comments: 9,
  },
  {
    id: "p3",
    author: "Rita Almeida",
    authorId: null,
    initials: "RA",
    timeAgo: "há 1 dia",
    content: "Partilha rápida: acabei a minha primeira campanha de marketing e consegui 3 clientes na primeira semana. Obrigado à comunidade pelo feedback 🙏",
    likes: 58,
    comments: 14,
  },
];

export const mockNotifications: Notification[] = [
  { id: "n1", type: "gamification", title: "Nova conquista", body: "Ganhaste o badge \"Primeira semana\" — parabéns!", timeAgo: "há 10 min" },
  { id: "n2", type: "course", title: "Novo módulo disponível", body: "\"Fundamentos de Investimento\" tem um novo módulo publicado.", timeAgo: "há 2 h" },
  { id: "n3", type: "community", title: "Ema respondeu ao teu comentário", body: "\"Concordo — o módulo 3 é uma virada de jogo.\"", timeAgo: "há 5 h", read: true },
  { id: "n4", type: "system", title: "Manutenção agendada", body: "A plataforma estará indisponível hoje entre as 03:00 e as 03:30.", timeAgo: "há 1 d", read: true },
];

export const mockLeaderboard: LeaderRow[] = [
  { rank: 1, userId: null, name: "Rita Almeida", initials: "RA", coins: 4820, streak: 42 },
  { rank: 2, userId: null, name: "Miguel Tavares", initials: "MT", coins: 4210, streak: 31 },
  { rank: 3, userId: null, name: "Ema Fernandes", initials: "EF", coins: 3980, streak: 28 },
  { rank: 4, userId: null, name: "Sofia Ramos", initials: "SR", coins: 3450, streak: 19 },
  { rank: 5, userId: null, name: "João Neves", initials: "JN", coins: 3120, streak: 22 },
  { rank: 6, userId: null, name: "Beatriz Lopes", initials: "BL", coins: 2890, streak: 15 },
  { rank: 7, userId: null, name: "Diogo Faria", initials: "DF", coins: 2540, streak: 12 },
  { rank: 8, userId: null, name: "fábio (tu)", initials: "F", coins: 2380, streak: 9, isMe: true },
  { rank: 9, userId: null, name: "Ana Costa", initials: "AC", coins: 2140, streak: 7 },
  { rank: 10, userId: null, name: "Rui Martins", initials: "RM", coins: 1980, streak: 5 },
];

export const mockBadges: Badge[] = [
  { id: "b1", name: "Primeira semana", description: "7 dias consecutivos na plataforma", icon: "Flame", earned: true },
  { id: "b2", name: "Curioso", description: "Começaste 3 cursos", icon: "Compass", earned: true },
  { id: "b3", name: "Contribuidor", description: "5 posts na comunidade", icon: "MessageCircle", earned: true },
  { id: "b4", name: "Maratonista", description: "30 dias de streak", icon: "Zap", earned: false, progress: 30 },
  { id: "b5", name: "Mestre", description: "Completa 5 cursos", icon: "GraduationCap", earned: false, progress: 40 },
  { id: "b6", name: "Popular", description: "100 gostos recebidos", icon: "Heart", earned: false, progress: 62 },
  { id: "b7", name: "Explorador", description: "Vê 50 vídeos", icon: "PlayCircle", earned: false, progress: 24 },
  { id: "b8", name: "Lenda", description: "Top 10 do leaderboard", icon: "Trophy", earned: false, progress: 80 },
];

export const mockWallet: WalletEntry[] = [
  { id: "w1", label: "Módulo 3 concluído — Fundamentos de Investimento", delta: 120, date: "Hoje, 14:20" },
  { id: "w2", label: "Streak de 7 dias", delta: 50, date: "Hoje, 09:02" },
  { id: "w3", label: "Post com 20+ gostos", delta: 30, date: "Ontem, 21:45" },
  { id: "w4", label: "Vídeo assistido", delta: 5, date: "Ontem, 18:11" },
  { id: "w5", label: "Comentário útil", delta: 10, date: "Há 2 dias" },
];

export const currentUser = {
  name: "fábio",
  initials: "F",
  coins: 2380,
  streak: 9,
  streakRecord: 14,
  level: 6,
  levelProgress: 62, // % to next level
  nextLevelCoins: 3000,
};