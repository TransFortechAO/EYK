/**
 * A área "Instituição" ainda corre sobre dados de demonstração (o backend
 * não existe). Fica visível em desenvolvimento e, noutros ambientes, só com
 * NEXT_PUBLIC_INSTITUICOES=1 — para não aparecer aos utilizadores reais antes
 * de estar ligada à eyk-api.
 */
export const INSTITUICOES_ATIVAS =
  process.env.NEXT_PUBLIC_INSTITUICOES === "1" ||
  (process.env.NEXT_PUBLIC_INSTITUICOES !== "0" && process.env.NODE_ENV === "development");
