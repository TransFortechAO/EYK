// API da área "Instituição".
//
// O backend destas funcionalidades ainda não existe: por agora, tudo corre
// em memória sobre os dados de demonstração (./demo.ts), guardados no
// localStorage do browser para sobreviverem a um recarregar. As funções têm
// já a forma dos pedidos à eyk-api — quando os endpoints existirem, cada uma
// passa a chamar `request()` de @/lib/api e o resto do frontend não muda.
//
// As regras da especificação são aplicadas aqui (e terão de ser aplicadas
// também no backend): pelo menos um administrador, consentimento antes do
// perfil da criança, convites com validade e limite de usos, relatórios sem
// detalhe de grupos com menos de 5 pessoas, auditoria de ações sensíveis…
import { criarEstadoDemo, TEXTO_CONSENTIMENTO, type EstadoDemo } from "./demo";
import { acessoBloqueado, deixaSemAdministrador, eDestinatario, gruposVisiveis, pode, ROTULO_PAPEL, vePessoais, type Acao } from "./permissoes";
import type {
  AcaoAuditoria,
  AmbitoDados,
  Aviso,
  CanalConvite,
  CategoriaFicheiro,
  Consentimento,
  Convite,
  Destinatarios,
  EstadoInstituicao,
  Evento,
  FicheiroInstituicao,
  FinalidadeConsentimento,
  Grupo,
  Instituicao,
  Membro,
  Papel,
  PedidoAdesao,
  PedidoDados,
  PerfilAluno,
  Pertenca,
  PreferenciasAviso,
  Recorrencia,
  RegistoAuditoria,
  RelatorioUtilizacao,
  RespostaPresenca,
  TextoConsentimento,
  TipoGrupo,
  TipoInstituicao,
} from "./tipos";

/** Grupos com menos pessoas do que isto não mostram detalhe nos relatórios. */
export const LIMITE_ANONIMATO = 5;
export const VALIDADE_CONVITE_DIAS = 14;
export const DEFINICAO_ATIVO = "Pelo menos um acesso nos últimos 30 dias.";

const DIA = 24 * 60 * 60 * 1000;
const CHAVE_LOCAL = "eyk-instituicoes-demo-v3";
const ATRASO_MS = 120;

export class ErroInstituicao extends Error {}

// ── Estado e sessão de demonstração ──

let estado: EstadoDemo | null = null;
/** Pessoa (utilizadorId) com que a demonstração está a ser vista. */
let utilizadorDemo = 1001;

function carregar(): EstadoDemo {
  if (estado) return estado;
  if (typeof window !== "undefined") {
    try {
      const guardado = window.localStorage.getItem(CHAVE_LOCAL);
      if (guardado) {
        estado = JSON.parse(guardado) as EstadoDemo;
        return estado;
      }
    } catch {
      /* localStorage indisponível ou corrompido: recomeça */
    }
  }
  estado = criarEstadoDemo();
  return estado;
}

function guardar() {
  if (typeof window === "undefined" || !estado) return;
  try {
    window.localStorage.setItem(CHAVE_LOCAL, JSON.stringify(estado));
  } catch {
    /* sem espaço ou bloqueado: a demo continua só em memória */
  }
}

async function esperar() {
  if (typeof window !== "undefined") await new Promise((r) => setTimeout(r, ATRASO_MS));
}

function novoId(prefixo: string) {
  const e = carregar();
  e.seq += 1;
  return `${prefixo}-${e.seq}`;
}

function gerarCodigo(): string {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += letras[Math.floor(Math.random() * letras.length)];
  return s;
}

function instituicao(id: string): Instituicao {
  const inst = carregar().instituicoes.find((i) => i.id === id);
  if (!inst) throw new ErroInstituicao("Instituição não encontrada.");
  return inst;
}

/** O membro atual nesta instituição — e a garantia de que pode aceder-lhe. */
function eu(instituicaoId: string): Membro {
  const inst = instituicao(instituicaoId);
  const m = carregar().membros.find(
    (x) => x.instituicaoId === instituicaoId && x.utilizadorId === utilizadorDemo && x.estado === "ativo",
  );
  if (!m) throw new ErroInstituicao("Não pertences a esta instituição.");
  if (acessoBloqueado(inst.estado)) {
    throw new ErroInstituicao(
      inst.estado === "suspensa"
        ? "O acesso a esta instituição está suspenso. Os dados continuam guardados."
        : "Esta instituição foi encerrada.",
    );
  }
  return m;
}

function exigir(instituicaoId: string, acao: Acao): Membro {
  const m = eu(instituicaoId);
  if (!pode(m.papel, acao)) throw new ErroInstituicao("O teu papel não permite esta ação.");
  return m;
}

function auditar(
  instituicaoId: string,
  acao: AcaoAuditoria,
  detalhe: string,
  quem?: string,
  origem: RegistoAuditoria["origem"] = "instituicao",
) {
  const e = carregar();
  const autor =
    quem ?? e.membros.find((m) => m.instituicaoId === instituicaoId && m.utilizadorId === utilizadorDemo)?.nome ?? "Sistema";
  e.auditoria.unshift({
    id: novoId("au"),
    instituicaoId,
    quando: new Date().toISOString(),
    quem: autor,
    origem,
    acao,
    detalhe,
  });
}

function descreverDestino(d: Destinatarios): string {
  const e = carregar();
  if (d.tipo === "instituicao") return "toda a instituição";
  if (d.tipo === "grupo") return e.grupos.find((g) => g.id === d.grupoId)?.nome ?? "um grupo";
  return e.membros.find((m) => m.id === d.membroId)?.nome ?? "uma pessoa";
}

/** Membros (ativos) que recebem algo dirigido a estes destinatários. */
function destinatariosDe(instituicaoId: string, d: Destinatarios): Membro[] {
  return carregar().membros.filter(
    (m) =>
      m.instituicaoId === instituicaoId &&
      m.estado === "ativo" &&
      (d.tipo === "instituicao" || (d.tipo === "grupo" ? m.gruposIds.includes(d.grupoId) : m.id === d.membroId)),
  );
}

/** Expira os convites cujo prazo passou (no backend: tarefa do agendador). */
function expirarConvites() {
  const agora = Date.now();
  for (const c of carregar().convites) {
    if (c.estado === "pendente" && new Date(c.expiraEm).getTime() < agora) c.estado = "expirado";
  }
}

/** Número pseudo-aleatório estável a partir de um texto (dados sintéticos de acessos). */
function hash(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// ── Sessão de demonstração ──

export type PessoaDemo = { utilizadorId: number; nome: string; descricao: string };

export const PESSOAS_DEMO: PessoaDemo[] = [
  { utilizadorId: 1001, nome: "Ana Domingos", descricao: "Administradora na Escola 123 · educadora na Associação" },
  { utilizadorId: 1002, nome: "Paulo Neto", descricao: "Coordenador" },
  { utilizadorId: 1003, nome: "Maria Kiala", descricao: "Educadora — turmas LGA da 3.ª A, famílias e professores" },
  { utilizadorId: 1030, nome: "Domingos Sapalo", descricao: "Educador surdo — ensina LGA e valida o gestuário" },
  { utilizadorId: 1008, nome: "Rosa Lopes", descricao: "Família — tutora de Kiesse" },
  { utilizadorId: 1006, nome: "Kiesse Lopes", descricao: "Aluno da Turma LGA da 3.ª A" },
  { utilizadorId: 1105, nome: "Wezo Sebastião", descricao: "Aluno sem consentimento para respostas em vídeo" },
];

const CHAVE_PESSOA = "eyk-instituicoes-pessoa-demo";

/**
 * Quem está a usar a área: a conta real (pertenças verdadeiras, sem guardar) ou,
 * na pré-visualização, a pessoa escolhida em "Ver como" (guardada no browser).
 */
export function definirPessoaDemo(utilizadorId: number, persistir = true) {
  utilizadorDemo = utilizadorId;
  if (!persistir || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE_PESSOA, String(utilizadorId));
  } catch {
    /* sem localStorage: a escolha dura só esta visita */
  }
}

