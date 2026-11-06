// A área da escola guardada no servidor (apps.instituicoes). As regras e as permissões
// valem lá: aqui só se fazem os pedidos. Os ids reais começam por "srv-".
import { API_BASE_URL, fetchAPI } from "@/lib/api";
import { ErroInstituicao } from "./erros";
import type {
  AmbitoDados,
  Aviso,
  CanalConvite,
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
  PreferenciasAviso,
  Recorrencia,
  RegistoAuditoria,
  RelatorioUtilizacao,
  RespostaPresenca,
  TipoGrupo,
  TipoInstituicao,
} from "./tipos";

export const PREFIXO_SERVIDOR = "srv-";

/** Avisa o contexto de que o papel, os grupos ou as definições desta conta mudaram. */
export const EVENTO_PERTENCAS = "eyk-pertencas-mudaram";

function avisarPertencas() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_PERTENCAS));
}

export type ConviteResumo = {
  estado: "pendente" | "aceite" | "expirado" | "cancelado";
  email: string;
  expiraEm: string;
  emailEnviadoEm: string | null;
  /** Só enquanto o convite é válido: para a equipa o passar à mão se o email falhar. */
  link: string | null;
};

export type LinhaInstituicao = Instituicao & { membros: number; convite: ConviteResumo | null };
export type PertencaServidor = { instituicao: Instituicao; membro: Membro };
export type ConviteConsultado = {
  instituicao: string;
  papel: Papel;
  grupo: string | null;
  aluno: { id: string; nome: string } | null;
  requerAprovacao: boolean;
  pedeConsentimento: boolean;
  jaMembro: boolean;
};

/** Erro de um recurso que não existe no servidor (ex: um código de demonstração). */
export class ConviteInexistente extends ErroInstituicao {}

/** Pedido ao servidor; os erros chegam às páginas com a mensagem pronta a mostrar. */
export async function pedido<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  try {
    return await fetchAPI<T>(`/api/instituicoes/${caminho}`, opcoes);
  } catch (err) {
    const { status, data } = err as { status?: number; data?: { detail?: string } };
    const mensagem = data?.detail ?? "Não foi possível ligar ao servidor. Tenta de novo.";
    throw status === 404 ? new ConviteInexistente(mensagem) : new ErroInstituicao(mensagem);
  }
}

/** Endereço completo de um ficheiro servido pela API. */
export const enderecoApi = (caminho?: string | null): string | undefined =>
  caminho ? `${API_BASE_URL}${caminho}` : undefined;

export const json = (dados: unknown, method = "POST"): RequestInit => ({ method, body: JSON.stringify(dados) });

export const apiEscolasServidor = {
  // ── Equipa EYK ──
  listar(): Promise<LinhaInstituicao[]> {
    return pedido("admin/");
  },

  criar(dados: {
    nome: string;
    tipo: TipoInstituicao;
    provincia: string;
    responsavelNome: string;
    responsavelEmail: string;
  }): Promise<LinhaInstituicao & { emailEnviado: boolean }> {
    return pedido("admin/", json(dados));
  },

  async mudarEstado(id: string, estado: EstadoInstituicao): Promise<void> {
    await pedido(`admin/${id}/`, json({ estado }, "PATCH"));
  },

  async ajustarQuotas(id: string, quotas: Instituicao["quotas"]): Promise<void> {
    await pedido(`admin/${id}/`, json({ quotas }, "PATCH"));
  },

  reenviarConvite(id: string): Promise<LinhaInstituicao & { emailEnviado: boolean }> {
    return pedido(`admin/${id}/reenviar-convite/`, { method: "POST" });
  },

  /** Eliminações de instituições inteiras: só a equipa EYK as confirma. */
  pedidosEliminacao(): Promise<(PedidoDados & { escola: string })[]> {
    return pedido("admin/pedidos-dados/");
  },

  async decidirEliminacao(pedidoId: string, aprovar: boolean): Promise<void> {
    await pedido(`admin/pedidos-dados/${pedidoId}/decidir/`, json({ aprovar }));
  },

  // ── Quem recebe o convite ──
  consultarConvite(codigo: string): Promise<ConviteConsultado> {
    return pedido(`convites/${encodeURIComponent(codigo.trim())}/`);
  },

  aceitarConvite(
    codigo: string,
    dados: { consentimentos?: Partial<Record<FinalidadeConsentimento, boolean>>; comApoio?: boolean } = {},
  ): Promise<{ resultado: "membro" | "pendente"; instituicaoId: string; papel: Papel }> {
    return pedido(`convites/${encodeURIComponent(codigo.trim())}/aceitar/`, json(dados));
  },

  /** As instituições desta conta; null se não se conseguiu perguntar ao servidor. */
  async minhasPertencas(): Promise<PertencaServidor[] | null> {
    try {
      return await pedido<PertencaServidor[]>("minhas/");
    } catch {
      return null;
    }
  },
};

