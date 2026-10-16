"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Info, Wrench, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, type ConfigPublica } from "@/lib/api";

const STORAGE_KEY = "eyk-aviso-fechado";

const ESTILO = {
  info: { icone: Info, classes: "bg-sky-600 text-white" },
  aviso: { icone: AlertTriangle, classes: "bg-amber-500 text-black" },
  manutencao: { icone: Wrench, classes: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" },
} as const;

/** Aviso global definido pelos administradores (Administração → Plataforma),
 * ex: manutenção agendada. Quem o fecha não o volta a ver — até o aviso mudar. */
export function AvisoPlataforma() {
  const [aviso, setAviso] = useState<ConfigPublica["aviso"] | null>(null);
  const [fechado, setFechado] = useState(true);

  useEffect(() => {
    let vivo = true;
    void api.plataforma.config().then((config) => {
      if (!vivo || !config?.aviso.ativo) return;
      setAviso(config.aviso);
      try {
        setFechado(localStorage.getItem(STORAGE_KEY) === config.aviso.versao);
      } catch {
        setFechado(false);
      }
    });
    return () => {
      vivo = false;
    };
  }, []);

  if (!aviso || fechado) return null;
  const { icone: Icone, classes } = ESTILO[aviso.tipo] ?? ESTILO.info;

  return (
    <div role="status" className={cn("flex items-center gap-3 px-4 py-2 text-sm", classes)}>
      <Icone className="h-4 w-4 shrink-0" aria-hidden />
      <p className="flex-1">{aviso.mensagem}</p>
      <button
        type="button"
        onClick={() => {
          setFechado(true);
          try {
            localStorage.setItem(STORAGE_KEY, aviso.versao);
          } catch {
            /* ignora */
          }
        }}
        className="rounded-full p-1 transition hover:bg-black/10"
        aria-label="Fechar aviso"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