/**
 * Esta conta pertence a alguma escola? Só quem foi registado pela escola (convite
 * por email/código aceite) tem as funcionalidades de escola; as contas criadas
 * de forma normal vêem a plataforma pública.
 */
export function temPertenca(utilizadorId: number): boolean {
  const e = carregar();
  return e.membros.some(
    (m) => m.utilizadorId === utilizadorId && m.estado === "ativo" && e.instituicoes.some((i) => i.id === m.instituicaoId && i.estado !== "preparacao"),
  );
}

/** Repõe a pessoa escolhida em "Ver como" (só para a pré-visualização em /instituicao). */
export function restaurarPessoaDemo(): number {
  if (typeof window === "undefined") return utilizadorDemo;
  try {
    const guardada = Number(window.localStorage.getItem(CHAVE_PESSOA));
    if (guardada) utilizadorDemo = guardada;
  } catch {
    /* ignora */
  }
  return utilizadorDemo;
}

export function pessoaDemo(): number {
  return utilizadorDemo;
}

/** Volta aos dados de demonstração iniciais. */
export function reporDemo(agora?: number) {
  estado = criarEstadoDemo(agora);
  guardar();
}

// ── Projeções (o que o frontend recebe) ──

function projetarAviso(a: Aviso, m: Membro): Aviso {
  const e = carregar();
  const leitura = e.leituras[a.id] ?? { lidos: [], confirmados: [] };
  const recebidos = destinatariosDe(a.instituicaoId, a.destinatarios).filter((x) => x.id !== a.autorId);
  const ids = new Set(recebidos.map((r) => r.id));
  return {
    ...a,
    recebidos: recebidos.length,
    lidos: leitura.lidos.filter((id) => ids.has(id)).length,
    confirmados: leitura.confirmados.filter((id) => ids.has(id)).length,
    lidoPorMim: leitura.lidos.includes(m.id),
    confirmadoPorMim: leitura.confirmados.includes(m.id),
  };
}

function projetarEvento(ev: Evento, m: Membro): Evento {
  const respostas = carregar().respostas[ev.id] ?? {};
  const presencas = { vou: 0, nao_vou: 0, talvez: 0 };
  for (const r of Object.values(respostas)) presencas[r] += 1;
  return { ...ev, presencas, minhaResposta: respostas[m.id] ?? null };
}

// ════════════════════════════════════════════════════════════════════
//  API
// ════════════════════════════════════════════════════════════════════

