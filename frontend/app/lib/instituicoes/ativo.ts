/**
 * Escolas, pertenças e convites já estão no servidor; o resto da área
 * "Instituição" (turmas, conteúdos…) ainda corre sobre dados locais. Fica visível
 * em desenvolvimento e, noutros ambientes, só com NEXT_PUBLIC_INSTITUICOES=1 — sem
 * isso o link do convite por email não abre a área da escola em produção.
 */
export const INSTITUICOES_ATIVAS =
  process.env.NEXT_PUBLIC_INSTITUICOES === "1" ||
  (process.env.NEXT_PUBLIC_INSTITUICOES !== "0" && process.env.NODE_ENV === "development");
