// Tipos da área "Instituição" (parcerias com escolas, centros, associações…).
// Espelham a especificação em docs/"EYK — Funcionalidades para parcerias e
// instituições.md". Os nomes dos campos seguem o estilo do resto do frontend
// (camelCase); o backend ainda não existe — ver ./api.ts.

export type TipoInstituicao = "escola" | "associacao" | "universidade" | "entidade_publica" | "patrocinador" | "centro";
export type EstadoInstituicao = "preparacao" | "ativa" | "suspensa" | "encerrada";

export type Instituicao = {
  id: string;
  nome: string;
  tipo: TipoInstituicao;
  provincia: string;
  estado: EstadoInstituicao;
  responsavel: { nome: string; email: string };
  criadaEm: string;
  quotas: {
    armazenamentoMb: number;
    ficheiroMaxMb: number;
    utilizadoresMax: number;
  };
  /** Pedidos feitos por código precisam de aprovação do administrador. */
  aprovarPedidosPorCodigo: boolean;
  /** Canais de aviso que a instituição ativou para as famílias. */
  canaisAviso: CanalAviso[];
};

// ── 2. Papéis ──
export type Papel = "administrador" | "coordenador" | "educador" | "familia" | "aluno" | "observador";

export type Membro = {
  id: string;
  instituicaoId: string;
  utilizadorId: number;
  nome: string;
  email: string;
  papel: Papel;
  estado: "ativo" | "pendente" | "removido";
  desde: string;
  ultimoAcesso: string | null;
  gruposIds: string[];
};

/** Pertença do utilizador autenticado: uma por instituição. */
export type Pertenca = {
  instituicao: Instituicao;
  membro: Membro;
};

// ── 3. Convites e códigos ──
export type CanalConvite = "email" | "sms" | "codigo";
export type EstadoConvite = "pendente" | "aceite" | "expirado" | "cancelado";

export type Convite = {
  id: string;
  instituicaoId: string;
  canal: CanalConvite;
  /** Email ou telefone; vazio para códigos partilháveis. */
  destino: string;
  codigo: string;
  papel: Papel;
  grupoId: string | null;
  /** Para convites de família ligados a uma criança (funcionalidade 5). */
  alunoId: string | null;
  usos: number;
  usosMax: number;
  criadoPor: string;
  criadoEm: string;
  expiraEm: string;
  estado: EstadoConvite;
};

export type PedidoAdesao = {
  id: string;
  instituicaoId: string;
  conviteId: string;
  nome: string;
  email: string;
  papel: Papel;
  grupoId: string | null;
  pedidoEm: string;
  estado: "pendente" | "aprovado" | "rejeitado";
};

// ── 4. Turmas e grupos ──
export type TipoGrupo = "turma" | "apoio" | "familias" | "outro";

export type Grupo = {
  id: string;
  instituicaoId: string;
  nome: string;
  tipo: TipoGrupo;
  anoLetivo: string;
  arquivado: boolean;
  criadoEm: string;
};

// ── 5. Vínculo família-aluno ──
export type PerfilAluno = {
  id: string;
  instituicaoId: string;
  /** Nome ou alcunha — o mínimo de dados. */
  nome: string;
  grupoId: string | null;
  tutoresIds: string[];
  /**
   * "Sem consentimento de utilização, não há perfil de criança": o perfil
   * nasce à espera do consentimento do tutor e só fica ativo depois dele.
   * Se o consentimento for retirado, sai dos relatórios e fica inativo.
   */
  estado: "aguarda_consentimento" | "ativo" | "consentimento_retirado";
  criadoEm: string;
};

// ── 6. Avisos ──
export type CanalAviso = "plataforma" | "email";
export type Destinatarios =
  | { tipo: "instituicao" }
  | { tipo: "grupo"; grupoId: string }
  | { tipo: "pessoa"; membroId: string };

export type Aviso = {
  id: string;
  instituicaoId: string;
  titulo: string;
  mensagem: string;
  destinatarios: Destinatarios;
  autor: string;
  autorId: string;
  publicadoEm: string;
  pedirConfirmacao: boolean;
  anexosIds: string[];
  /** Contagens agregadas: o remetente vê números, não quem não leu. */
  recebidos: number;
  lidos: number;
  confirmados: number;
  /** Do ponto de vista do utilizador atual. */
  lidoPorMim: boolean;
  confirmadoPorMim: boolean;
};

export type PreferenciasAviso = {
  plataforma: boolean;
  email: boolean;
};