export const apiInstituicoes = {
  // ── 1. Espaço da instituição ──

  /** GET /api/instituicoes/minhas/ — as instituições a que o utilizador pertence. */
  async minhasPertencas(): Promise<Pertenca[]> {
    await esperar();
    const e = carregar();
    return e.membros
      .filter((m) => m.utilizadorId === utilizadorDemo && m.estado === "ativo")
      .map((m) => ({ instituicao: instituicao(m.instituicaoId), membro: m }))
      .filter((p) => p.instituicao.estado !== "preparacao");
  },

  async atualizarDefinicoes(
    instituicaoId: string,
    dados: Partial<Pick<Instituicao, "aprovarPedidosPorCodigo" | "canaisAviso" | "escola">>,
  ): Promise<Instituicao> {
    await esperar();
    exigir(instituicaoId, "gerir_definicoes");
    const inst = instituicao(instituicaoId);
    Object.assign(inst, dados);
    guardar();
    return inst;
  },

  // ── 2. Membros e papéis ──

  /** GET /api/instituicoes/:id/membros/ */
  async listarMembros(instituicaoId: string): Promise<Membro[]> {
    await esperar();
    const m = eu(instituicaoId);
    if (!vePessoais(m.papel)) throw new ErroInstituicao("O teu papel não permite ver dados pessoais.");
    const todos = carregar().membros.filter((x) => x.instituicaoId === instituicaoId && x.estado !== "removido");
    if (pode(m.papel, "gerir_membros") || pode(m.papel, "ver_todos_grupos")) return todos;
    // Educadores: só quem partilha grupos com eles.
    if (m.papel === "educador") return todos.filter((x) => x.id === m.id || x.gruposIds.some((g) => m.gruposIds.includes(g)));
    return [m];
  },

  /** PATCH /api/instituicoes/:id/membros/:membroId/ */
  async alterarPapel(instituicaoId: string, membroId: string, papel: Papel): Promise<Membro> {
    await esperar();
    exigir(instituicaoId, "gerir_membros");
    const e = carregar();
    const doInst = e.membros.filter((m) => m.instituicaoId === instituicaoId);
    const alvo = doInst.find((m) => m.id === membroId);
    if (!alvo) throw new ErroInstituicao("Membro não encontrado.");
    if (deixaSemAdministrador(doInst, membroId, papel)) {
      throw new ErroInstituicao("A instituição tem de ter sempre pelo menos um administrador.");
    }
    const antes = alvo.papel;
    alvo.papel = papel;
    auditar(instituicaoId, "papel_alterado", `${alvo.nome}: ${ROTULO_PAPEL[antes]} → ${ROTULO_PAPEL[papel]}.`);
    guardar();
    return alvo;
  },

  /** DELETE /api/instituicoes/:id/membros/:membroId/ */
  async removerMembro(instituicaoId: string, membroId: string): Promise<void> {
    await esperar();
    exigir(instituicaoId, "gerir_membros");
    const e = carregar();
    const doInst = e.membros.filter((m) => m.instituicaoId === instituicaoId);
    const alvo = doInst.find((m) => m.id === membroId);
    if (!alvo) throw new ErroInstituicao("Membro não encontrado.");
    if (deixaSemAdministrador(doInst, membroId, null)) {
      throw new ErroInstituicao("A instituição tem de ter sempre pelo menos um administrador.");
    }
    alvo.estado = "removido";
    // Deixa de ser tutor de qualquer criança.
    for (const a of e.alunos) a.tutoresIds = a.tutoresIds.filter((t) => t !== membroId);
    auditar(instituicaoId, "membro_removido", `${alvo.nome} (${ROTULO_PAPEL[alvo.papel]}) removido da instituição.`);
    guardar();
  },

  // ── 3. Convites e códigos de adesão ──

  async listarConvites(instituicaoId: string): Promise<Convite[]> {
    await esperar();
    const m = exigir(instituicaoId, "convidar");
    expirarConvites();
    const todos = carregar().convites.filter((c) => c.instituicaoId === instituicaoId);
    // Educadores vêem os convites dos seus grupos.
    return pode(m.papel, "gerir_membros") ? todos : todos.filter((c) => !c.grupoId || m.gruposIds.includes(c.grupoId));
  },

  /** POST /api/instituicoes/:id/convites/ */
  async criarConvite(
    instituicaoId: string,
    dados: {
      canal: CanalConvite;
      destino: string;
      papel: Papel;
      grupoId: string | null;
      alunoId: string | null;
      usosMax: number;
      validadeDias?: number;
    },
  ): Promise<Convite> {
    await esperar();
    const m = exigir(instituicaoId, "convidar");
    if (!pode(m.papel, "gerir_membros") && !["familia", "aluno"].includes(dados.papel)) {
      throw new ErroInstituicao("Educadores só podem convidar famílias e alunos.");
    }
    if (dados.grupoId && !pode(m.papel, "ver_todos_grupos") && !m.gruposIds.includes(dados.grupoId)) {
      throw new ErroInstituicao("Só podes convidar para os teus grupos.");
    }
    if (dados.canal === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dados.destino)) {
      throw new ErroInstituicao("Email inválido.");
    }
    if (dados.canal === "sms" && dados.destino.replace(/\D/g, "").length < 9) {
      throw new ErroInstituicao("Número de telemóvel inválido.");
    }
    if (dados.alunoId && dados.papel !== "familia") {
      throw new ErroInstituicao("Só convites de família podem ficar ligados a uma criança.");
    }
    const validade = dados.validadeDias ?? VALIDADE_CONVITE_DIAS;
    const agora = Date.now();
    const convite: Convite = {
      id: novoId("cv"),
      instituicaoId,
      canal: dados.canal,
      destino: dados.canal === "codigo" ? "" : dados.destino.trim(),
      codigo: gerarCodigo(),
      papel: dados.papel,
      grupoId: dados.grupoId,
      alunoId: dados.alunoId,
      usos: 0,
      usosMax: dados.canal === "codigo" ? Math.max(1, Math.min(500, dados.usosMax)) : 1,
      criadoPor: m.nome,
      criadoEm: new Date(agora).toISOString(),
      expiraEm: new Date(agora + validade * DIA).toISOString(),
      estado: "pendente",
    };
    carregar().convites.unshift(convite);
    auditar(
      instituicaoId,
      "convite_criado",
      `Convite (${convite.canal}) como ${ROTULO_PAPEL[convite.papel]}${convite.grupoId ? ` para ${descreverDestino({ tipo: "grupo", grupoId: convite.grupoId })}` : ""}.`,
    );
    guardar();
    return convite;
  },

  async cancelarConvite(instituicaoId: string, conviteId: string): Promise<void> {
    await esperar();
    exigir(instituicaoId, "convidar");
    const c = carregar().convites.find((x) => x.id === conviteId && x.instituicaoId === instituicaoId);
    if (!c) throw new ErroInstituicao("Convite não encontrado.");
    if (c.estado !== "pendente") throw new ErroInstituicao("Este convite já não está ativo.");
    c.estado = "cancelado";
    auditar(instituicaoId, "convite_cancelado", `Convite ${c.codigo} cancelado.`);
    guardar();
  },

  async listarPedidosAdesao(instituicaoId: string): Promise<PedidoAdesao[]> {
    await esperar();
    exigir(instituicaoId, "aprovar_pedidos");
    return carregar().pedidosAdesao.filter((p) => p.instituicaoId === instituicaoId);
  },

  async decidirPedido(instituicaoId: string, pedidoId: string, aprovar: boolean): Promise<void> {
    await esperar();
    exigir(instituicaoId, "aprovar_pedidos");
    const e = carregar();
    const p = e.pedidosAdesao.find((x) => x.id === pedidoId && x.instituicaoId === instituicaoId);
    if (!p || p.estado !== "pendente") throw new ErroInstituicao("Pedido não encontrado ou já decidido.");
    p.estado = aprovar ? "aprovado" : "rejeitado";
    if (aprovar) {
      e.membros.push({
        id: novoId("m"),
        instituicaoId,
        utilizadorId: p.utilizadorId ?? 5000 + e.seq,
        nome: p.nome,
        email: p.email,
        papel: p.papel,
        estado: "ativo",
        desde: new Date().toISOString(),
        ultimoAcesso: null,
        gruposIds: p.grupoId ? [p.grupoId] : [],
      });
    }
    auditar(instituicaoId, "pedido_decidido", `Pedido de ${p.nome} (${ROTULO_PAPEL[p.papel]}) ${aprovar ? "aprovado" : "rejeitado"}.`);
    guardar();
  },

  /** GET /api/instituicoes/aderir/:codigo/ — o que o código dá, antes de aderir. */
  async consultarCodigo(codigo: string, utilizadorId: number = utilizadorDemo): Promise<{
    instituicao: string;
    papel: Papel;
    grupo: string | null;
    aluno: { id: string; nome: string } | null;
    requerAprovacao: boolean;
    pedeConsentimento: boolean;
    jaMembro: boolean;
  }> {
    await esperar();
    expirarConvites();
    const e = carregar();
    const c = e.convites.find((x) => x.codigo.toUpperCase() === codigo.trim().toUpperCase());
    if (!c) throw new ErroInstituicao("Código não encontrado. Confirma as letras e os números.");
    if (c.estado === "expirado") throw new ErroInstituicao("Este convite expirou. Pede um novo à instituição.");
    if (c.estado !== "pendente") throw new ErroInstituicao("Este convite já não está ativo.");
    if (c.usos >= c.usosMax) throw new ErroInstituicao("Este código já atingiu o número máximo de utilizações.");
    const inst = instituicao(c.instituicaoId);
    if (inst.estado !== "ativa") throw new ErroInstituicao("A instituição não está a aceitar novos membros.");
    const aluno = c.alunoId ? e.alunos.find((a) => a.id === c.alunoId) ?? null : null;
    return {
      instituicao: inst.nome,
      papel: c.papel,
      grupo: c.grupoId ? e.grupos.find((g) => g.id === c.grupoId)?.nome ?? null : null,
      aluno: aluno ? { id: aluno.id, nome: aluno.nome } : null,
      requerAprovacao: c.canal === "codigo" && inst.aprovarPedidosPorCodigo,
      pedeConsentimento: c.papel === "familia" && !!aluno,
      jaMembro: e.membros.some((m) => m.instituicaoId === inst.id && m.utilizadorId === utilizadorId && m.estado === "ativo"),
    };
  },

  /** POST /api/instituicoes/aderir/:codigo/ */
  async aderir(
    codigo: string,
    dados: {
      nome: string;
      email: string;
      consentimentos?: Partial<Record<FinalidadeConsentimento, boolean>>;
      comApoio?: boolean;
      /** A conta que adere (a conta com sessão iniciada); por omissão, a pessoa atual. */
      utilizadorId?: number;
    },
  ): Promise<{ resultado: "membro" | "pendente"; instituicaoId: string }> {
    const quem = dados.utilizadorId ?? utilizadorDemo;
    const info = await apiInstituicoes.consultarCodigo(codigo, quem);
    const e = carregar();
    const c = e.convites.find((x) => x.codigo.toUpperCase() === codigo.trim().toUpperCase())!;
    if (info.pedeConsentimento) {
      const obrigatorias = TEXTO_CONSENTIMENTO.finalidades.filter((f) => f.obrigatoria).map((f) => f.id);
      if (!obrigatorias.every((f) => dados.consentimentos?.[f])) {
        throw new ErroInstituicao("Sem o consentimento de utilização, a criança não pode ter perfil na instituição.");
      }
    }
    c.usos += 1;
    if (c.usos >= c.usosMax && c.canal !== "codigo") c.estado = "aceite";

    if (info.requerAprovacao) {
      e.pedidosAdesao.unshift({
        id: novoId("pa"),
        instituicaoId: c.instituicaoId,
        conviteId: c.id,
        nome: dados.nome,
        email: dados.email,
        papel: c.papel,
        grupoId: c.grupoId,
        pedidoEm: new Date().toISOString(),
        estado: "pendente",
        utilizadorId: quem,
      });
      guardar();
      return { resultado: "pendente", instituicaoId: c.instituicaoId };
    }

    let membro = e.membros.find((m) => m.instituicaoId === c.instituicaoId && m.utilizadorId === quem);
    if (!membro) {
      membro = {
        id: novoId("m"),
        instituicaoId: c.instituicaoId,
        utilizadorId: quem,
        nome: dados.nome,
        email: dados.email,
        papel: c.papel,
        estado: "ativo",
        desde: new Date().toISOString(),
        ultimoAcesso: new Date().toISOString(),
        gruposIds: [],
      };
      e.membros.push(membro);
    }
    membro.estado = "ativo";
    if (c.grupoId && !membro.gruposIds.includes(c.grupoId)) membro.gruposIds.push(c.grupoId);
    auditar(c.instituicaoId, "membro_adicionado", `${membro.nome} aderiu como ${ROTULO_PAPEL[c.papel]} (convite ${c.codigo}).`, membro.nome);

    if (c.alunoId) {
      const aluno = e.alunos.find((a) => a.id === c.alunoId);
      if (aluno && !aluno.tutoresIds.includes(membro.id)) {
        aluno.tutoresIds.push(membro.id);
        auditar(c.instituicaoId, "vinculo_criado", `${membro.nome} é agora tutor de ${aluno.nome}.`, membro.nome);
      }
      for (const f of TEXTO_CONSENTIMENTO.finalidades) {
        registar(c.instituicaoId, c.alunoId, membro, f.id, !!dados.consentimentos?.[f.id], !!dados.comApoio);
      }
    }
    guardar();
    return { resultado: "membro", instituicaoId: c.instituicaoId };
  },

  // ── 4. Turmas e grupos ──

  async listarGrupos(instituicaoId: string, incluirArquivados = false): Promise<(Grupo & { membros: number; alunos: number })[]> {
    await esperar();
    const m = eu(instituicaoId);
    const e = carregar();
    const doInst = e.grupos.filter((g) => g.instituicaoId === instituicaoId && (incluirArquivados || !g.arquivado));
    return gruposVisiveis(doInst, m).map((g) => ({
      ...g,
      membros: e.membros.filter((x) => x.estado === "ativo" && x.gruposIds.includes(g.id)).length,
      alunos: e.alunos.filter((a) => a.grupoId === g.id && a.estado === "ativo").length,
    }));
  },

  async criarGrupo(instituicaoId: string, dados: { nome: string; tipo: TipoGrupo; anoLetivo: string }): Promise<Grupo> {
    await esperar();
    const m = exigir(instituicaoId, "gerir_grupos");
    if (!dados.nome.trim()) throw new ErroInstituicao("Dá um nome ao grupo.");
    const g: Grupo = {
      id: novoId("g"),
      instituicaoId,
      nome: dados.nome.trim(),
      tipo: dados.tipo,
      anoLetivo: dados.anoLetivo,
      arquivado: false,
      criadoEm: new Date().toISOString(),
    };
    carregar().grupos.push(g);
    // Quem cria um grupo fica nele (educadores só vêem os seus grupos).
    if (!m.gruposIds.includes(g.id)) m.gruposIds.push(g.id);
    auditar(instituicaoId, "grupo_criado", `Grupo «${g.nome}» criado.`);
    guardar();
    return g;
  },

  /** Arquivar no fim do ano letivo: o histórico fica, o grupo sai das listas. */
  async arquivarGrupo(instituicaoId: string, grupoId: string, arquivar = true): Promise<void> {
    await esperar();
    exigir(instituicaoId, "gerir_grupos");
    const g = carregar().grupos.find((x) => x.id === grupoId && x.instituicaoId === instituicaoId);
    if (!g) throw new ErroInstituicao("Grupo não encontrado.");
    g.arquivado = arquivar;
    auditar(instituicaoId, "grupo_arquivado", `Grupo «${g.nome}» ${arquivar ? "arquivado" : "reativado"}.`);
    guardar();
  },

  async definirMembroNoGrupo(instituicaoId: string, grupoId: string, membroId: string, dentro: boolean): Promise<void> {
    await esperar();
    exigir(instituicaoId, "gerir_grupos");
    const alvo = carregar().membros.find((x) => x.id === membroId && x.instituicaoId === instituicaoId);
    if (!alvo) throw new ErroInstituicao("Membro não encontrado.");
    alvo.gruposIds = dentro ? Array.from(new Set([...alvo.gruposIds, grupoId])) : alvo.gruposIds.filter((g) => g !== grupoId);
    guardar();
  },

  // ── 5. Alunos e vínculos família-aluno ──

  async listarAlunos(instituicaoId: string): Promise<PerfilAluno[]> {
    await esperar();
    const m = eu(instituicaoId);
    const doInst = carregar().alunos.filter((a) => a.instituicaoId === instituicaoId);
    if (m.papel === "familia") return doInst.filter((a) => a.tutoresIds.includes(m.id));
    if (!vePessoais(m.papel) || m.papel === "aluno") return [];
    if (pode(m.papel, "ver_todos_grupos")) return doInst;
    return doInst.filter((a) => a.grupoId && m.gruposIds.includes(a.grupoId));
  },

  /**
   * Cria o perfil (mínimo: nome ou alcunha e grupo). Fica "à espera de
   * consentimento" até o tutor aceitar a finalidade de utilização.
   */
  async criarAluno(instituicaoId: string, dados: { nome: string; grupoId: string | null }): Promise<PerfilAluno> {
    await esperar();
    exigir(instituicaoId, "gerir_alunos");
    if (!dados.nome.trim()) throw new ErroInstituicao("Indica o nome ou alcunha da criança.");
    const a: PerfilAluno = {
      id: novoId("a"),
      instituicaoId,
      nome: dados.nome.trim(),
      grupoId: dados.grupoId,
      tutoresIds: [],
      estado: "aguarda_consentimento",
      criadoEm: new Date().toISOString(),
    };
    carregar().alunos.push(a);
    auditar(instituicaoId, "aluno_criado", `Perfil de ${a.nome} criado (à espera do consentimento do tutor).`);
    guardar();
    return a;
  },

  async removerVinculo(instituicaoId: string, alunoId: string, tutorId: string): Promise<void> {
    await esperar();
    exigir(instituicaoId, "gerir_membros");
    const e = carregar();
    const a = e.alunos.find((x) => x.id === alunoId && x.instituicaoId === instituicaoId);
    if (!a) throw new ErroInstituicao("Aluno não encontrado.");
    const tutor = e.membros.find((m) => m.id === tutorId);
    a.tutoresIds = a.tutoresIds.filter((t) => t !== tutorId);
    auditar(instituicaoId, "vinculo_removido", `${tutor?.nome ?? "Tutor"} deixou de ser tutor de ${a.nome}.`);
    guardar();
  },

  // ── 9. Consentimentos ──

  textoConsentimento(): TextoConsentimento {
    return TEXTO_CONSENTIMENTO;
  },

  /** Administração: o registo de todos os consentimentos. */
  async listarConsentimentos(instituicaoId: string): Promise<Consentimento[]> {
    await esperar();
    const m = eu(instituicaoId);
    const todos = carregar().consentimentos.filter((c) => c.instituicaoId === instituicaoId);
    if (pode(m.papel, "ver_consentimentos")) return todos;
    if (m.papel === "familia") return todos.filter((c) => c.tutorId === m.id);
    throw new ErroInstituicao("O teu papel não permite ver os consentimentos.");
  },

  /** O tutor aceita, recusa ou retira uma finalidade para uma criança. */
  async registarConsentimento(
    instituicaoId: string,
    alunoId: string,
    finalidade: FinalidadeConsentimento,
    aceite: boolean,
  ): Promise<PerfilAluno> {
    await esperar();
    const m = exigir(instituicaoId, "dar_consentimento");
    const a = carregar().alunos.find((x) => x.id === alunoId && x.instituicaoId === instituicaoId);
    if (!a || !a.tutoresIds.includes(m.id)) throw new ErroInstituicao("Só o tutor da criança pode decidir isto.");
    registar(instituicaoId, alunoId, m, finalidade, aceite, false);
    guardar();
    return a;
  },

  // ── 6. Avisos ──

  async listarAvisos(instituicaoId: string): Promise<Aviso[]> {
    await esperar();
    const m = exigir(instituicaoId, "ver_avisos");
    return carregar()
      .avisos.filter((a) => a.instituicaoId === instituicaoId && (a.autorId === m.id || eDestinatario(a.destinatarios, m)))
      .map((a) => projetarAviso(a, m))
      .sort((x, y) => y.publicadoEm.localeCompare(x.publicadoEm));
  },

  async publicarAviso(
    instituicaoId: string,
    dados: { titulo: string; mensagem: string; destinatarios: Destinatarios; pedirConfirmacao: boolean; anexosIds: string[] },
  ): Promise<Aviso> {
    await esperar();
    const m = exigir(instituicaoId, "publicar_avisos");
    if (!dados.titulo.trim() || !dados.mensagem.trim()) throw new ErroInstituicao("O aviso precisa de título e mensagem.");
    validarDestino(instituicaoId, m, dados.destinatarios);
    const a: Aviso = {
      id: novoId("av"),
      instituicaoId,
      titulo: dados.titulo.trim(),
      mensagem: dados.mensagem.trim(),
      destinatarios: dados.destinatarios,
      autor: m.nome,
      autorId: m.id,
      publicadoEm: new Date().toISOString(),
      pedirConfirmacao: dados.pedirConfirmacao,
      anexosIds: dados.anexosIds,
      recebidos: 0,
      lidos: 0,
      confirmados: 0,
      lidoPorMim: true,
      confirmadoPorMim: false,
    };
    const e = carregar();
    e.avisos.unshift(a);
    e.leituras[a.id] = { lidos: [], confirmados: [] };
    auditar(instituicaoId, "aviso_publicado", `«${a.titulo}» para ${descreverDestino(a.destinatarios)}.`);
    guardar();
    return projetarAviso(a, m);
  },

  async marcarAvisoLido(instituicaoId: string, avisoId: string, confirmar = false): Promise<void> {
    await esperar();
    const m = exigir(instituicaoId, "ver_avisos");
    const e = carregar();
    const leitura = (e.leituras[avisoId] ??= { lidos: [], confirmados: [] });
    if (!leitura.lidos.includes(m.id)) leitura.lidos.push(m.id);
    if (confirmar && !leitura.confirmados.includes(m.id)) leitura.confirmados.push(m.id);
    guardar();
  },

  async preferenciasAviso(instituicaoId: string): Promise<{ preferencias: PreferenciasAviso; disponiveis: Instituicao["canaisAviso"] }> {
    await esperar();
    const m = eu(instituicaoId);
    const inst = instituicao(instituicaoId);
    const guardadas = carregar().preferencias[m.id] ?? { plataforma: true, email: inst.canaisAviso.includes("email") };
    return { preferencias: guardadas, disponiveis: inst.canaisAviso };
  },

  async guardarPreferenciasAviso(instituicaoId: string, preferencias: PreferenciasAviso): Promise<void> {
    await esperar();
    const m = eu(instituicaoId);
    const inst = instituicao(instituicaoId);
    // Só os canais que a instituição ativou; a plataforma está sempre ligada.
    carregar().preferencias[m.id] = { plataforma: true, email: preferencias.email && inst.canaisAviso.includes("email") };
    guardar();
  },

  // ── 7. Agenda ──

  async listarEventos(instituicaoId: string): Promise<Evento[]> {
    await esperar();
    const m = exigir(instituicaoId, "ver_agenda");
    return carregar()
      .eventos.filter((ev) => ev.instituicaoId === instituicaoId && eDestinatario(ev.destinatarios, m))
      .map((ev) => projetarEvento(ev, m))
      .sort((x, y) => x.inicio.localeCompare(y.inicio));
  },

  async criarEvento(
    instituicaoId: string,
    dados: {
      titulo: string;
      descricao: string;
      inicio: string;
      fim: string;
      local: string;
      ligacao: string;
      destinatarios: Destinatarios;
      recorrencia: Recorrencia;
      lembretes: ("1d" | "1h")[];
    },
  ): Promise<Evento> {
    await esperar();
    const m = exigir(instituicaoId, "criar_eventos");
    if (!dados.titulo.trim()) throw new ErroInstituicao("Dá um título ao evento.");
    if (Number.isNaN(Date.parse(dados.inicio))) throw new ErroInstituicao("Indica a data e a hora de início.");
    if (dados.fim && Date.parse(dados.fim) < Date.parse(dados.inicio)) throw new ErroInstituicao("O fim não pode ser antes do início.");
    validarDestino(instituicaoId, m, dados.destinatarios);
    const ev: Evento = {
      id: novoId("ev"),
      instituicaoId,
      ...dados,
      titulo: dados.titulo.trim(),
      fim: dados.fim || dados.inicio,
      cancelado: false,
      criadoPor: m.nome,
      presencas: { vou: 0, nao_vou: 0, talvez: 0 },
      minhaResposta: null,
    };
    const e = carregar();
    e.eventos.push(ev);
    e.respostas[ev.id] = {};
    auditar(instituicaoId, "evento_criado", `«${ev.titulo}» para ${descreverDestino(ev.destinatarios)}.`);
    guardar();
    return ev;
  },

  /** Cancelar avisa automaticamente os destinatários (no backend: emails + notificações). */
  async cancelarEvento(instituicaoId: string, eventoId: string): Promise<void> {
    await esperar();
    exigir(instituicaoId, "criar_eventos");
    const ev = carregar().eventos.find((x) => x.id === eventoId && x.instituicaoId === instituicaoId);
    if (!ev) throw new ErroInstituicao("Evento não encontrado.");
    ev.cancelado = true;
    auditar(instituicaoId, "evento_cancelado", `«${ev.titulo}» cancelado; ${destinatariosDe(instituicaoId, ev.destinatarios).length} pessoas avisadas.`);
    guardar();
  },

  async responderPresenca(instituicaoId: string, eventoId: string, resposta: RespostaPresenca): Promise<void> {
    await esperar();
    const m = exigir(instituicaoId, "ver_agenda");
    const e = carregar();
    (e.respostas[eventoId] ??= {})[m.id] = resposta;
    guardar();
  },

  // ── 8. Ficheiros ──

  async listarFicheiros(instituicaoId: string): Promise<FicheiroInstituicao[]> {
    await esperar();
    const m = exigir(instituicaoId, "ver_ficheiros");
    return carregar()
      .ficheiros.filter(
        (f) =>
          f.instituicaoId === instituicaoId &&
          (eDestinatario(f.visibilidade, m) || f.carregadoPor === m.nome) &&
          (f.estado === "disponivel" || pode(m.papel, "carregar_ficheiros")),
      )
      .sort((x, y) => y.carregadoEm.localeCompare(x.carregadoEm));
  },

  async usoArmazenamento(instituicaoId: string): Promise<{ usadoBytes: number; quotaBytes: number; ficheiroMaxBytes: number }> {
    await esperar();
    eu(instituicaoId);
    const inst = instituicao(instituicaoId);
    const usado = carregar().ficheiros.filter((f) => f.instituicaoId === instituicaoId).reduce((s, f) => s + f.tamanhoBytes, 0);
    return { usadoBytes: usado, quotaBytes: inst.quotas.armazenamentoMb * 1024 * 1024, ficheiroMaxBytes: inst.quotas.ficheiroMaxMb * 1024 * 1024 };
  },

  /**
   * POST /api/instituicoes/:id/ficheiros/ — valida tipo, tamanho, quota e o
   * consentimento de fotografias antes de aceitar. O ficheiro fica "a
   * verificar" até a verificação automática terminar.
   */
  async carregarFicheiro(
    instituicaoId: string,
    dados: { nome: string; tamanhoBytes: number; mime: string; visibilidade: Destinatarios; temCriancas: boolean },
  ): Promise<FicheiroInstituicao> {
    await esperar();
    const m = exigir(instituicaoId, "carregar_ficheiros");
    const inst = instituicao(instituicaoId);
    const categoria = categoriaDoMime(dados.mime, dados.nome);
    if (!categoria) throw new ErroInstituicao("Tipo de ficheiro não permitido. Aceitamos documentos, imagens, áudio e vídeo.");
    if (dados.tamanhoBytes > inst.quotas.ficheiroMaxMb * 1024 * 1024) {
      throw new ErroInstituicao(`O ficheiro passa o limite de ${inst.quotas.ficheiroMaxMb} MB por ficheiro.`);
    }
    const usado = carregar().ficheiros.filter((f) => f.instituicaoId === instituicaoId).reduce((s, f) => s + f.tamanhoBytes, 0);
    if (usado + dados.tamanhoBytes > inst.quotas.armazenamentoMb * 1024 * 1024) {
      throw new ErroInstituicao("A instituição chegou ao limite de armazenamento. Apaga ficheiros antigos ou fala com a equipa EYK.");
    }
    validarDestino(instituicaoId, m, dados.visibilidade);
    if (dados.temCriancas) {
      const semConsentimento = criancasSemConsentimentoFotos(instituicaoId, dados.visibilidade);
      if (semConsentimento.length) {
        throw new ErroInstituicao(
          `Não é possível publicar: ${semConsentimento.length} criança${semConsentimento.length === 1 ? "" : "s"} do grupo não ${semConsentimento.length === 1 ? "tem" : "têm"} consentimento para fotografias (${semConsentimento.slice(0, 3).join(", ")}${semConsentimento.length > 3 ? "…" : ""}).`,
        );
      }
    }
    const f: FicheiroInstituicao = {
      id: novoId("f"),
      instituicaoId,
      nome: dados.nome,
      categoria,
      tamanhoBytes: dados.tamanhoBytes,
      visibilidade: dados.visibilidade,
      temCriancas: dados.temCriancas,
      estado: "a_verificar",
      carregadoPor: m.nome,
      carregadoEm: new Date().toISOString(),
    };
    carregar().ficheiros.unshift(f);
    auditar(instituicaoId, "ficheiro_carregado", `«${f.nome}»${f.temCriancas ? " (com crianças)" : ""} para ${descreverDestino(f.visibilidade)}.`);
    guardar();
    // Simula a verificação automática (antivírus/tipo real) a terminar.
    if (typeof window !== "undefined") {
      setTimeout(() => {
        f.estado = "disponivel";
        guardar();
      }, 4000);
    }
    return f;
  },

  /** Abrir verifica a permissão; ficheiros com crianças ficam registados na auditoria. */
  async abrirFicheiro(instituicaoId: string, ficheiroId: string): Promise<FicheiroInstituicao> {
    await esperar();
    const m = exigir(instituicaoId, "ver_ficheiros");
    const f = carregar().ficheiros.find((x) => x.id === ficheiroId && x.instituicaoId === instituicaoId);
    if (!f || !(eDestinatario(f.visibilidade, m) || f.carregadoPor === m.nome)) throw new ErroInstituicao("Não tens acesso a este ficheiro.");
    if (f.estado !== "disponivel") throw new ErroInstituicao("O ficheiro ainda está a ser verificado.");
    if (f.temCriancas) auditar(instituicaoId, "ficheiro_aberto", `«${f.nome}» aberto.`);
    guardar();
    return f;
  },

  async removerFicheiro(instituicaoId: string, ficheiroId: string): Promise<void> {
    await esperar();
    const m = exigir(instituicaoId, "carregar_ficheiros");
    const e = carregar();
    const f = e.ficheiros.find((x) => x.id === ficheiroId && x.instituicaoId === instituicaoId);
    if (!f) throw new ErroInstituicao("Ficheiro não encontrado.");
    if (f.carregadoPor !== m.nome && !pode(m.papel, "gerir_membros")) throw new ErroInstituicao("Só quem carregou o ficheiro ou a administração o pode apagar.");
    e.ficheiros = e.ficheiros.filter((x) => x.id !== ficheiroId);
    auditar(instituicaoId, "ficheiro_removido", `«${f.nome}» apagado.`);
    guardar();
  },

  // ── 10. Relatório de utilização ──

  async relatorio(instituicaoId: string): Promise<RelatorioUtilizacao> {
    await esperar();
    exigir(instituicaoId, "ver_relatorios");
    return calcularRelatorio(instituicaoId, Date.now());
  },

  // ── 11. Auditoria ──

  async listarAuditoria(instituicaoId: string): Promise<RegistoAuditoria[]> {
    await esperar();
    exigir(instituicaoId, "ver_auditoria");
    return carregar().auditoria.filter((r) => r.instituicaoId === instituicaoId);
  },

  // ── 12. Exportação e eliminação ──

  async listarPedidosDados(instituicaoId: string): Promise<PedidoDados[]> {
    await esperar();
    const m = exigir(instituicaoId, "pedir_dados");
    const todos = carregar().pedidosDados.filter((p) => p.instituicaoId === instituicaoId);
    return pode(m.papel, "gerir_pedidos_dados") ? todos : todos.filter((p) => p.pedidoPor === m.nome);
  },

  async pedirDados(
    instituicaoId: string,
    dados: { tipo: PedidoDados["tipo"]; ambito: AmbitoDados; alvo: string },
  ): Promise<PedidoDados> {
    await esperar();
    const m = exigir(instituicaoId, "pedir_dados");
    if (dados.ambito === "instituicao" && !pode(m.papel, "gerir_pedidos_dados")) {
      throw new ErroInstituicao("Só a administração pode pedir os dados da instituição inteira.");
    }
    const p: PedidoDados = {
      id: novoId("pd"),
      instituicaoId,
      tipo: dados.tipo,
      ambito: dados.ambito,
      alvo: dados.alvo,
      pedidoPor: m.nome,
      pedidoEm: new Date().toISOString(),
      estado: "recebido",
      prazo: new Date(Date.now() + 30 * DIA).toISOString(),
      ficheiroPronto: false,
      nota: dados.tipo === "eliminacao" ? "Antes de eliminar, enviamos uma exportação completa." : undefined,
    };
    carregar().pedidosDados.unshift(p);
    auditar(
      instituicaoId,
      dados.tipo === "exportacao" ? "dados_exportados" : "dados_eliminacao_pedida",
      `${dados.tipo === "exportacao" ? "Exportação" : "Eliminação"} pedida: ${dados.alvo}.`,
    );
    guardar();
    return p;
  },

  // ── 13. Administração EYK (equipa interna, isStaff) ──

  eyk: {
    async listarInstituicoes(): Promise<(Instituicao & { membros: number; usadoBytes: number; ultimaAtividade: string | null })[]> {
      await esperar();
      const e = carregar();
      return e.instituicoes.map((i) => {
        const membros = e.membros.filter((m) => m.instituicaoId === i.id && m.estado === "ativo");
        const acessos = membros.map((m) => m.ultimoAcesso).filter(Boolean) as string[];
        return {
          ...i,
          membros: membros.length,
          usadoBytes: e.ficheiros.filter((f) => f.instituicaoId === i.id).reduce((s, f) => s + f.tamanhoBytes, 0),
          ultimaAtividade: acessos.sort().at(-1) ?? null,
        };
      });
    },

    async criarInstituicao(dados: {
      nome: string;
      tipo: TipoInstituicao;
      provincia: string;
      responsavelNome: string;
      responsavelEmail: string;
    }): Promise<Instituicao> {
      await esperar();
      if (!dados.nome.trim()) throw new ErroInstituicao("Indica o nome da instituição.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dados.responsavelEmail)) throw new ErroInstituicao("Email do responsável inválido.");
      const e = carregar();
      const inst: Instituicao = {
        id: novoId("inst"),
        nome: dados.nome.trim(),
        tipo: dados.tipo,
        provincia: dados.provincia,
        estado: "preparacao",
        responsavel: { nome: dados.responsavelNome.trim(), email: dados.responsavelEmail.trim() },
        criadaEm: new Date().toISOString(),
        quotas: { armazenamentoMb: 1024, ficheiroMaxMb: 50, utilizadoresMax: 100 },
        aprovarPedidosPorCodigo: true,
        canaisAviso: ["plataforma", "email"],
        escola: { comunidadePublicaParaAlunos: false, rankingVisivel: true },
      };
      e.instituicoes.push(inst);
      // O responsável recebe um convite por email e torna-se administrador.
      e.convites.unshift({
        id: novoId("cv"),
        instituicaoId: inst.id,
        canal: "email",
        destino: inst.responsavel.email,
        codigo: gerarCodigo(),
        papel: "administrador",
        grupoId: null,
        alunoId: null,
        usos: 0,
        usosMax: 1,
        criadoPor: "Equipa EYK",
        criadoEm: new Date().toISOString(),
        expiraEm: new Date(Date.now() + VALIDADE_CONVITE_DIAS * DIA).toISOString(),
        estado: "pendente",
      });
      auditar(inst.id, "instituicao_criada", `Espaço criado; convite de administrador enviado a ${inst.responsavel.email}.`, "Equipa EYK", "equipa_eyk");
      guardar();
      return inst;
    },

    async mudarEstado(instituicaoId: string, novo: EstadoInstituicao): Promise<void> {
      await esperar();
      const inst = instituicao(instituicaoId);
      if (inst.estado === "encerrada") throw new ErroInstituicao("Uma instituição encerrada não pode ser reaberta.");
      const antes = inst.estado;
      inst.estado = novo;
      auditar(instituicaoId, "instituicao_estado", `Estado: ${antes} → ${novo}.`, "Equipa EYK", "equipa_eyk");
      guardar();
    },

    async ajustarQuotas(instituicaoId: string, quotas: Instituicao["quotas"]): Promise<void> {
      await esperar();
      const inst = instituicao(instituicaoId);
      if (quotas.armazenamentoMb < 1 || quotas.ficheiroMaxMb < 1 || quotas.utilizadoresMax < 1) {
        throw new ErroInstituicao("As quotas têm de ser maiores do que zero.");
      }
      inst.quotas = quotas;
      auditar(
        instituicaoId,
        "quotas_alteradas",
        `Armazenamento ${quotas.armazenamentoMb} MB · ficheiro ${quotas.ficheiroMaxMb} MB · ${quotas.utilizadoresMax} utilizadores.`,
        "Equipa EYK",
        "equipa_eyk",
      );
      guardar();
    },

    /** O acesso da equipa EYK aos dados de uma instituição também fica registado. */
    async consultarAuditoria(instituicaoId: string, motivo: string): Promise<RegistoAuditoria[]> {
      await esperar();
      if (!motivo.trim()) throw new ErroInstituicao("Indica o motivo do acesso (fica registado).");
      auditar(instituicaoId, "acesso_equipa_eyk", `Consulta da auditoria: ${motivo.trim()}`, "Equipa EYK", "equipa_eyk");
      guardar();
      return carregar().auditoria.filter((r) => r.instituicaoId === instituicaoId);
    },
  },
};

