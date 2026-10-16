import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// Limites de upload definidos pelos administradores (Administração →
// Plataforma). O servidor valida sempre; isto só serve para avisar antes de
// enviar um ficheiro de 800MB pela rede móvel e o ver recusado no fim.
const POR_OMISSAO = { videoMb: 500, pdfMb: 50 };
let cache: typeof POR_OMISSAO | null = null;

export function useLimitesUpload() {
  const [limites, setLimites] = useState(cache ?? POR_OMISSAO);
  useEffect(() => {
    if (cache) return;
    let vivo = true;
    void api.plataforma.config().then((config) => {
      if (!config) return;
      cache = config.limites;
      if (vivo) setLimites(config.limites);
    });
    return () => {
      vivo = false;
    };
  }, []);
  return limites;
}
