"use client";

import { useEffect, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type OpcaoFiltro = { valor: string; rotulo: string };

export type DefFiltro = {
  id: string;
  rotulo: string;
  /** Rótulo da opção "sem filtro" (valor ""), ex: "Todas as categorias". */
  todos: string;
  opcoes: OpcaoFiltro[];
  /** Aparece por omissão (a pessoa pode mostrar/esconder em "Personalizar"). */
  visivelPorOmissao: boolean;
};

/** Que filtros a pessoa escolheu ver, guardado no browser (por página). */
function useFiltrosVisiveis(chave: string, filtros: DefFiltro[]) {
  const omissao = filtros.filter((f) => f.visivelPorOmissao).map((f) => f.id);
  const [visiveis, setVisiveis] = useState<string[]>(omissao);

  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(chave);
      if (guardado) setVisiveis(JSON.parse(guardado));
    } catch {
      /* sem localStorage: ficam os de omissão */
    }
  }, [chave]);

  const alternar = (id: string) => {
    setVisiveis((atual) => {
      const novo = atual.includes(id) ? atual.filter((v) => v !== id) : [...atual, id];
      try {
        window.localStorage.setItem(chave, JSON.stringify(novo));
      } catch {
        /* ignora */
      }
      return novo;
    });
  };

  return { visiveis, alternar };
}

/**
 * Pesquisa + filtros (listas de escolha) de um catálogo. A pessoa escolhe em
 * "Personalizar filtros" quais quer ver; um filtro escondido deixa de filtrar.
 */
export function BarraFiltros({
  chave,
  filtros,
  valores,
  aoMudar,
  pesquisa,
  aoPesquisar,
  placeholderPesquisa,
  aoLimpar,
}: {
  chave: string;
  filtros: DefFiltro[];
  valores: Record<string, string>;
  aoMudar: (id: string, valor: string) => void;
  pesquisa: string;
  aoPesquisar: (texto: string) => void;
  placeholderPesquisa: string;
  aoLimpar: () => void;
}) {
  const { visiveis, alternar } = useFiltrosVisiveis(chave, filtros);
  const mostrados = filtros.filter((f) => visiveis.includes(f.id));
  const algumAtivo = pesquisa.trim() !== "" || filtros.some((f) => valores[f.id]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={pesquisa}
            onChange={(e) => aoPesquisar(e.target.value)}
            placeholder={placeholderPesquisa}
            aria-label={placeholderPesquisa}
            className="h-10 rounded-full border-transparent bg-surface pl-4 pr-10 shadow-none dark:border-border/70"
          />
        </div>
        <div className="flex shrink-0 gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 gap-2 rounded-full">
                <SlidersHorizontal className="h-4 w-4" />
                Personalizar filtros
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-3">
              <p className="px-1 pb-2 text-sm font-semibold">Que filtros queres ver?</p>
              <ul className="space-y-1">
                {filtros.map((f) => (
                  <li key={f.id}>
                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-1 py-1.5 text-sm hover:bg-surface/60">
                      {f.rotulo}
                      <Switch
                        checked={visiveis.includes(f.id)}
                        onCheckedChange={() => {
                          // Esconder um filtro tira-o também da pesquisa.
                          if (visiveis.includes(f.id) && valores[f.id]) aoMudar(f.id, "");
                          alternar(f.id);
                        }}
                      />
                    </label>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
          {algumAtivo && (
            <Button variant="ghost" size="sm" className="h-10 gap-1.5 rounded-full" onClick={aoLimpar}>
              <X className="h-4 w-4" />
              Limpar
            </Button>
          )}
        </div>
      </div>

      {mostrados.length > 0 && (
        // Telemóvel: uma só linha que desliza; a partir do tablet partem em várias linhas.
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {mostrados.map((f) => (
            <label key={f.id} className="relative shrink-0">
              <span className="sr-only">{f.rotulo}</span>
              <select
                value={valores[f.id] ?? ""}
                onChange={(e) => aoMudar(f.id, e.target.value)}
                className={cn(
                  "h-9 cursor-pointer appearance-none rounded-full border bg-surface py-1 pl-3.5 pr-8 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                  valores[f.id]
                    ? "border-primary/60 bg-primary/10 font-medium text-foreground"
                    : "border-transparent text-muted-foreground dark:border-border/70",
                )}
              >
                <option value="">{f.todos}</option>
                {f.opcoes.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </option>
                ))}
              </select>
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
              >
                <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/** Minutos de uma duração "m:ss" ou "h:mm:ss" (0 se não se perceber). */
export function minutosDeDuracao(duracao: string): number {
  const partes = duracao.split(":").map((p) => parseInt(p, 10));
  if (partes.some(Number.isNaN)) return 0;
  if (partes.length === 3) return partes[0] * 60 + partes[1] + partes[2] / 60;
  if (partes.length === 2) return partes[0] + partes[1] / 60;
  return 0;
}

/** Texto sem acentos e em minúsculas, para pesquisar. */
export function normalizarTexto(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
