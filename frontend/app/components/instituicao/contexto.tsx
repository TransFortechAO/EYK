"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiInstituicoes, definirPessoaDemo, reporDemo, restaurarPessoaDemo } from "@/lib/instituicoes/api";
import { pode as podeFazer, vePessoais, type Acao } from "@/lib/instituicoes/permissoes";
import type { Papel, Pertenca } from "@/lib/instituicoes/tipos";

export const CHAVE_INSTITUICAO = "eyk-instituicao-atual";

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
  // Só para a demonstração (sem backend).
  pessoa: number;
  mudarPessoa: (utilizadorId: number) => void;
  reporDados: () => void;
};

const Contexto = createContext<EstadoInstituicao | null>(null);

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

export function InstituicaoProvider({ children }: { children: ReactNode }) {
  const [aCarregar, setACarregar] = useState(true);
  const [pertencas, setPertencas] = useState<Pertenca[]>([]);
  const [atualId, setAtualId] = useState<string | null>(null);
  const [pessoa, setPessoa] = useState<number>(() => restaurarPessoaDemo());

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

  const escolher = useCallback((instituicaoId: string) => {
    setAtualId(instituicaoId);
    escreverLocal(CHAVE_INSTITUICAO, instituicaoId);
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

  const valor = useMemo<EstadoInstituicao>(() => {
    const atual = pertencas.find((p) => p.instituicao.id === atualId) ?? null;
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
      pessoa,
      mudarPessoa,
      reporDados,
    };
  }, [aCarregar, pertencas, atualId, escolher, recarregar, pessoa, mudarPessoa, reporDados]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useInstituicao(): EstadoInstituicao {
  const v = useContext(Contexto);
  if (!v) throw new Error("useInstituicao fora de <InstituicaoProvider>");
  return v;
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
