"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Desenha o conteúdo diretamente no <body>, fora da árvore da página.
 *
 * Necessário nos modais: a página está dentro de um PageTransition (framer-motion)
 * cuja animação usa transform/filter, e um elemento com transform passa a ser o
 * "ecrã" de qualquer filho `position: fixed` — o fundo escuro só cobria a área
 * do conteúdo e deixava a barra lateral e o topo de fora. No <body> o `fixed
 * inset-0` volta a cobrir a janela toda.
 */
export function BodyPortal({ children }: { children: ReactNode }) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado) return null;
  return createPortal(children, document.body);
}
