"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { api, type Notification } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Sino do topo. Ao passar o cursor mostra as 3 notificações mais recentes;
 * ao clicar abre a página de notificações.
 */
export function SinoNotificacoes({ naoLidas }: { naoLidas: number }) {
  const [aberto, setAberto] = useState(false);
  const [recentes, setRecentes] = useState<Notification[] | null>(null);
  const fecharRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const abrir = (e: React.PointerEvent) => {
    // Só com rato: no ecrã táctil o toque abre logo a página.
    if (e.pointerType !== "mouse") return;
    if (fecharRef.current) clearTimeout(fecharRef.current);
    setAberto(true);
    void api.getNotificacoes().then((lista) => setRecentes(lista.slice(0, 3)));
  };
  const fechar = () => {
    fecharRef.current = setTimeout(() => setAberto(false), 150);
  };

  return (
    <div className="relative" onPointerEnter={abrir} onPointerLeave={fechar}>
      <Button
        asChild
        variant="ghost"
        size="icon"
        className="relative rounded-full"
        aria-label={naoLidas > 0 ? `Notificações (${naoLidas} por ler)` : "Notificações"}
      >
        <Link href="/notificacoes" onClick={() => setAberto(false)}>
          <Bell className="h-5 w-5" />
          {naoLidas > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-background tabular-nums"
              aria-hidden
            >
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </Link>
      </Button>

      {aberto && (
        <div className="absolute right-0 top-full z-50 w-80 pt-2">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-elevated">
            <p className="border-b border-border/60 px-4 py-2.5 text-sm font-semibold">Notificações recentes</p>
            {recentes === null ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">A carregar…</p>
            ) : recentes.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">Sem notificações novas.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {recentes.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={n.link || "/notificacoes"}
                      onClick={() => {
                        setAberto(false);
                        if (!n.read) {
                          void api.marcarNotificacaoLida(n.id).then(() => window.dispatchEvent(new Event("eyk:notificacoes")));
                        }
                      }}
                      className={cn("flex gap-2 px-4 py-3 transition-colors hover:bg-surface/60", !n.read && "bg-surface/40")}
                    >
                      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{n.title}</span>
                        <span className="line-clamp-2 break-words text-xs text-muted-foreground">{n.body}</span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">{n.timeAgo}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/notificacoes"
              onClick={() => setAberto(false)}
              className="block border-t border-border/60 px-4 py-2.5 text-center text-sm font-medium text-primary hover:bg-surface/60"
            >
              Ver todas
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
