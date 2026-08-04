"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search, Coins, Flame, Sun, Moon, LogOut } from "lucide-react";
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
import { currentUser } from "@/lib/mock-data";
import { useApi } from "@/hooks/useApi";
import { api, type AuthUser } from "@/lib/api";

type UserShape = AuthUser | typeof currentUser;

export function Topbar() {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const { data: authRes, execute } = useApi<{ authenticated: boolean; user: AuthUser | null }>();
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    execute(() => api.me()).catch(() => {
      console.log("Usando dados mockados - API indisponível");
    });
  }, [execute]);

  const handleLogout = useCallback(async () => {
    if (logoutLoading) return;
    try {
      setLogoutLoading(true);
      await api.logout();
    } catch (err) {
      console.warn("logout warning:", err);
    } finally {
      setLogoutLoading(false);
      router.push("/");
      router.refresh();
    }
  }, [logoutLoading, router]);

  const dados: UserShape = (authRes?.authenticated && authRes.user)
    ? (authRes.user as UserShape)
    : currentUser;

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
            {(dados.coins ?? 0).toLocaleString("pt-PT")}
          </span>
        </div>
        <div className="hidden items-center gap-2 rounded-full bg-surface px-3 py-1.5 border border-border/70 sm:flex">
          <Flame className="h-4 w-4 text-streak" />
          <span className="text-sm font-medium tabular-nums">{dados.streak ?? 0}</span>
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
                  {dados.initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Olá, {dados.name}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/gamificacao">A minha gamificação</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/configuracoes">Configurações</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
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