// ── Auxiliares com regras ──

function registar(
  instituicaoId: string,
  alunoId: string,
  tutor: Membro,
  finalidade: FinalidadeConsentimento,
  aceite: boolean,
  comApoio: boolean,
) {
  const e = carregar();
  const aluno = e.alunos.find((a) => a.id === alunoId)!;
  const anterior = [...e.consentimentos]
    .reverse()
    .find((c) => c.alunoId === alunoId && c.tutorId === tutor.id && c.finalidade === finalidade);
  if (anterior?.aceite === aceite && anterior.versaoTexto === TEXTO_CONSENTIMENTO.versao) return;
  // Guarda sempre um registo novo (quem, o quê, quando, versão) — nunca edita.
  e.consentimentos.push({
    id: novoId("c"),
    instituicaoId,
    alunoId,
    tutorId: tutor.id,
    tutorNome: tutor.nome,
    finalidade,
    aceite,
    versaoTexto: TEXTO_CONSENTIMENTO.versao,
    registadoEm: new Date().toISOString(),
    comApoio,
  });
  const titulo = TEXTO_CONSENTIMENTO.finalidades.find((f) => f.id === finalidade)?.titulo ?? finalidade;
  let consequencia = "";
  if (finalidade === "utilizacao") {
    if (aceite && aluno.estado !== "ativo") {
      aluno.estado = "ativo";
      consequencia = " O perfil ficou ativo.";
    } else if (!aceite && aluno.estado === "ativo") {
      aluno.estado = "consentimento_retirado";
      consequencia = " A criança saiu dos relatórios e o perfil ficou inativo.";
    }
  }
  auditar(
    instituicaoId,
    "consentimento_alterado",
    `${aluno.nome} — ${titulo}: ${aceite ? "aceite" : anterior ? "retirado" : "recusado"}.${consequencia}`,
    `${tutor.nome} (tutor)`,
  );
}

