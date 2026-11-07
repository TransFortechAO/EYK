"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useInstituicaoOpcional } from "@/components/instituicao/contexto";
import { api } from "@/lib/api";
import { PREFIXO_SERVIDOR } from "@/lib/instituicoes/servidor";
import { apiLgaReal } from "@/lib/instituicoes/servidor-lga";
import { cn } from "@/lib/utils";

/**
 * Design System EYK — "Salvos": guardar para ver depois, com o mesmo botão em todo o lado.
 * Na plataforma pública: curso, vídeo e publicação. Na escola: conteúdo, aula e publicação
 * da turma (estes ficam na escola; não saem para a plataforma pública).
 * Ver docs/design-system.md.
 */
export type TipoSalvoPublico = "curso" | "video" | "post";
export type TipoSalvoEscola = "conteudo" | "aula" | "post_turma";
export type TipoSalvo = TipoSalvoPublico | TipoSalvoEscola;

const DA_ESCOLA = new Set<TipoSalvo>(["conteudo", "aula", "post_turma"]);

type EstadoSalvos = {
  tem: (tipo: TipoSalvo, id: string | number) => boolean;
  alternar: (tipo: TipoSalvo, id: string | number) => Promise<void>;
  /** A escola real desta conta: sem ela, os itens da escola não se podem guardar. */
  escolaId: string | null;
};

const Contexto = createContext<EstadoSalvos | null>(null);

export function SalvosProvider({ children }: { children: ReactNode }) {
  const escola = useInstituicaoOpcional();
  const atual = escola?.atual?.instituicao.id;
  const escolaId = atual?.startsWith(PREFIXO_SERVIDOR) ? atual : null;
  const [chaves, setChaves] = useState<Set<string>>(new Set());

  useEffect(() => {
    let vivo = true;
    void Promise.all([api.salvos.ids().catch(() => []), escolaId ? apiLgaReal.salvosIds(escolaId).catch(() => []) : Promise.resolve([])]).then(
      ([publicos, daEscola]) => vivo && setChaves(new Set([...publicos, ...daEscola])),
    );
    return () => {
      vivo = false;
    };
  }, [escolaId]);

  const tem = useCallback((tipo: TipoSalvo, id: string | number) => chaves.has(`${tipo}:${id}`), [chaves]);

  const alternar = useCallback(
    async (tipo: TipoSalvo, id: string | number) => {
      const chave = `${tipo}:${id}`;
      const mudar = (lig: boolean) =>
        setChaves((atuais) => {
          const novas = new Set(atuais);
          if (lig) novas.add(chave);
          else novas.delete(chave);
          return novas;
        });
      const antes = chaves.has(chave);
      mudar(!antes);
      try {
        const r =
          DA_ESCOLA.has(tipo) && escolaId
            ? await apiLgaReal.alternarSalvo(escolaId, tipo as TipoSalvoEscola, String(id))
            : await api.salvos.alternar(tipo as TipoSalvoPublico, id);
        mudar(r.salvo);
      } catch (err) {
        mudar(antes);
        toast.error(err instanceof Error && err.message ? err.message : "Não foi possível guardar.");
      }
    },
    [chaves, escolaId],
  );

  const valor = useMemo(() => ({ tem, alternar, escolaId }), [tem, alternar, escolaId]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSalvos(): EstadoSalvos | null {
  return useContext(Contexto);
}

/**
 * - `cartao`: ícone por cima da imagem de um cartão (fica por cima do link, não dentro dele);
 * - `menu`: no menu "⋯" de uma publicação, junto de Denunciar (a linha de ações fica só com
 *   Reações, Comentários e Partilhar, sem botões encostados uns aos outros);
 * - `acao`: botão pequeno ao lado de um item (ex: na página Salvos);
 * - `botao`: nas páginas de detalhe, ao lado de Partilhar.
 */
export function BotaoSalvar({
  tipo,
  id,
  variante = "botao",
  className,
}: {
  tipo: TipoSalvo;
  id: string | number;
  variante?: "cartao" | "acao" | "botao" | "menu";
  className?: string;
}) {
  const salvos = useSalvos();
  // Pré-visualização "Ver como" e páginas sem sessão: não há onde guardar.
  if (!salvos || (DA_ESCOLA.has(tipo) && !salvos.escolaId)) return null;
  const salvo = salvos.tem(tipo, id);
  const rotulo = salvo ? "Tirar dos Salvos" : "Salvar";
  const icone = <Bookmark className={cn("h-4 w-4", salvo && "fill-primary text-primary")} aria-hidden />;
  const clique = () => void salvos.alternar(tipo, id);

  if (variante === "menu") {
    return (
      <DropdownMenuItem onSelect={clique} className={cn("gap-2", className)}>
        {icone} {salvo ? "Tirar dos Salvos" : "Salvar"}
      </DropdownMenuItem>
    );
  }
  if (variante === "cartao") {
    return (
      <button
        type="button"
        onClick={clique}
        aria-label={rotulo}
        aria-pressed={salvo}
        title={rotulo}
        className={cn(
          "absolute left-1.5 top-1.5 z-10 grid h-9 w-9 place-items-center rounded-full bg-background/90 backdrop-blur transition-colors hover:bg-background sm:left-auto sm:right-2 sm:top-2 pointer-coarse:h-11 pointer-coarse:w-11",
          className,
        )}
      >
        {icone}
      </button>
    );
  }
  if (variante === "acao") {
    return (
      <Button variant="ghost" size="sm" className={cn("gap-2 text-xs sm:text-sm", salvo && "text-primary", className)} onClick={clique} aria-label={rotulo} aria-pressed={salvo}>
        {icone}
        <span className="hidden sm:inline">{salvo ? "Salvo" : "Salvar"}</span>
      </Button>
    );
  }
  return (
    <Button variant="outline" size="sm" className={cn("gap-1.5", className)} onClick={clique} aria-pressed={salvo}>
      {icone}
      {salvo ? "Salvo" : "Salvar"}
    </Button>
  );
}
