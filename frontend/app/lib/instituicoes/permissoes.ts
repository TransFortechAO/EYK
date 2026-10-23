import type {
  AcaoAuditoria,
  Competencia,
  Destinatarios,
  EstadoInstituicao,
  Grupo,
  Membro,
  NivelLga,
  Papel,
  PublicoTurmaLga,
  TemaGesto,
  TipoGrupo,
  TipoInstituicao,
} from "./tipos";

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
  | "gerir_pedidos_dados"
  // Ensino de LGA
  | "ver_turmas_lga"
  | "gerir_turmas_lga"
  | "publicar_aulas"
  | "rever_respostas"
  | "responder_aulas"
  | "propor_gestos"
  | "validar_gestos"
  | "praticar"
  | "publicar_conteudos"
  | "publicar_na_turma"
  | "moderar_turma"
  | "criar_desafios";

/** O que quem ensina LGA (educador ou formador) pode fazer nas suas turmas. */
const ENSINAR_LGA: Acao[] = [
  "ver_turmas_lga",
  "gerir_turmas_lga",
  "publicar_aulas",
  "rever_respostas",
  "propor_gestos",
  "praticar",
  "publicar_conteudos",
  "publicar_na_turma",
  "moderar_turma",
  "criar_desafios",
];

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
    // A administração abre turmas e publica conteúdos, mas não vê os vídeos
    // das crianças (só o professor da turma e a família).
    "ver_turmas_lga",
    "gerir_turmas_lga",
    "publicar_aulas",
    "praticar",
    "publicar_conteudos",
    "moderar_turma",
    "criar_desafios",
  ],
  coordenador: ["ver_painel", "ver_todos_grupos", "ver_avisos", "ver_agenda", "ver_ficheiros", "ver_relatorios", "ver_turmas_lga", "propor_gestos", "validar_gestos", "praticar"],
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
    ...ENSINAR_LGA,
  ],
  // Formador de LGA (de preferência surdo): ensina nas turmas e valida os gestos do gestuário.
  formador: [
    "ver_painel",
    "convidar",
    "publicar_avisos",
    "ver_avisos",
    "criar_eventos",
    "ver_agenda",
    "carregar_ficheiros",
    "ver_ficheiros",
    ...ENSINAR_LGA,
    "validar_gestos",
  ],
  familia: ["ver_painel", "ver_avisos", "ver_agenda", "ver_ficheiros", "dar_consentimento", "pedir_dados", "ver_turmas_lga", "praticar"],
  aluno: ["ver_painel", "ver_avisos", "ver_agenda", "ver_ficheiros", "ver_turmas_lga", "responder_aulas", "praticar", "publicar_na_turma"],
  // Observadores só vêem painéis agregados e anonimizados.
  observador: ["ver_painel", "ver_relatorios"],
};

/** Quem ensina numa turma (vê as respostas em vídeo dos alunos dessa turma). */
export function ensina(papel: Papel | null | undefined): boolean {
  return papel === "educador" || papel === "formador";
}

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
  formador: "Formador de LGA",
  familia: "Família ou tutor",
  aluno: "Aluno",
  observador: "Observador",
};

export const DESCRICAO_PAPEL: Record<Papel, string> = {
  administrador: "Gere membros, turmas, definições e relatórios; convida e remove pessoas.",
  coordenador: "Vê os relatórios das turmas e valida os gestos do gestuário.",
  educador: "Gere as suas turmas; publica aulas, avisos e ficheiros; corrige as respostas em vídeo dos seus alunos.",
  formador: "Ensina LGA nas turmas, corrige as respostas em vídeo e valida os gestos do gestuário.",
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
  turma_lga: "Turma LGA",
  apoio: "Grupo de apoio",
  familias: "Grupo de famílias",
  outro: "Outro",
};

export const PAPEIS: Papel[] = ["administrador", "coordenador", "educador", "formador", "familia", "aluno", "observador"];

export const ROTULO_PUBLICO_LGA: Record<PublicoTurmaLga, string> = {
  surdos_l1: "Alunos surdos (LGA como primeira língua)",
  ouvintes: "Ouvintes a aprender LGA",
  familias: "Famílias",
  professores: "Professores em formação",
};

export const DESCRICAO_PUBLICO_LGA: Record<PublicoTurmaLga, string> = {
  surdos_l1: "Aulas totalmente em LGA, com vocabulário escolar e leitura e escrita do português como segunda língua.",
  ouvintes: "Colegas e irmãos que querem comunicar com amigos surdos. Começa pelo alfabeto manual e saudações.",
  familias: "Pais e tutores de crianças surdas: gestos do dia a dia para usar em casa.",
  professores: "Docentes que querem ensinar e comunicar em LGA. Conclui com certificado.",
};

export const ROTULO_NIVEL_LGA: Record<NivelLga, string> = {
  iniciacao: "Iniciação",
  intermedio: "Intermédio",
  avancado: "Avançado",
};

export const ROTULO_TEMA: Record<TemaGesto, string> = {
  alfabeto: "Alfabeto manual",
  numeros: "Números",
  saudacoes: "Saudações",
  escola: "Escola",
  familia: "Família",
  emocoes: "Emoções",
  quotidiano: "Quotidiano",
  frases: "Frases",
};

export const ROTULO_COMPETENCIA: Record<Competencia, string> = {
  alfabeto: "Alfabeto manual",
  numeros: "Números",
  vocabulario: "Vocabulário",
  frases: "Frases",
};

/** Competência a que um tema de gesto pertence. */
export function competenciaDoTema(tema: TemaGesto): Competencia {
  if (tema === "alfabeto") return "alfabeto";
  if (tema === "numeros") return "numeros";
  if (tema === "frases") return "frases";
  return "vocabulario";
}

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
  turma_criada: "Turma LGA aberta",
  aula_publicada: "Aula publicada",
  resposta_revista: "Resposta em vídeo revista",
  gesto_proposto: "Gesto proposto",
  gesto_validado: "Gesto validado",
  conteudo_publicado: "Conteúdo publicado",
  post_turma_oculto: "Publicação da turma escondida",
};