/** Estado atual (último registo) de cada finalidade, por criança. */
export function consentimentosAtuais(consentimentos: Consentimento[]): Record<string, Partial<Record<FinalidadeConsentimento, Consentimento>>> {
  const r: Record<string, Partial<Record<FinalidadeConsentimento, Consentimento>>> = {};
  for (const c of [...consentimentos].sort((a, b) => a.registadoEm.localeCompare(b.registadoEm))) {
    const atual = (r[c.alunoId] ??= {});
    const prev = atual[c.finalidade];
    // Com vários tutores, basta um ter recusado para não haver consentimento.
    if (!prev || prev.tutorId === c.tutorId || !c.aceite) atual[c.finalidade] = c;
  }
  return r;
}

function criancasSemConsentimentoFotos(instituicaoId: string, d: Destinatarios): string[] {
  const e = carregar();
  const atuais = consentimentosAtuais(e.consentimentos.filter((c) => c.instituicaoId === instituicaoId));
  const alvo = e.alunos.filter(
    (a) =>
      a.instituicaoId === instituicaoId &&
      a.estado === "ativo" &&
      (d.tipo === "instituicao" || (d.tipo === "grupo" && a.grupoId === d.grupoId)),
  );
  return alvo.filter((a) => !atuais[a.id]?.fotografias?.aceite).map((a) => a.nome);
}

