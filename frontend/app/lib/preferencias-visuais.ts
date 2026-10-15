// Preferências de acessibilidade aplicadas ao <html> (ver globals.css):
// tamanho do texto, alto contraste e reduzir animações. Ficam também em
// localStorage para se aplicarem já nas páginas públicas (login, landing)
// e antes de o pedido /auth/me/ responder.
import { useEffect, useState } from "react";
import type { PreferenciasUtilizador, TamanhoTexto } from "@/lib/api";

const STORAGE_KEY = "eyk-acessibilidade";

export type PreferenciasVisuais = Pick<PreferenciasUtilizador, "tamanhoTexto" | "altoContraste" | "reduzirAnimacoes">;

export function aplicarPreferenciasVisuais(prefs: PreferenciasVisuais, guardar = true) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (prefs.tamanhoTexto === "normal") delete root.dataset.texto;
  else root.dataset.texto = prefs.tamanhoTexto;
  root.classList.toggle("alto-contraste", prefs.altoContraste);
  root.classList.toggle("reduzir-animacoes", prefs.reduzirAnimacoes);
  if (!guardar) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* modo privado sem storage */
  }
}

export function aplicarPreferenciasGuardadas() {
  try {
    const bruto = localStorage.getItem(STORAGE_KEY);
    if (!bruto) return;
    const prefs = JSON.parse(bruto) as Partial<PreferenciasVisuais>;
    const tamanhos: TamanhoTexto[] = ["normal", "grande", "muito_grande"];
    aplicarPreferenciasVisuais(
      {
        tamanhoTexto: tamanhos.includes(prefs.tamanhoTexto as TamanhoTexto) ? (prefs.tamanhoTexto as TamanhoTexto) : "normal",
        altoContraste: Boolean(prefs.altoContraste),
        reduzirAnimacoes: Boolean(prefs.reduzirAnimacoes),
      },
      false,
    );
  } catch {
    /* JSON inválido — ignora */
  }
}

/** true quando o utilizador pediu menos animações (na EYK ou no sistema operativo). */
export function useReduzirAnimacoes(): boolean {
  const [reduzir, setReduzir] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const atualizar = () => setReduzir(root.classList.contains("reduzir-animacoes") || media.matches);
    atualizar();
    const observer = new MutationObserver(atualizar);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    media.addEventListener("change", atualizar);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", atualizar);
    };
  }, []);
  return reduzir;
}
