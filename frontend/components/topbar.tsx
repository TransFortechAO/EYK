"use client";

import { useCallback } from "react";
import { Bell, Search, Coins, Flame, Sun, Moon, LogOut, User2 } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/components/theme-provider";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useAuth } from "@/components/auth-gate";
import { api, API_BASE_URL } from "@/lib/api";

export function Topbar() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [logoutLoading, setLogoutLoading] = useCallbackState(false);

  const handleLogout = useCallback(async () => {
    if (logoutLoading) return;
    try {
      setLogoutLoading(true);
      await api.logout();
    } catch (err) {
      console.warn("logout warning:", err);
    } finally {
      setLogoutLoading(false);
      window.location.assign(API_BASE_URL + "/");
    }
  }, [logoutLoading, setLogoutLoading]);

  const name = user?.name?.trim() || "Utilizador";
  const initials =
    user?.initials?.trim() ||
    name
      .split(/\s+/)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ||
    "?";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-3 backdrop-blur md:px-6">
      <SidebarTrigger className="shrink-0" />

      <div className="relative flex-1 min-w-0 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Pesquisar curso, categoria ou professor…"
          className="h-10 rounded-full bg-surface pl-10 pr-4 border-border/70 focus-visible:ring-2 focus-visible:ring-primary/40"
        />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <div className="hidden items-center gap-2 rounded-full bg-surface px-3 py-1.5 border border-border/70 sm:flex">
          <Coins className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium tabular-nums">
            {(user?.coins ?? 0).toLocaleString("pt-PT")}
          </span>
        </div>
        <div className="hidden items-center gap-2 rounded-full bg-surface px-3 py-1.5 border border-border/70 sm:flex">
          <Flame className="h-4 w-4 text-streak" />
          <span className="text-sm font-medium tabular-nums">{user?.streak ?? 0}</span>
        </div>

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

        <Button asChild variant="ghost" size="icon" className="rounded-full" aria-label="Novidades">
          <Link href="/notificacoes">
            <Bell className="h-5 w-5" />
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Menu do utilizador"
            >
              <Avatar className="h-9 w-9 border-2 border-primary/30">
                <AvatarFallback className="bg-gradient-gold text-primary-foreground font-semibold uppercase">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <span className="inline-flex items-center gap-2">
                <User2 className="w-4 h-4 text-muted-foreground" />
                Olá, {name}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/gamificacao">A minha gamificação</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/configuracoes">Configurações</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                void handleLogout();
              }}
              disabled={logoutLoading}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {logoutLoading ? "A sair…" : "Sair"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

/* Helper mini hook local para estado com setter tipado */
import { useState } from "react";
function useCallbackState<T>(initial: T): [T, (v: T) => void] {
  return useState<T>(initial);
}