function validarDestino(instituicaoId: string, m: Membro, d: Destinatarios) {
  const e = carregar();
  if (d.tipo === "grupo") {
    const g = e.grupos.find((x) => x.id === d.grupoId && x.instituicaoId === instituicaoId);
    if (!g) throw new ErroInstituicao("Grupo não encontrado.");
    if (!pode(m.papel, "ver_todos_grupos") && !m.gruposIds.includes(g.id)) throw new ErroInstituicao("Só podes escolher os teus grupos.");
  } else if (d.tipo === "pessoa") {
    if (!e.membros.some((x) => x.id === d.membroId && x.instituicaoId === instituicaoId)) throw new ErroInstituicao("Pessoa não encontrada.");
  } else if (!pode(m.papel, "gerir_membros")) {
    throw new ErroInstituicao("Só a administração pode escrever para toda a instituição.");
  }
}

const EXT: Record<CategoriaFicheiro, string[]> = {
  documento: ["pdf", "doc", "docx", "odt", "txt", "xls", "xlsx", "ppt", "pptx"],
  imagem: ["jpg", "jpeg", "png", "gif", "webp", "heic", "zip"],
  audio: ["mp3", "m4a", "wav", "ogg", "aac"],
  video: ["mp4", "mov", "webm", "m4v"],
};

