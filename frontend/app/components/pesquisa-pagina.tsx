"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Pesquisa de cada página. Regra da plataforma:
 * - computador: o campo está só na barra do topo;
 * - telemóvel/tablet: o campo está só dentro da página;
 * - os dois escrevem o mesmo ?q= no endereço, e a página filtra por ele.
 * O texto de ajuda diz o que se pesquisa ali. Páginas fora desta lista
 * (configurações, leaderboard, gamificação…) não têm pesquisa.
 */
export type PaginaComPesquisa = {
  /** "global": pesquisa geral com resultados por baixo (Início); "pagina": filtra a lista da própria página. */
  tipo: "global" | "pagina";
  placeholder: string;
};

const PAGINAS: Record<string, PaginaComPesquisa> = {
  "/inicio": { tipo: "global", placeholder: "Pesquisar cursos, vídeos ou professores…" },
  "/cursos": { tipo: "pagina", placeholder: "Pesquisar cursos, categorias ou professores…" },
  "/videos": { tipo: "pagina", placeholder: "Pesquisar vídeos ou professores…" },
  "/comunidade": { tipo: "pagina", placeholder: "Pesquisar publicações ou pessoas…" },
  "/biblioteca": { tipo: "pagina", placeholder: "Pesquisar gestos, palavras ou frases…" },
  "/professor/cursos": { tipo: "pagina", placeholder: "Pesquisar nos meus cursos…" },
  "/professor/videos": { tipo: "pagina", placeholder: "Pesquisar nos meus vídeos…" },
  "/configuracoes/administracao/utilizadores": { tipo: "pagina", placeholder: "Pesquisar utilizadores por nome ou email…" },
  "/configuracoes/administracao/professores": { tipo: "pagina", placeholder: "Pesquisar professores por nome, email ou área…" },
  "/instituicao/membros": { tipo: "pagina", placeholder: "Pesquisar membros por nome ou email…" },
  "/instituicao/gestuario": { tipo: "pagina", placeholder: "Pesquisar gestos, palavras ou frases…" },
  "/instituicao/auditoria": { tipo: "pagina", placeholder: "Pesquisar no registo de atividade…" },
};

export function pesquisaDaPagina(pathname: string): PaginaComPesquisa | null {
  return PAGINAS[pathname] ?? null;
}

// ── ?q= partilhado entre a barra do topo e a página ──
const EVENTO = "eyk:pesquisa";

function lerQ(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("q") ?? "";
}

function subscrever(aoMudar: () => void) {
  window.addEventListener(EVENTO, aoMudar);
  window.addEventListener("popstate", aoMudar);
  return () => {
    window.removeEventListener(EVENTO, aoMudar);
    window.removeEventListener("popstate", aoMudar);
  };
}

function definirQ(novo: string) {
  const url = new URL(window.location.href);
  if (novo) url.searchParams.set("q", novo);
  else url.searchParams.delete("q");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new Event(EVENTO));
}

/** O texto pesquisado na página atual (?q=) e como o mudar. */
export function usePesquisaPagina(): [string, (q: string) => void] {
  // usePathname: volta a ler o ?q= quando se muda de página.
  usePathname();
  const q = useSyncExternalStore(subscrever, lerQ, () => "");
  return [q, definirQ];
}

/** Campo de pesquisa da página atual (na barra do topo ou dentro da página). */
export function CampoPesquisaPagina({ className, placeholder }: { className?: string; placeholder?: string }) {
  const pathname = usePathname();
  const [q, definir] = usePesquisaPagina();
  const [valor, setValor] = useState(q);
  useEffect(() => setValor(q), [q]);
  const texto = placeholder ?? pesquisaDaPagina(pathname)?.placeholder ?? "Pesquisar…";

  return (
    <div className={cn("relative min-w-0", className)}>
      <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder={texto}
        aria-label={texto.replace(/…$/, "")}
        value={valor}
        onChange={(e) => {
          setValor(e.target.value);
          definir(e.target.value);
        }}
        className="h-10 rounded-full border-transparent bg-surface pl-4 pr-10 shadow-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-border/70 [&::-webkit-search-cancel-button]:hidden"
      />
    </div>
  );
}
