"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Design System EYK — gestos de LGA em vídeo junto às palavras da plataforma.
 * Os vídeos são carregados pela equipa em Administração → Plataforma → Gestos de LGA
 * e só aparecem depois de validados por pessoas surdas (ver docs/lga-icones-palavras.md).
 * Sem gesto validado para a palavra, mostra só o texto — nunca um gesto inventado.
 */

let cache: Record<string, string> | null = null;
let pedido: Promise<Record<string, string>> | null = null;

/** URL do vídeo do gesto de uma palavra (ou null). Os gestos pedem-se uma vez por sessão. */
export function useGesto(palavra: string): string | null {
  const [gestos, setGestos] = useState<Record<string, string> | null>(cache);
  useEffect(() => {
    if (cache) return;
    let vivo = true;
    pedido ??= api.plataforma.gestos().then((g) => (cache = g));
    void pedido.then((g) => vivo && setGestos(g));
    return () => {
      vivo = false;
    };
  }, []);
  return gestos?.[palavra] ?? null;
}

/** Respeita "Reduzir animações" (Configurações → Aparência): o vídeo só anda ao passar o cursor. */
function reduzirAnimacoes(): boolean {
  if (typeof document === "undefined") return false;
  return (
    document.documentElement.classList.contains("reduzir-animacoes") ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/** O vídeo do gesto, em loop e sem som. */
export function GestoAnimado({ palavra, className }: { palavra: string; className?: string }) {
  const url = useGesto(palavra);
  const [parado, setParado] = useState(false);
  useEffect(() => setParado(reduzirAnimacoes()), []);
  if (!url) return null;
  return (
    <video
      src={url}
      aria-label={`Gesto de LGA: ${palavra}`}
      className={cn("rounded-lg bg-surface object-cover", className)}
      muted
      loop
      playsInline
      autoPlay={!parado}
      onMouseEnter={(e) => parado && void e.currentTarget.play()}
      onMouseLeave={(e) => parado && e.currentTarget.pause()}
    />
  );
}