export function categoriaDoMime(mime: string, nome: string): CategoriaFicheiro | null {
  if (mime.startsWith("image/")) return "imagem";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  for (const [cat, lista] of Object.entries(EXT) as [CategoriaFicheiro, string[]][]) {
    if (lista.includes(ext)) return cat;
  }
  return null;
}

export function calcularRelatorio(instituicaoId: string, agora: number): RelatorioUtilizacao {
  const e = carregar();
  const membros = e.membros.filter((m) => m.instituicaoId === instituicaoId && m.estado === "ativo");
  const ativo = (m: Membro) => !!m.ultimoAcesso && agora - new Date(m.ultimoAcesso).getTime() <= 30 * DIA;
  const atuais = consentimentosAtuais(e.consentimentos.filter((c) => c.instituicaoId === instituicaoId));
  // Crianças sem consentimento para relatórios (ou com o perfil inativo) não contam.
  const alunosContaveis = e.alunos.filter(
    (a) => a.instituicaoId === instituicaoId && a.estado === "ativo" && atuais[a.id]?.relatorios?.aceite,
  );

  const porPapel: Partial<Record<Papel, number>> = {};
  for (const m of membros) porPapel[m.papel] = (porPapel[m.papel] ?? 0) + 1;

  const semanas: { semana: string; n: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(agora - i * 7 * DIA);
    const base = membros.length * 3;
    semanas.push({ semana: d.toISOString().slice(0, 10), n: Math.round(base * (0.55 + (hash(instituicaoId + i) % 45) / 100) + (11 - i) * 2) });
  }

  const avisos = e.avisos.filter((a) => a.instituicaoId === instituicaoId);
  let recebidos = 0;
  let lidos = 0;
  for (const a of avisos) {
    const dest = destinatariosDe(instituicaoId, a.destinatarios).filter((x) => x.id !== a.autorId);
    const ids = new Set(dest.map((d) => d.id));
    recebidos += dest.length;
    lidos += (e.leituras[a.id]?.lidos ?? []).filter((id) => ids.has(id)).length;
  }
  const eventos = e.eventos.filter((ev) => ev.instituicaoId === instituicaoId);

  const grupos = e.grupos
    .filter((g) => g.instituicaoId === instituicaoId && !g.arquivado)
    .map((g) => {
      const pessoas = membros.filter((m) => m.gruposIds.includes(g.id));
      const criancas = alunosContaveis.filter((a) => a.grupoId === g.id);
      const total = pessoas.length + criancas.length;
      const oculto = total < LIMITE_ANONIMATO;
      return {
        grupoId: g.id,
        nome: g.nome,
        membros: total,
        ativos30d: oculto ? null : pessoas.filter(ativo).length + criancas.length,
        acessos30d: oculto ? null : total * 4 + (hash(g.id) % 20),
        oculto,
      };
    });

  return {
    geradoEm: new Date(agora).toISOString(),
    definicaoAtivo: DEFINICAO_ATIVO,
    utilizadores: { total: membros.length + alunosContaveis.length, ativos30d: membros.filter(ativo).length + alunosContaveis.length, porPapel },
    acessosPorSemana: semanas,
    conteudosMaisUsados: [
      { titulo: "Alfabeto em Língua Gestual Angolana", acessos: 120 + (hash(instituicaoId) % 40) },
      { titulo: "Números de 1 a 20 em LGA", acessos: 84 + (hash(instituicaoId + "n") % 30) },
      { titulo: "Cores e formas", acessos: 61 + (hash(instituicaoId + "c") % 20) },
      { titulo: "Histórias contadas em gestos", acessos: 47 + (hash(instituicaoId + "h") % 15) },
    ],
    avisos: { publicados: avisos.length, taxaLeitura: recebidos ? Math.round((lidos / recebidos) * 100) : null },
    eventos: {
      criados: eventos.length,
      confirmacoes: eventos.reduce((s, ev) => s + Object.values(e.respostas[ev.id] ?? {}).filter((r) => r === "vou").length, 0),
    },
    grupos,
  };
}

// Exposto só para os testes.
export const _interno = { carregar, eu };

/** Auxiliares partilhados com o módulo de ensino de LGA (./lga.ts). */
export const _nucleo = { carregar, guardar, esperar, novoId, gerarCodigo, instituicao, eu, exigir, auditar, destinatariosDe };
