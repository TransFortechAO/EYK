// O que cada papel vê na barra lateral e no menu de baixo (telemóvel e tablet).
// Função pura: os componentes (app-sidebar.tsx, bottom-nav.tsx) só desenham.
import type { Papel } from "./tipos";

export type IconeNav =
  | "inicio"
  | "cursos"
  | "videos"
  | "comunidade"
  | "escola"
  | "turmas"
  | "praticar"
  | "gestuario"
  | "respostas"
  | "conteudos"
  | "criancas"
  | "membros"
  | "convites"
  | "avisos"
  | "agenda"
  | "ficheiros"
  | "consentimentos"
  | "relatorios"
  | "auditoria"
  | "dados"
  | "definicoes";

export type ItemNav = { id: string; titulo: string; url: string; icone: IconeNav; contador?: number };

export type Contadores = { porRever: number; trabalhos: number; avisosPorLer: number };

const I = {
  painel: { id: "painel", titulo: "Painel da escola", url: "/instituicao", icone: "escola" },
  turmas: { id: "turmas", titulo: "Turmas LGA", url: "/instituicao/turmas", icone: "turmas" },
  minhasTurmas: { id: "turmas", titulo: "As minhas turmas", url: "/instituicao/turmas", icone: "turmas" },
  praticar: { id: "praticar", titulo: "Praticar LGA", url: "/instituicao/praticar", icone: "praticar" },
  gestuario: { id: "gestuario", titulo: "Gestuário", url: "/instituicao/gestuario", icone: "gestuario" },
  respostas: { id: "respostas", titulo: "Respostas por rever", url: "/instituicao/respostas", icone: "respostas" },
  conteudos: { id: "conteudos", titulo: "Cursos e vídeos da escola", url: "/instituicao/conteudos", icone: "conteudos" },
  criancas: { id: "criancas", titulo: "As minhas crianças", url: "/instituicao/alunos", icone: "criancas" },
  alunos: { id: "alunos", titulo: "Alunos e tutores", url: "/instituicao/alunos", icone: "criancas" },
  membros: { id: "membros", titulo: "Membros e papéis", url: "/instituicao/membros", icone: "membros" },
  convites: { id: "convites", titulo: "Convites e códigos", url: "/instituicao/convites", icone: "convites" },
  avisos: { id: "avisos", titulo: "Avisos", url: "/instituicao/avisos", icone: "avisos" },
  agenda: { id: "agenda", titulo: "Agenda", url: "/instituicao/agenda", icone: "agenda" },
  ficheiros: { id: "ficheiros", titulo: "Ficheiros", url: "/instituicao/ficheiros", icone: "ficheiros" },
  consentimentos: { id: "consentimentos", titulo: "Consentimentos", url: "/instituicao/consentimentos", icone: "consentimentos" },
  relatorios: { id: "relatorios", titulo: "Relatórios", url: "/instituicao/relatorios", icone: "relatorios" },
  auditoria: { id: "auditoria", titulo: "Auditoria", url: "/instituicao/auditoria", icone: "auditoria" },
  dados: { id: "dados", titulo: "Os meus dados", url: "/instituicao/dados", icone: "dados" },
  definicoes: { id: "definicoes", titulo: "Definições da escola", url: "/instituicao/definicoes", icone: "definicoes" },
} satisfies Record<string, ItemNav>;

const GERAL: ItemNav[] = [
  { id: "inicio", titulo: "Início", url: "/inicio", icone: "inicio" },
  { id: "cursos", titulo: "Cursos", url: "/cursos", icone: "cursos" },
  { id: "videos", titulo: "Vídeos", url: "/videos", icone: "videos" },
  { id: "comunidade", titulo: "Comunidade", url: "/comunidade", icone: "comunidade" },
];

