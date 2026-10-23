"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { apiInstituicoes, definirPessoaDemo, reporDemo, restaurarPessoaDemo } from "@/lib/instituicoes/api";
import { INSTITUICOES_ATIVAS } from "@/lib/instituicoes/ativo";
import { apiLga } from "@/lib/instituicoes/lga";
import { pode as podeFazer, vePessoais, type Acao } from "@/lib/instituicoes/permissoes";
import type { Papel, Pertenca } from "@/lib/instituicoes/tipos";

export const CHAVE_INSTITUICAO = "eyk-instituicao-atual";

/** Números para o menu (barra lateral e menu de baixo). */
export type ContadoresEscola = { porRever: number; trabalhos: number; avisosPorLer: number };

type EstadoInstituicao = {
  aCarregar: boolean;
  pertencas: Pertenca[];
  /** A instituição em que o utilizador está a trabalhar (funcionalidade 1, passo 4). */
  atual: Pertenca | null;
  papel: Papel | null;
  pode: (acao: Acao) => boolean;
  vePessoais: boolean;
  escolher: (instituicaoId: string) => void;
  recarregar: () => Promise<void>;
  /** O aluno escolheu ver também a plataforma geral? (sempre true para os outros papéis e para quem não tem escola) */
  verGeral: boolean;
  definirVerGeral: (ver: boolean) => Promise<void>;
  contadores: ContadoresEscola;
  /** Recalcula os números do menu (ex: depois de corrigir uma resposta). */
  atualizarContadores: () => void;
  // Só para a demonstração (sem backend).
  pessoa: number;
  mudarPessoa: (utilizadorId: number) => void;
  reporDados: () => void;
};

const Contexto = createContext<EstadoInstituicao | null>(null);
const SEM_CONTADORES: ContadoresEscola = { porRever: 0, trabalhos: 0, avisosPorLer: 0 };

function lerLocal(chave: string): string | null {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function escreverLocal(chave: string, valor: string) {
  try {
    window.localStorage.setItem(chave, valor);
  } catch {
    /* sem localStorage: a escolha dura só esta visita */
  }
}

/**
 * Contexto da escola para toda a app (montado em components/providers.tsx):
 * a barra lateral, o menu de baixo, as páginas principais e a área
 * Instituição partilham a mesma instituição atual e o mesmo papel.
 */
export function InstituicaoProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [aCarregar, setACarregar] = useState(true);
  const [pertencas, setPertencas] = useState<Pertenca[]>([]);
  const [atualId, setAtualId] = useState<string | null>(null);
  const [pessoa, setPessoa] = useState<number>(() => restaurarPessoaDemo());
  const [verGeral, setVerGeral] = useState(true);
  const [contadores, setContadores] = useState<ContadoresEscola>(SEM_CONTADORES);
  const [versaoContadores, setVersaoContadores] = useState(0);
  const atualizarContadores = useCallback(() => setVersaoContadores((v) => v + 1), []);

  const recarregar = useCallback(async () => {
    setACarregar(true);
    try {
      const lista = await apiInstituicoes.minhasPertencas();
      setPertencas(lista);
      setAtualId((anterior) => {
        const guardada = anterior ?? lerLocal(CHAVE_INSTITUICAO);
        if (guardada && lista.some((p) => p.instituicao.id === guardada)) return guardada;
        return lista[0]?.instituicao.id ?? null;
      });
    } finally {
      setACarregar(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar, pessoa]);

  const atual = pertencas.find((p) => p.instituicao.id === atualId) ?? null;
  const instituicaoId = atual?.instituicao.id ?? null;
  const membroId = atual?.membro.id ?? null;

  // Preferência do aluno (ver também a plataforma geral).
  useEffect(() => {
    if (!instituicaoId) {
      setVerGeral(true);
      return;
    }
    void apiLga.verPlataformaGeral(instituicaoId).then(setVerGeral).catch(() => setVerGeral(true));
  }, [instituicaoId, membroId]);

  // Contadores do menu: recalculados ao mudar de página (respostas corrigidas, avisos lidos…).
  useEffect(() => {
    if (!instituicaoId) {
      setContadores(SEM_CONTADORES);
      return;
    }
    let vivo = true;
    void apiLga
      .resumoEscola(instituicaoId)
      .then((r) => vivo && setContadores({ porRever: r.porRever, trabalhos: r.tarefas.length, avisosPorLer: r.avisosPorLer }))
      .catch(() => vivo && setContadores(SEM_CONTADORES));
    return () => {
      vivo = false;
    };
  }, [instituicaoId, membroId, pathname, versaoContadores]);

  const escolher = useCallback((id: string) => {
    setAtualId(id);
    escreverLocal(CHAVE_INSTITUICAO, id);
  }, []);

  const mudarPessoa = useCallback((utilizadorId: number) => {
    definirPessoaDemo(utilizadorId);
    setAtualId(null);
    setPessoa(utilizadorId);
  }, []);

  const reporDados = useCallback(() => {
    reporDemo();
    setAtualId(null);
    void recarregar();
  }, [recarregar]);

  const definirVerGeral = useCallback(
    async (ver: boolean) => {
      if (!instituicaoId) return;
      await apiLga.definirVerPlataformaGeral(instituicaoId, ver);
      setVerGeral(ver);
    },
    [instituicaoId],
  );

  const valor = useMemo<EstadoInstituicao>(() => {
    const papel = atual?.membro.papel ?? null;
    return {
      aCarregar,
      pertencas,
      atual,
      papel,
      pode: (acao) => podeFazer(papel, acao),
      vePessoais: vePessoais(papel),
      escolher,
      recarregar,
      verGeral,
      definirVerGeral,
      contadores,
      atualizarContadores,
      pessoa,
      mudarPessoa,
      reporDados,
    };
  }, [aCarregar, pertencas, atual, escolher, recarregar, verGeral, definirVerGeral, contadores, atualizarContadores, pessoa, mudarPessoa, reporDados]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** Só monta o contexto quando a área Instituição está ativa (senão a app fica exatamente como antes). */
export function EscolaGlobal({ children }: { children: ReactNode }) {
  if (!INSTITUICOES_ATIVAS) return <>{children}</>;
  return <InstituicaoProvider>{children}</InstituicaoProvider>;
}

export function useInstituicao(): EstadoInstituicao {
  const v = useContext(Contexto);
  if (!v) throw new Error("useInstituicao fora de <InstituicaoProvider>");
  return v;
}

/** Para o menu e as páginas principais: null quando a área está desligada. */
export function useInstituicaoOpcional(): EstadoInstituicao | null {
  return useContext(Contexto);
}

/** Mostra o conteúdo só se o papel o permitir (quem abre o endereço diretamente vê um aviso). */
export function Exige({ permitido, children }: { permitido: boolean; children: ReactNode }) {
  if (permitido) return <>{children}</>;
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface/60 p-10 text-center">
      <p className="font-serif text-lg font-semibold">Sem acesso a esta secção</p>
      <p className="mt-1 text-sm text-muted-foreground">O teu papel nesta instituição não inclui esta área.</p>
    </div>
  );
}

/** Atalho para páginas que já sabem que há instituição atual (o layout garante-o). */
export function useInstituicaoAtual() {
  const v = useInstituicao();
  if (!v.atual) throw new Error("Sem instituição atual");
  return { ...v, atual: v.atual, papel: v.atual.membro.papel, instituicaoId: v.atual.instituicao.id };
}
