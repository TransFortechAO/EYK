"use client";

import { Coins, Flame, Sun, Moon } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/components/theme-provider";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ProfileMenu } from "@/components/profile-menu";
import { SinoNotificacoes } from "@/components/sino-notificacoes";
import { InstallAppButton } from "@/components/pwa";
import { Chip } from "@/components/ds/chip";
import { api, type LeaderRow } from "@/lib/api";
import { PesquisaGlobal } from "@/components/pesquisa-global";
import { CampoPesquisaPagina, pesquisaDaPagina } from "@/components/pesquisa-pagina";


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

  // Pesquisa: no computador está aqui, com o texto da página; no telemóvel/tablet
  // está dentro da própria página. Páginas sem pesquisa não mostram campo.
  const pagina = pesquisaDaPagina(usePathname());

  return (
    <header className="sticky top-0 z-30 flex h-[calc(4rem+env(safe-area-inset-top))] items-center gap-3 border-b border-border bg-background/80 px-3 pt-[env(safe-area-inset-top)] backdrop-blur md:px-6">
      {/* Menu de baixo (< lg): o logótipo ocupa o canto superior esquerdo. */}
      <Link href="/inicio" aria-label="EYK — Início" className="shrink-0 computador:hidden">
        <img src="/assets/EYK_-_LOGO-SEM-BAKGROUND.png" alt="EYK" className="h-14 w-auto object-contain" />
      </Link>
      <SidebarTrigger className="hidden shrink-0 computador:inline-flex" />

      {pagina?.tipo === "global" ? (
        <PesquisaGlobal placeholder={pagina.placeholder} className="hidden max-w-xl flex-1 computador:flex" />
      ) : pagina ? (
        <CampoPesquisaPagina className="hidden max-w-xl flex-1 computador:block" />
      ) : null}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {/* Chips do Design System: sem borda nem sombra no tema claro. */}
        <Chip className="hidden sm:inline-flex" title="Moedas EYK">
          <Coins className="h-4 w-4 text-primary" />
          <span className="tabular-nums">{(me?.coins ?? 0).toLocaleString("pt-PT")}</span>
        </Chip>
        <Chip className="hidden sm:inline-flex" title="Streak (dias seguidos)">
          <Flame className="h-4 w-4 text-streak" />
          <span className="tabular-nums">{me?.streak ?? 0}</span>
        </Chip>

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
