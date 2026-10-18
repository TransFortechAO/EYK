"use client";

import { Bell, Search, Coins, Flame, Sun, Moon, BookOpen, GraduationCap } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/components/theme-provider";
import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { ProfileMenu } from "@/components/profile-menu";
import { InstallAppButton } from "@/components/pwa";
import { api, type LeaderRow, type Course, type UtilizadorPesquisa } from "@/lib/api";


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

  // ── Pesquisa (cursos, categorias e professores) ─────────────────────────
  const [query, setQuery] = useState("");
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [aPesquisar, setAPesquisar] = useState(false);
  const [cursosEncontrados, setCursosEncontrados] = useState<Course[]>([]);
  const [professoresEncontrados, setProfessoresEncontrados] = useState<UtilizadorPesquisa[]>([]);
  const todosCursosRef = useRef<Course[] | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  const pesquisar = useCallback(async (q: string) => {
    const termo = q.trim();
    if (termo.length < 2) {
      setCursosEncontrados([]);
      setProfessoresEncontrados([]);
      setAPesquisar(false);
      return;
    }
    setAPesquisar(true);

    // Os cursos só têm paginação pequena nesta plataforma — busca-se a lista
    // uma vez (cache em ref, não re-pedida a cada tecla) e filtra-se aqui
    // por título ou categoria, em vez de um endpoint de pesquisa dedicado.
    if (!todosCursosRef.current) {
      todosCursosRef.current = await api.getCursos();
    }
    const termoMin = termo.toLowerCase();
    const cursos = todosCursosRef.current.filter(
      (c) => c.title.toLowerCase().includes(termoMin) || c.category.toLowerCase().includes(termoMin),
    );

    const utilizadores = await api.pesquisarUtilizadores(termo);
    const professores = utilizadores.filter((u) => u.isTeacher);

    setCursosEncontrados(cursos.slice(0, 5));
    setProfessoresEncontrados(professores.slice(0, 5));
    setAPesquisar(false);
  }, []);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      void pesquisar(query);
    }, 250);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [query, pesquisar]);

  useEffect(() => {
    const onClickFora = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setMostrarResultados(false);
      }
    };
    document.addEventListener("mousedown", onClickFora);
    return () => document.removeEventListener("mousedown", onClickFora);
  }, []);

  const semResultados =
    !aPesquisar && cursosEncontrados.length === 0 && professoresEncontrados.length === 0;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-3 backdrop-blur md:px-6">
      <SidebarTrigger className="shrink-0" />

      <div ref={searchWrapRef} className="relative flex-1 min-w-0 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Pesquisar curso, categoria ou professor…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setMostrarResultados(true);
          }}
          onFocus={() => setMostrarResultados(true)}
          className="h-10 rounded-full bg-surface pl-10 pr-4 border-border/70 focus-visible:ring-2 focus-visible:ring-primary/40"
        />

        {mostrarResultados && (query.trim().length >= 2 || aPesquisar) && (
          <Card className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[70vh] overflow-y-auto p-1 shadow-elevated">
            {aPesquisar ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">A pesquisar…</div>
            ) : semResultados ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">Nenhum resultado encontrado.</div>
            ) : (
              <>
                {cursosEncontrados.length > 0 && (
                  <div className="py-1">
                    <p className="px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      Cursos
                    </p>
                    <ul>
                      {cursosEncontrados.map((curso) => (
                        <li key={curso.id}>
                          <Link
                            href={`/cursos/${curso.id}`}
                            onClick={() => setMostrarResultados(false)}
                            className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface"
                          >
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                              <BookOpen className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">{curso.title}</p>
                              <p className="truncate text-xs text-muted-foreground">{curso.category}</p>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {professoresEncontrados.length > 0 && (
                  <div className="py-1">
                    <p className="px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      Professores
                    </p>
                    <ul>
                      {professoresEncontrados.map((prof) => (
                        <li key={prof.id}>
                          <Link
                            href={`/perfil/${prof.id}`}
                            onClick={() => setMostrarResultados(false)}
                            className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface"
                          >
                            <Avatar className="h-9 w-9 shrink-0">
                              {prof.foto ? (
                                <AvatarImage src={prof.foto} alt={prof.name} className="object-cover" />
                              ) : null}
                              <AvatarFallback className="bg-gradient-gold text-primary-foreground font-semibold uppercase text-sm">
                                {prof.initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">{prof.name}</p>
                              <p className="truncate text-xs text-muted-foreground">@{prof.username}</p>
                            </div>
                            <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </Card>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
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

        <Button
          asChild
          variant="ghost"
          size="icon"
          className="relative rounded-full"
          aria-label={naoLidas > 0 ? `Notificações (${naoLidas} por ler)` : "Notificações"}
        >
          <Link href="/notificacoes">
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

        <ProfileMenu />
      </div>
    </header>
  );
}
