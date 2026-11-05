// Escolas, pertenças e convites guardados no servidor (apps.instituicoes). O resto da
// área da escola (turmas, conteúdos…) ainda corre sobre os dados locais de api.ts: as
// pertenças reais são copiadas para lá (ver sincronizarPertencas) com ids "srv-…".
import { fetchAPI } from "@/lib/api";
import { ErroInstituicao } from "./api";
import type { EstadoInstituicao, Instituicao, Papel, TipoInstituicao } from "./tipos";

export const PREFIXO_SERVIDOR = "srv-";

type InstituicaoRaw = Omit<Instituicao, "id" | "aprovarPedidosPorCodigo" | "canaisAviso" | "escola"> & { id: number };

export type ConviteResumo = {
  estado: "pendente" | "aceite" | "expirado" | "cancelado";
  email: string;
  expiraEm: string;
  emailEnviadoEm: string | null;
  /** Só enquanto o convite é válido: para a equipa o passar à mão se o email falhar. */
  link: string | null;
};

export type LinhaInstituicao = Instituicao & { membros: number; convite: ConviteResumo | null };
export type PertencaServidor = { instituicao: Instituicao; membro: { id: string; papel: Papel; desde: string } };
export type ConviteConsultado = { instituicao: string; papel: Papel; jaMembro: boolean };

/** Erro de um convite que não existe no servidor (pode ser um código de demonstração). */
export class ConviteInexistente extends ErroInstituicao {}

function instituicaoDe(raw: InstituicaoRaw): Instituicao {
  return {
    ...raw,
    id: `${PREFIXO_SERVIDOR}${raw.id}`,
    aprovarPedidosPorCodigo: true,
    canaisAviso: ["plataforma", "email"],
    escola: { comunidadePublicaParaAlunos: false, rankingVisivel: true },
  };
}

const idServidor = (id: string) => id.replace(PREFIXO_SERVIDOR, "");

/** Pedido ao servidor; os erros chegam às páginas com a mensagem pronta a mostrar. */
async function pedido<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  try {
    return await fetchAPI<T>(`/api/instituicoes/${caminho}`, opcoes);
  } catch (err) {
    const { status, data } = err as { status?: number; data?: { detail?: string } };
    const mensagem = data?.detail ?? "Não foi possível ligar ao servidor. Tenta de novo.";
    throw status === 404 ? new ConviteInexistente(mensagem) : new ErroInstituicao(mensagem);
  }
}

const json = (dados: unknown, method = "POST"): RequestInit => ({ method, body: JSON.stringify(dados) });

function linhaDe(raw: InstituicaoRaw & { membros: number; convite: ConviteResumo | null }): LinhaInstituicao {
  return { ...instituicaoDe(raw), membros: raw.membros, convite: raw.convite };
}

export const apiEscolasServidor = {
  // ── Equipa EYK ──
  async listar(): Promise<LinhaInstituicao[]> {
    const lista = await pedido<Parameters<typeof linhaDe>[0][]>("admin/");
    return lista.map(linhaDe);
  },

  async criar(dados: {
    nome: string;
    tipo: TipoInstituicao;
    provincia: string;
    responsavelNome: string;
    responsavelEmail: string;
  }): Promise<LinhaInstituicao & { emailEnviado: boolean }> {
    const raw = await pedido<Parameters<typeof linhaDe>[0] & { emailEnviado: boolean }>("admin/", json(dados));
    return { ...linhaDe(raw), emailEnviado: raw.emailEnviado };
  },

  async mudarEstado(id: string, estado: EstadoInstituicao): Promise<void> {
    await pedido(`admin/${idServidor(id)}/`, json({ estado }, "PATCH"));
  },

  async ajustarQuotas(id: string, quotas: Instituicao["quotas"]): Promise<void> {
    await pedido(`admin/${idServidor(id)}/`, json({ quotas }, "PATCH"));
  },

  async reenviarConvite(id: string): Promise<LinhaInstituicao & { emailEnviado: boolean }> {
    const raw = await pedido<Parameters<typeof linhaDe>[0] & { emailEnviado: boolean }>(
      `admin/${idServidor(id)}/reenviar-convite/`,
      { method: "POST" },
    );
    return { ...linhaDe(raw), emailEnviado: raw.emailEnviado };
  },

  // ── Quem recebe o convite ──
  consultarConvite(codigo: string): Promise<ConviteConsultado> {
    return pedido(`convites/${encodeURIComponent(codigo.trim())}/`);
  },

  async aceitarConvite(codigo: string): Promise<{ instituicaoId: string; papel: Papel }> {
    const r = await pedido<{ instituicaoId: number; papel: Papel }>(
      `convites/${encodeURIComponent(codigo.trim())}/aceitar/`,
      { method: "POST" },
    );
    return { instituicaoId: `${PREFIXO_SERVIDOR}${r.instituicaoId}`, papel: r.papel };
  },

  /** As instituições desta conta; null se não se conseguiu perguntar ao servidor. */
  async minhasPertencas(): Promise<PertencaServidor[] | null> {
    try {
      const lista = await pedido<{ instituicao: InstituicaoRaw; membro: { id: number; papel: Papel; desde: string } }[]>("minhas/");
      return lista.map((p) => ({
        instituicao: instituicaoDe(p.instituicao),
        membro: { ...p.membro, id: `${PREFIXO_SERVIDOR}${p.membro.id}` },
      }));
    } catch {
      return null;
    }
  },
};
