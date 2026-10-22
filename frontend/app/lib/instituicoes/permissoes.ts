import type { AcaoAuditoria, Papel, TipoGrupo, TipoInstituicao, EstadoInstituicao, Destinatarios, Grupo, Membro } from "./tipos";

// O que cada papel pode fazer dentro de uma instituição (funcionalidade 2).
// O frontend usa isto só para mostrar ou esconder menus e botões — a
// eyk-api tem de aplicar as mesmas regras em cada pedido.

export type Acao =
  | "ver_painel"
  | "gerir_membros"
  | "convidar"
  | "aprovar_pedidos"
  | "gerir_definicoes"
  | "ver_todos_grupos"
  | "gerir_grupos"
  | "gerir_alunos"
  | "publicar_avisos"
  | "ver_avisos"
  | "criar_eventos"
  | "ver_agenda"
  | "carregar_ficheiros"
  | "ver_ficheiros"
  | "ver_consentimentos"
  | "dar_consentimento"
  | "ver_relatorios"
  | "ver_auditoria"
  | "pedir_dados"
  | "gerir_pedidos_dados";

const PERMISSOES: Record<Papel, readonly Acao[]> = {
  administrador: [
    "ver_painel",
    "gerir_membros",
    "convidar",
    "aprovar_pedidos",
    "gerir_definicoes",
    "ver_todos_grupos",
    "gerir_grupos",
    "gerir_alunos",
    "publicar_avisos",
    "ver_avisos",
    "criar_eventos",
    "ver_agenda",
    "carregar_ficheiros",
    "ver_ficheiros",
    "ver_consentimentos",
    "ver_relatorios",
    "ver_auditoria",
    "pedir_dados",
    "gerir_pedidos_dados",
  ],
  coordenador: ["ver_painel", "ver_todos_grupos", "ver_avisos", "ver_agenda", "ver_ficheiros", "ver_relatorios"],
  educador: [
    "ver_painel",
    "convidar",
    "gerir_grupos",
    "gerir_alunos",
    "publicar_avisos",
    "ver_avisos",
    "criar_eventos",
    "ver_agenda",
    "carregar_ficheiros",
    "ver_ficheiros",
  ],
  familia: ["ver_painel", "ver_avisos", "ver_agenda", "ver_ficheiros", "dar_consentimento", "pedir_dados"],
  aluno: ["ver_painel", "ver_avisos", "ver_agenda", "ver_ficheiros"],
  // Observadores só vêem painéis agregados e anonimizados.
  observador: ["ver_painel", "ver_relatorios"],
};

export function pode(papel: Papel | null | undefined, acao: Acao): boolean {
  if (!papel) return false;
  return PERMISSOES[papel].includes(acao);
}

/** Observadores nunca vêem dados pessoais (nomes, emails, fotografias). */
export function vePessoais(papel: Papel | null | undefined): boolean {
  return !!papel && papel !== "observador";
}

/**
 * Grupos visíveis: administradores e coordenadores vêem todos; os restantes
 * só os grupos a que pertencem.
 */
export function gruposVisiveis(grupos: Grupo[], membro: Pick<Membro, "papel" | "gruposIds">): Grupo[] {
  if (pode(membro.papel, "ver_todos_grupos")) return grupos;
  return grupos.filter((g) => membro.gruposIds.includes(g.id));
}

/** Um membro é destinatário de um aviso, evento ou ficheiro? */
export function eDestinatario(dest: Destinatarios, membro: Pick<Membro, "id" | "papel" | "gruposIds">): boolean {
  if (pode(membro.papel, "ver_todos_grupos") && membro.papel !== "observador") return true;
  if (dest.tipo === "instituicao") return true;
  if (dest.tipo === "grupo") return membro.gruposIds.includes(dest.grupoId);
  return dest.membroId === membro.id;
}

/**
 * Remover um membro ou mudar-lhe o papel não pode deixar a instituição sem
 * administradores ativos.
 */
export function deixaSemAdministrador(membros: Membro[], membroId: string, novoPapel: Papel | null): boolean {
  const alvo = membros.find((m) => m.id === membroId);
  if (!alvo || alvo.papel !== "administrador" || alvo.estado !== "ativo") return false;
  if (novoPapel === "administrador") return false;
  const restantes = membros.filter((m) => m.papel === "administrador" && m.estado === "ativo" && m.id !== membroId);
  return restantes.length === 0;
}

/** Numa instituição suspensa ou encerrada os dados ficam guardados, mas o acesso é bloqueado. */
export function acessoBloqueado(estado: EstadoInstituicao): boolean {
  return estado === "suspensa" || estado === "encerrada";
}

// ── Rótulos ──

export const ROTULO_PAPEL: Record<Papel, string> = {
  administrador: "Administrador",
  coordenador: "Coordenador",
  educador: "Educador",
  familia: "Família ou tutor",
  aluno: "Aluno",
  observador: "Observador",
};

export const DESCRICAO_PAPEL: Record<Papel, string> = {
  administrador: "Gere membros, turmas, definições e relatórios; convida e remove pessoas.",
  coordenador: "Vê os relatórios das turmas.",
  educador: "Gere as suas turmas; publica avisos e ficheiros; vê o progresso dos seus alunos.",
  familia: "Vê conteúdos e avisos; vê apenas o que diz respeito à sua criança.",
  aluno: "Acede aos conteúdos adequados.",
  observador: "Vê apenas painéis agregados e anonimizados.",
};

export const ROTULO_TIPO_INSTITUICAO: Record<TipoInstituicao, string> = {
  escola: "Escola",
  centro: "Centro",
  associacao: "Associação",
  universidade: "Universidade",
  entidade_publica: "Entidade pública",
  patrocinador: "Patrocinador",
};

export const ROTULO_ESTADO_INSTITUICAO: Record<EstadoInstituicao, string> = {
  preparacao: "Em preparação",
  ativa: "Ativa",
  suspensa: "Suspensa",
  encerrada: "Encerrada",
};

export const ROTULO_TIPO_GRUPO: Record<TipoGrupo, string> = {
  turma: "Turma",
  apoio: "Grupo de apoio",
  familias: "Grupo de famílias",
  outro: "Outro",
};

export const PAPEIS: Papel[] = ["administrador", "coordenador", "educador", "familia", "aluno", "observador"];

export const ROTULO_ACAO: Record<AcaoAuditoria, string> = {
  instituicao_criada: "Instituição criada",
  instituicao_estado: "Estado alterado",
  membro_adicionado: "Membro adicionado",
  membro_removido: "Membro removido",
  papel_alterado: "Papel alterado",
  convite_criado: "Convite criado",
  convite_cancelado: "Convite cancelado",
  pedido_decidido: "Pedido decidido",
  grupo_criado: "Grupo criado",
  grupo_arquivado: "Grupo arquivado",
  aluno_criado: "Perfil de criança",
  vinculo_criado: "Vínculo criado",
  vinculo_removido: "Vínculo removido",
  consentimento_alterado: "Consentimento",
  aviso_publicado: "Aviso publicado",
  evento_criado: "Evento criado",
  evento_cancelado: "Evento cancelado",
  ficheiro_carregado: "Ficheiro carregado",
  ficheiro_aberto: "Ficheiro sensível aberto",
  ficheiro_removido: "Ficheiro apagado",
  dados_exportados: "Exportação de dados",
  dados_eliminacao_pedida: "Pedido de eliminação",
  acesso_equipa_eyk: "Acesso da equipa EYK",
  quotas_alteradas: "Quotas alteradas",
};
