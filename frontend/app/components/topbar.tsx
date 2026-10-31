"use client";

import { Search, Coins, Flame, Sun, Moon } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/components/theme-provider";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ProfileMenu } from "@/components/profile-menu";
import { SinoNotificacoes } from "@/components/sino-notificacoes";
import { InstallAppButton } from "@/components/pwa";
import { api, type LeaderRow } from "@/lib/api";
import { PesquisaGlobal } from "@/components/pesquisa-global";


export function Topbar() {
  const { theme, toggleTheme } = useTheme();

  const [rows, setRows] = useState<LeaderRow[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await api.getLeaderboard();
      if (!alive) return;
      setRows(list);
    })();
    return () => { alive = false; };
  }, []);

  const me = rows.find((r) => r.isMe);

  // Número de notificações por ler, mostrado no sino. Atualiza ao abrir a
  // página, de minuto a minuto (só com o separador visível), ao voltar ao
  // separador e quando a página de notificações marca algo como lido.
  const [naoLidas, setNaoLidas] = useState(0);
  useEffect(() => {
    let ativo = true;
    const atualizar = () => {
      if (document.visibilityState !== "visible") return;
      void api.getNotificacoesNaoLidas().then((n) => {
        if (ativo) setNaoLidas(n);
      });
    };
    atualizar();
    const timer = window.setInterval(atualizar, 60_000);
    window.addEventListener("focus", atualizar);
    window.addEventListener("eyk:notificacoes", atualizar);
    document.addEventListener("visibilitychange", atualizar);
    return () => {
      ativo = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", atualizar);
      window.removeEventListener("eyk:notificacoes", atualizar);
      document.removeEventListener("visibilitychange", atualizar);
    };
  }, []);

  // Em telemóvel a pesquisa abre por cima do cabeçalho; a partir de `sm` fica sempre visível.
  const [buscaAberta, setBuscaAberta] = useState(false);
  const noInicio = usePathname() === "/inicio";

  return (
    <header className="sticky top-0 z-30 flex h-[calc(4rem+env(safe-area-inset-top))] items-center gap-3 border-b border-border bg-background/80 px-3 pt-[env(safe-area-inset-top)] backdrop-blur md:px-6">
      {/* Menu de baixo (< lg): o logótipo ocupa o canto superior esquerdo. */}
      <Link href="/inicio" aria-label="EYK — Início" className="shrink-0 computador:hidden">
        <img src="/assets/EYK_-_LOGO-SEM-BAKGROUND.png" alt="EYK" className="h-14 w-auto object-contain" />
      </Link>
      <SidebarTrigger className="hidden shrink-0 computador:inline-flex" />

      <PesquisaGlobal
        autoFocus={buscaAberta}
        aoFechar={() => setBuscaAberta(false)}
        className={cn(
          "flex-1 max-w-xl",
          // No Início (telemóvel/tablet) a pesquisa está por baixo do título da página.
          noInicio
            ? "hidden computador:flex"
            : buscaAberta
              ? "absolute inset-x-0 bottom-0 z-40 h-16 max-w-none bg-background px-3 sm:static sm:inset-auto sm:h-auto sm:max-w-xl sm:bg-transparent sm:px-0"
              : "hidden sm:flex",
        )}
      />

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Pesquisar"
          onClick={() => setBuscaAberta(true)}
          className={cn("rounded-full sm:hidden", noInicio && "hidden")}
        >
          <Search className="h-5 w-5" />
        </Button>
        <div className="hidden items-center gap-2 rounded-full bg-surface px-3 py-1.5 border border-border/70 sm:flex">
          <Coins className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium tabular-nums">
            {(me?.coins ?? 0).toLocaleString("pt-PT")}
          </span>
        </div>
        <div className="hidden items-center gap-2 rounded-full bg-surface px-3 py-1.5 border border-border/70 sm:flex">
          <Flame className="h-4 w-4 text-streak" />
          <span className="text-sm font-medium tabular-nums">{me?.streak ?? 0}</span>
        </div>

        <InstallAppButton />

        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
          title={theme === "dark" ? "Tema claro" : "Tema escuro"}
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <SinoNotificacoes naoLidas={naoLidas} />

        <ProfileMenu />
      </div>
    </header>
  );
}
