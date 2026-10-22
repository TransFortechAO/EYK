"use client";

import { useEffect, useState } from "react";

/** A partir daqui (computador) a navegação é a barra lateral; abaixo (telemóvel
 *  e tablet) é a barra flutuante em baixo. Igual ao breakpoint `lg` do Tailwind. */
export const COMPACT_BREAKPOINT = 1024;

export function useIsCompact() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${COMPACT_BREAKPOINT - 1}px)`);
    const onChange = () => setCompact(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return compact;
}