/** As funcionalidades da escola na barra lateral, pela ordem de uso de cada papel. */
export function navegacaoEscola(papel: Papel, c: Contadores): ItemNav[] {
  const comContador = (item: ItemNav, n: number): ItemNav => (n > 0 ? { ...item, contador: n } : item);
  switch (papel) {
    case "aluno":
      return [comContador(I.minhasTurmas, c.trabalhos), I.praticar, I.gestuario, comContador(I.avisos, c.avisosPorLer), I.agenda, I.ficheiros];
    case "familia":
      return [I.criancas, I.turmas, I.praticar, comContador(I.avisos, c.avisosPorLer), I.agenda, I.consentimentos, I.dados];
    case "educador":
      return [I.minhasTurmas, comContador(I.respostas, c.porRever), I.conteudos, I.gestuario, I.alunos, comContador(I.avisos, c.avisosPorLer), I.agenda, I.ficheiros, I.convites];
    case "formador":
      return [I.minhasTurmas, comContador(I.respostas, c.porRever), { ...I.gestuario, titulo: "Gestuário (validar)" }, I.conteudos, comContador(I.avisos, c.avisosPorLer), I.agenda];
    case "coordenador":
      return [I.turmas, { ...I.gestuario, titulo: "Gestuário (validar)" }, I.relatorios, I.alunos, I.membros, comContador(I.avisos, c.avisosPorLer), I.agenda];
    case "administrador":
      return [I.painel, I.turmas, I.membros, I.convites, I.conteudos, comContador(I.avisos, c.avisosPorLer), I.relatorios, I.definicoes];
    case "observador":
      return [I.relatorios];
  }
}

/**
 * As abas de baixo no telemóvel: as quatro coisas mais usadas por cada papel.
 * Sem escola, ficam as de sempre (Início, Cursos, Vídeos, Comunidade).
 */
export function abasTelemovel(papel: Papel | null, c: Contadores): ItemNav[] {
  const [inicio, cursos, videos, comunidade] = GERAL;
  const com = (item: ItemNav, n: number): ItemNav => (n > 0 ? { ...item, contador: n } : item);
  switch (papel) {
    case "aluno":
      return [inicio, com({ ...I.minhasTurmas, titulo: "Turmas" }, c.trabalhos), { ...I.praticar, titulo: "Praticar" }, comunidade];
    case "familia":
      return [inicio, { ...I.criancas, titulo: "Crianças" }, com(I.avisos, c.avisosPorLer), I.agenda];
    case "educador":
    case "formador":
      return [inicio, { ...I.minhasTurmas, titulo: "Turmas" }, com({ ...I.respostas, titulo: "Respostas" }, c.porRever), { ...I.conteudos, titulo: "Conteúdos" }];
    case "coordenador":
      return [inicio, { ...I.turmas, titulo: "Turmas" }, I.gestuario, I.relatorios];
    case "administrador":
      return [inicio, { ...I.painel, titulo: "Escola" }, { ...I.turmas, titulo: "Turmas" }, { ...I.membros, titulo: "Membros" }];
    case "observador":
      return [inicio, I.relatorios, cursos, comunidade];
    default:
      return [inicio, cursos, videos, comunidade];
  }
}

/**
 * Endereços que já estão no menu deste papel (barra lateral no computador e
 * tablet; abas + "Mais" no telemóvel). A página da instituição não os repete
 * nos seus separadores: cada funcionalidade fica num só lugar.
 */
export function urlsNoMenu(papel: Papel): Set<string> {
  const zero: Contadores = { porRever: 0, trabalhos: 0, avisosPorLer: 0 };
  return new Set([...abasTelemovel(papel, zero), ...navegacaoEscola(papel, zero)].map((i) => i.url));
}

/** O que não coube nas abas: vai para o painel "Mais". */
export function restoParaMais(papel: Papel | null, c: Contadores): { escola: ItemNav[]; geral: ItemNav[] } {
  const abas = new Set(abasTelemovel(papel, c).map((a) => a.url));
  return {
    escola: papel ? navegacaoEscola(papel, c).filter((i) => !abas.has(i.url)) : [],
    geral: GERAL.filter((i) => !abas.has(i.url)),
  };
}
