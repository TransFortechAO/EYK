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
  cover: string; // gradient css
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
    level: "Iniciante",
    durationHours: 6.5,
    lessons: 24,
    rating: 4.8,
    students: 1284,
    progress: 42,
    cover: covers[0],
  },
  {
    id: "c2",
    title: "Design de Produto do Zero",
    category: "Design",
    teacher: "Rui Martins",
    teacherAvatar: "RM",
    level: "Intermédio",
    durationHours: 12,
    lessons: 38,
    rating: 4.9,
    students: 892,
    progress: 12,
    cover: covers[1],
  },
  {
    id: "c3",
    title: "Marketing Digital Avançado",
    category: "Marketing",
    teacher: "Beatriz Lopes",
    teacherAvatar: "BL",
    level: "Avançado",
    durationHours: 9,
    lessons: 30,
    rating: 4.7,
    students: 2103,
    cover: covers[2],
  },
  {
    id: "c4",
    title: "Introdução ao Copywriting",
    category: "Escrita",
    teacher: "João Neves",
    teacherAvatar: "JN",
    level: "Iniciante",
    durationHours: 4.5,
    lessons: 18,
    rating: 4.6,
    students: 654,
    cover: covers[3],
  },
  {
    id: "c5",
    title: "Produtividade Radical",
    category: "Desenvolvimento pessoal",
    teacher: "Sofia Ramos",
    teacherAvatar: "SR",
    level: "Intermédio",
    durationHours: 5,
    lessons: 20,
    rating: 4.9,
    students: 3410,
    cover: covers[4],
  },
  {
    id: "c6",
    title: "Fotografia com Telemóvel",
    category: "Criativo",
    teacher: "Diogo Faria",
    teacherAvatar: "DF",
    level: "Iniciante",
    durationHours: 3.5,
    lessons: 14,
    rating: 4.5,
    students: 421,
    cover: covers[5],
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
  { id: "v1", title: "Como definir metas SMART em 5 minutos", teacher: "Sofia Ramos", duration: "5:24", views: 12400, daysAgo: 2, cover: covers[4] },
  { id: "v2", title: "3 princípios de composição visual", teacher: "Rui Martins", duration: "8:12", views: 8320, daysAgo: 4, cover: covers[1] },
  { id: "v3", title: "O erro mais comum ao investir", teacher: "Ana Costa", duration: "6:48", views: 15680, daysAgo: 1, cover: covers[0] },
  { id: "v4", title: "Escreve headlines que convertem", teacher: "João Neves", duration: "4:02", views: 5240, daysAgo: 7, cover: covers[3] },
  { id: "v5", title: "Anúncios pagos: por onde começar", teacher: "Beatriz Lopes", duration: "11:30", views: 9840, daysAgo: 5, cover: covers[2] },
  { id: "v6", title: "Fotografa comida como um pro", teacher: "Diogo Faria", duration: "7:18", views: 3420, daysAgo: 9, cover: covers[5] },
];

export const mockPosts: Post[] = [
  {
    id: "p1",
    author: "Ema Fernandes",
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
    initials: "MT",
    timeAgo: "há 5 horas",
    content: "Alguém já experimentou a nova metodologia de estudo da Sofia Ramos? Estou a testar há uma semana e a minha produtividade duplicou.",
    likes: 12,
    comments: 9,
  },
  {
    id: "p3",
    author: "Rita Almeida",
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
  { rank: 1, name: "Rita Almeida", initials: "RA", coins: 4820, streak: 42 },
  { rank: 2, name: "Miguel Tavares", initials: "MT", coins: 4210, streak: 31 },
  { rank: 3, name: "Ema Fernandes", initials: "EF", coins: 3980, streak: 28 },
  { rank: 4, name: "Sofia Ramos", initials: "SR", coins: 3450, streak: 19 },
  { rank: 5, name: "João Neves", initials: "JN", coins: 3120, streak: 22 },
  { rank: 6, name: "Beatriz Lopes", initials: "BL", coins: 2890, streak: 15 },
  { rank: 7, name: "Diogo Faria", initials: "DF", coins: 2540, streak: 12 },
  { rank: 8, name: "fábio (tu)", initials: "F", coins: 2380, streak: 9, isMe: true },
  { rank: 9, name: "Ana Costa", initials: "AC", coins: 2140, streak: 7 },
  { rank: 10, name: "Rui Martins", initials: "RM", coins: 1980, streak: 5 },
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