/** Operações de uma instituição real: a mesma forma de apiInstituicoes (ver encaminhar.ts). */
export const apiEscolaReal = {
  async atualizarDefinicoes(
    id: string,
    dados: Partial<Pick<Instituicao, "aprovarPedidosPorCodigo" | "canaisAviso" | "escola">>,
  ): Promise<Instituicao> {
    const r = await pedido<Instituicao>(`${id}/definicoes/`, json(dados, "PATCH"));
    avisarPertencas();
    return r;
  },

  // ── Membros ──
  listarMembros(id: string): Promise<Membro[]> {
    return pedido(`${id}/membros/`);
  },

  async alterarPapel(id: string, membroId: string, papel: Papel): Promise<Membro> {
    const r = await pedido<Membro>(`${id}/membros/${membroId}/`, json({ papel }, "PATCH"));
    avisarPertencas();
    return r;
  },

  async removerMembro(id: string, membroId: string): Promise<void> {
    await pedido(`${id}/membros/${membroId}/`, { method: "DELETE" });
    avisarPertencas();
  },

  // ── Convites e pedidos ──
  listarConvites(id: string): Promise<Convite[]> {
    return pedido(`${id}/convites/`);
  },

  criarConvite(
    id: string,
    dados: {
      canal: CanalConvite;
      destino: string;
      papel: Papel;
      grupoId: string | null;
      alunoId?: string | null;
      usosMax?: number;
      validadeDias?: number;
    },
  ): Promise<Convite> {
    return pedido(`${id}/convites/`, json(dados));
  },

  async cancelarConvite(id: string, conviteId: string): Promise<void> {
    await pedido(`${id}/convites/${conviteId}/`, { method: "DELETE" });
  },

  listarPedidosAdesao(id: string): Promise<PedidoAdesao[]> {
    return pedido(`${id}/pedidos/`);
  },

  async decidirPedido(id: string, pedidoId: string, aprovar: boolean): Promise<void> {
    await pedido(`${id}/pedidos/${pedidoId}/decidir/`, json({ aprovar }));
  },

  // ── Grupos ──
  listarGrupos(id: string, incluirArquivados = false): Promise<(Grupo & { membros: number; alunos: number })[]> {
    return pedido(`${id}/grupos/${incluirArquivados ? "?arquivados=1" : ""}`);
  },

  async criarGrupo(id: string, dados: { nome: string; tipo: TipoGrupo; anoLetivo: string }): Promise<Grupo> {
    const r = await pedido<Grupo>(`${id}/grupos/`, json(dados));
    avisarPertencas();
    return r;
  },

  async arquivarGrupo(id: string, grupoId: string, arquivar = true): Promise<void> {
    await pedido(`${id}/grupos/${grupoId}/`, json({ arquivado: arquivar }, "PATCH"));
  },

  async definirMembroNoGrupo(id: string, grupoId: string, membroId: string, dentro: boolean): Promise<void> {
    await pedido(`${id}/grupos/${grupoId}/membros/`, json({ membroId, dentro }));
    avisarPertencas();
  },

  // ── Alunos e consentimentos ──
  listarAlunos(id: string): Promise<PerfilAluno[]> {
    return pedido(`${id}/alunos/`);
  },

  criarAluno(id: string, dados: { nome: string; grupoId: string | null }): Promise<PerfilAluno> {
    return pedido(`${id}/alunos/`, json(dados));
  },

  ligarConta(id: string, alunoId: string, contaId: string | null): Promise<PerfilAluno> {
    return pedido(`${id}/alunos/${alunoId}/conta/`, json({ contaId }, "PATCH"));
  },

  async removerVinculo(id: string, alunoId: string, tutorId: string): Promise<void> {
    await pedido(`${id}/alunos/${alunoId}/tutores/${tutorId}/`, { method: "DELETE" });
  },

  listarConsentimentos(id: string): Promise<Consentimento[]> {
    return pedido(`${id}/consentimentos/`);
  },

  registarConsentimento(id: string, alunoId: string, finalidade: FinalidadeConsentimento, aceite: boolean): Promise<PerfilAluno> {
    return pedido(`${id}/consentimentos/`, json({ alunoId, finalidade, aceite }));
  },

  // ── Avisos ──
  listarAvisos(id: string): Promise<Aviso[]> {
    return pedido(`${id}/avisos/`);
  },

  publicarAviso(
    id: string,
    dados: { titulo: string; mensagem: string; destinatarios: Destinatarios; pedirConfirmacao: boolean; anexosIds: string[] },
  ): Promise<Aviso> {
    return pedido(`${id}/avisos/`, json(dados));
  },

  async marcarAvisoLido(id: string, avisoId: string, confirmar = false): Promise<void> {
    await pedido(`${id}/avisos/${avisoId}/lido/`, json({ confirmar }));
  },

  preferenciasAviso(id: string): Promise<{ preferencias: PreferenciasAviso; disponiveis: Instituicao["canaisAviso"] }> {
    return pedido(`${id}/preferencias-aviso/`);
  },

  async guardarPreferenciasAviso(id: string, preferencias: PreferenciasAviso): Promise<void> {
    await pedido(`${id}/preferencias-aviso/`, json(preferencias, "PUT"));
  },

  // ── Agenda ──
  listarEventos(id: string): Promise<Evento[]> {
    return pedido(`${id}/eventos/`);
  },

  criarEvento(
    id: string,
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
    return pedido(`${id}/eventos/`, json(dados));
  },

  async cancelarEvento(id: string, eventoId: string): Promise<void> {
    await pedido(`${id}/eventos/${eventoId}/cancelar/`, { method: "POST" });
  },

  async responderPresenca(id: string, eventoId: string, resposta: RespostaPresenca): Promise<void> {
    await pedido(`${id}/eventos/${eventoId}/presenca/`, json({ resposta }));
  },

  // ── Ficheiros ──
  listarFicheiros(id: string): Promise<FicheiroInstituicao[]> {
    return pedido(`${id}/ficheiros/`);
  },

  usoArmazenamento(id: string): Promise<{ usadoBytes: number; quotaBytes: number; ficheiroMaxBytes: number }> {
    return pedido(`${id}/ficheiros/uso/`);
  },

  carregarFicheiro(
    id: string,
    dados: { ficheiro?: File; visibilidade: Destinatarios; temCriancas: boolean },
  ): Promise<FicheiroInstituicao> {
    if (!dados.ficheiro) throw new ErroInstituicao("Escolhe um ficheiro.");
    const corpo = new FormData();
    corpo.append("ficheiro", dados.ficheiro);
    corpo.append("visibilidade", JSON.stringify(dados.visibilidade));
    corpo.append("temCriancas", String(dados.temCriancas));
    return pedido(`${id}/ficheiros/`, { method: "POST", body: corpo });
  },

  /** O ficheiro nunca é público: o endereço só responde a quem tem acesso (o servidor verifica). */
  async abrirFicheiro(id: string, ficheiroId: string): Promise<FicheiroInstituicao> {
    const f = (await apiEscolaReal.listarFicheiros(id)).find((x) => x.id === ficheiroId);
    if (!f) throw new ErroInstituicao("Não tens acesso a este ficheiro.");
    return { ...f, url: enderecoApi(f.url) };
  },

  async removerFicheiro(id: string, ficheiroId: string): Promise<void> {
    await pedido(`${id}/ficheiros/${ficheiroId}/`, { method: "DELETE" });
  },

  // ── Relatório, auditoria e dados ──
  relatorio(id: string): Promise<RelatorioUtilizacao> {
    return pedido(`${id}/relatorio/`);
  },

  listarAuditoria(id: string): Promise<RegistoAuditoria[]> {
    return pedido(`${id}/auditoria/`);
  },

  listarPedidosDados(id: string): Promise<PedidoDados[]> {
    return pedido(`${id}/pedidos-dados/`);
  },

  pedirDados(id: string, dados: { tipo: PedidoDados["tipo"]; ambito: AmbitoDados; alvo: string; alunoId?: string | null }): Promise<PedidoDados> {
    return pedido(`${id}/pedidos-dados/`, json(dados));
  },

  /** Eliminar é irreversível: só a administração confirma, depois de haver cópia. */
  decidirPedidoDados(id: string, pedidoId: string, aprovar: boolean): Promise<PedidoDados> {
    return pedido(`${id}/pedidos-dados/${pedidoId}/decidir/`, json({ aprovar }));
  },
};
