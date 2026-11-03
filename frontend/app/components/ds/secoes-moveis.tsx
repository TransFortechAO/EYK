"use client";

import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Design System EYK — páginas com vários tipos de elementos.
 * Regra: no telemóvel/tablet cada tipo fica no seu separador (não fica tudo
 * misturado num scroll enorme); no computador vê-se tudo, uma secção por baixo da outra.
 * Ver docs/design-system.md.
 *
 * Uso:
 *   const s = useSecoesMoveis(SECOES);
 *   {s.separadores}
 *   <section className={s.so("cursos")}>…</section>
 */
export type SecaoMovel<T extends string> = { id: T; rotulo: string; icone?: LucideIcon };

export function useSecoesMoveis<T extends string>(secoes: readonly SecaoMovel<T>[]) {
  const [escolhida, setAtual] = useState<T | null>(null);
  // As secções podem só ser conhecidas depois de carregar os dados: se a escolhida
  // não existir (ou ainda não houver escolha), fica a primeira.
  const atual = secoes.some((s) => s.id === escolhida) ? (escolhida as T) : secoes[0]?.id;

  /** Classe para uma secção: escondida no telemóvel/tablet se não for a escolhida. */
  const so = (id: T) => (atual === id ? undefined : "movel:hidden");

  const separadores: ReactNode = secoes.length > 1 && (
    <Tabs value={atual} onValueChange={(v) => setAtual(v as T)} className="computador:hidden">
      <TabsList className="h-auto w-full bg-surface p-1">
        {secoes.map((s) => (
          <TabsTrigger key={s.id} value={s.id} className="flex-1 gap-1.5 text-xs sm:text-sm">
            {s.icone && <s.icone className="h-4 w-4" />}
            {s.rotulo}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );

  return { atual, setAtual, so, separadores };
}
