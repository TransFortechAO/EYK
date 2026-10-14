"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

// Em desenvolvimento o service worker fica desligado (iria guardar em cache os
// ficheiros do hot-reload do Next); pode ser ligado com NEXT_PUBLIC_ENABLE_SW=true.
const SW_LIGADO =
  process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ENABLE_SW === "true";

/** Regista o service worker (public/sw.js). Montado uma vez no layout raiz. */
export function PwaRegister() {
  useEffect(() => {
    if (!SW_LIGADO || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* sem service worker a app continua a funcionar, só não fica offline */
    });
  }, []);
  return null;
}

// ── "Instalar app" ───────────────────────────────────────────────────────────
// O evento `beforeinstallprompt` dispara uma única vez, logo no arranque — fica
// guardado aqui (fora do React) para o botão o poder usar mais tarde.

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let promptGuardado: BeforeInstallPromptEvent | null = null;
const ouvintes = new Set<() => void>();
const notificar = () => ouvintes.forEach((fn) => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    promptGuardado = e as BeforeInstallPromptEvent;
    notificar();
  });
  window.addEventListener("appinstalled", () => {
    promptGuardado = null;
    notificar();
  });
}

function subscrever(fn: () => void) {
  ouvintes.add(fn);
  return () => {
    ouvintes.delete(fn);
  };
}

export function InstallAppButton() {
  const podeInstalar = useSyncExternalStore(
    subscrever,
    () => promptGuardado !== null,
    () => false,
  );
  if (!podeInstalar) return null;

  const instalar = async () => {
    const evento = promptGuardado;
    if (!evento) return;
    await evento.prompt();
    await evento.userChoice;
    promptGuardado = null;
    notificar();
  };

  return (
    <Button variant="outline" size="sm" className="hidden gap-1.5 rounded-full sm:inline-flex" onClick={() => void instalar()}>
      <Download className="h-4 w-4" />
      Instalar app
    </Button>
  );
}

// ── Indicador "sem ligação" ──────────────────────────────────────────────────

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const atualizar = () => setOffline(!navigator.onLine);
    atualizar();
    window.addEventListener("online", atualizar);
    window.addEventListener("offline", atualizar);
    return () => {
      window.removeEventListener("online", atualizar);
      window.removeEventListener("offline", atualizar);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-amber-500/15 px-4 py-2 text-center text-xs font-medium text-amber-800 dark:text-amber-200"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      Sem ligação à internet — estás a ver conteúdo guardado neste dispositivo.
    </div>
  );
}
