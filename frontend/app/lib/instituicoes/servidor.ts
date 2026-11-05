// A área da escola guardada no servidor (apps.instituicoes). As regras e as permissões
// valem lá: aqui só se fazem os pedidos. Os ids reais começam por "srv-".
import { fetchAPI } from "@/lib/api";
import { ErroInstituicao } from "./erros";
import type {
  CanalConvite,
  Consentimento,
  Convite,
  EstadoInstituicao,
  FinalidadeConsentimento,
  Grupo,
  Instituicao,
  Membro,
  Papel,
  PedidoAdesao,
  PerfilAluno,
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

  async removerVinculo(id: string, alunoId: string, tutorId: string): Promise<void> {
    await pedido(`${id}/alunos/${alunoId}/tutores/${tutorId}/`, { method: "DELETE" });
  },

  listarConsentimentos(id: string): Promise<Consentimento[]> {
    return pedido(`${id}/consentimentos/`);
  },

  registarConsentimento(id: string, alunoId: string, finalidade: FinalidadeConsentimento, aceite: boolean): Promise<PerfilAluno> {
    return pedido(`${id}/consentimentos/`, json({ alunoId, finalidade, aceite }));
  },
};
