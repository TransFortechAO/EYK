"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Pesquisa da Biblioteca LGA, guardada no endereço (?q=). No computador o campo
 * está na barra do topo; no telemóvel/tablet, dentro da página — os dois leem e
 * escrevem o mesmo ?q=, por isso a lista filtra com qualquer um deles.
 */
export function usePesquisaBiblioteca(): [string, (q: string) => void] {
  const params = useSearchParams();
  const pathname = usePathname();
  const q = params.get("q") ?? "";
  const definir = (novo: string) => {
    const p = new URLSearchParams(params.toString());
    if (novo) p.set("q", novo);
    else p.delete("q");
    const qs = p.toString();
    // replaceState mantém o useSearchParams sincronizado sem recarregar a página.
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  };
  return [q, definir];
}

export function CampoPesquisaBiblioteca({ className }: { className?: string }) {
  const [q, definir] = usePesquisaBiblioteca();
  const [valor, setValor] = useState(q);
  useEffect(() => setValor(q), [q]);

  return (
    <div className={cn("relative min-w-0", className)}>
      <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Pesquisar gesto, palavra ou frase…"
        aria-label="Pesquisar na Biblioteca LGA"
        value={valor}
        onChange={(e) => {
          setValor(e.target.value);
          definir(e.target.value);
        }}
        className="h-10 rounded-full border-transparent bg-surface pl-4 pr-10 shadow-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-border/70"
      />
    </div>
  );
}