// ── 7. Agenda ──
export type Recorrencia = "nenhuma" | "semanal" | "mensal";
export type RespostaPresenca = "vou" | "nao_vou" | "talvez";

export type Evento = {
  id: string;
  instituicaoId: string;
  titulo: string;
  descricao: string;
  inicio: string;
  fim: string;
  local: string;
  ligacao: string;
  destinatarios: Destinatarios;
  recorrencia: Recorrencia;
  lembretes: ("1d" | "1h")[];
  cancelado: boolean;
  criadoPor: string;
  presencas: Record<RespostaPresenca, number>;
  minhaResposta: RespostaPresenca | null;
};

// ── 8. Ficheiros ──
export type CategoriaFicheiro = "documento" | "imagem" | "audio" | "video";
export type EstadoFicheiro = "a_verificar" | "disponivel" | "bloqueado";

export type FicheiroInstituicao = {
  id: string;
  instituicaoId: string;
  nome: string;
  categoria: CategoriaFicheiro;
  tamanhoBytes: number;
  visibilidade: Destinatarios;
  /** Contém fotos ou vídeos de crianças: exige o consentimento correspondente. */
  temCriancas: boolean;
  estado: EstadoFicheiro;
  carregadoPor: string;
  carregadoEm: string;
};

// ── 9. Consentimentos ──
export type FinalidadeConsentimento = "utilizacao" | "fotografias" | "relatorios";

export type TextoConsentimento = {
  versao: string;
  publicadoEm: string;
  finalidades: { id: FinalidadeConsentimento; titulo: string; descricao: string; obrigatoria: boolean }[];
  resumo: string[];
};

export type Consentimento = {
  id: string;
  instituicaoId: string;
  alunoId: string;
  tutorId: string;
  tutorNome: string;
  finalidade: FinalidadeConsentimento;
  aceite: boolean;
  versaoTexto: string;
  registadoEm: string;
  /** Registado com apoio presencial da instituição. */
  comApoio: boolean;
};

// ── 10. Relatório de utilização ──
export type IndicadorSemanal = { semana: string; n: number };

export type RelatorioUtilizacao = {
  geradoEm: string;
  definicaoAtivo: string;
  utilizadores: { total: number; ativos30d: number; porPapel: Partial<Record<Papel, number>> };
  acessosPorSemana: IndicadorSemanal[];
  conteudosMaisUsados: { titulo: string; acessos: number }[];
  avisos: { publicados: number; taxaLeitura: number | null };
  eventos: { criados: number; confirmacoes: number };
  grupos: {
    grupoId: string;
    nome: string;
    membros: number;
    /** null quando o grupo tem menos de LIMITE_ANONIMATO pessoas. */
    ativos30d: number | null;
    acessos30d: number | null;
    oculto: boolean;
  }[];
};

// ── 11. Auditoria ──
export type AcaoAuditoria =
  | "instituicao_criada"
  | "instituicao_estado"
  | "membro_adicionado"
  | "membro_removido"
  | "papel_alterado"
  | "convite_criado"
  | "convite_cancelado"
  | "pedido_decidido"
  | "grupo_criado"
  | "grupo_arquivado"
  | "aluno_criado"
  | "vinculo_criado"
  | "vinculo_removido"
  | "consentimento_alterado"
  | "aviso_publicado"
  | "evento_criado"
  | "evento_cancelado"
  | "ficheiro_carregado"
  | "ficheiro_aberto"
  | "ficheiro_removido"
  | "dados_exportados"
  | "dados_eliminacao_pedida"
  | "acesso_equipa_eyk"
  | "quotas_alteradas";

export type RegistoAuditoria = {
  id: string;
  instituicaoId: string;
  quando: string;
  quem: string;
  /** "equipa_eyk" quando o acesso é feito pela equipa interna. */
  origem: "instituicao" | "equipa_eyk";
  acao: AcaoAuditoria;
  detalhe: string;
};

// ── 12. Exportação e eliminação ──
export type AmbitoDados = "crianca" | "familia" | "instituicao";

export type PedidoDados = {
  id: string;
  instituicaoId: string;
  tipo: "exportacao" | "eliminacao";
  ambito: AmbitoDados;
  alvo: string;
  pedidoPor: string;
  pedidoEm: string;
  estado: "recebido" | "em_curso" | "concluido" | "recusado";
  prazo: string;
  ficheiroPronto: boolean;
  nota?: string;
};
