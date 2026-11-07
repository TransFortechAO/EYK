"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, GraduationCap, PlayCircle, Search, X } from "lucide-react";
import { api, type Course, type UtilizadorPesquisa, type Video } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Pesquisa geral: cursos, vídeos e professores (com os resultados por baixo). Usada na barra do topo e, no
 * telemóvel/tablet, por baixo do título do Início (para não tapar os ícones do topo).
 */
export function PesquisaGlobal({
  className,
  autoFocus,
  aoFechar,
  placeholder = "Pesquisar cursos, vídeos ou professores…",
}: {
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** Mostra o botão de fechar (telemóvel, quando a pesquisa abre por cima do topo). */
  aoFechar?: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [aPesquisar, setAPesquisar] = useState(false);
  const [cursosEncontrados, setCursosEncontrados] = useState<Course[]>([]);
  const [professoresEncontrados, setProfessoresEncontrados] = useState<UtilizadorPesquisa[]>([]);
  const [videosEncontrados, setVideosEncontrados] = useState<Video[]>([]);
  const todosCursosRef = useRef<Course[] | null>(null);
  const todosVideosRef = useRef<Video[] | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  const pesquisar = useCallback(async (q: string) => {
    const termo = q.trim();
    if (termo.length < 2) {
      setCursosEncontrados([]);
      setVideosEncontrados([]);
      setProfessoresEncontrados([]);
      setAPesquisar(false);
      return;
    }
    setAPesquisar(true);

    // Os cursos só têm paginação pequena nesta plataforma — busca-se a lista
    // uma vez (cache em ref, não re-pedida a cada tecla) e filtra-se aqui
    // por título ou categoria, em vez de um endpoint de pesquisa dedicado.
    if (!todosCursosRef.current || !todosVideosRef.current) {
      [todosCursosRef.current, todosVideosRef.current] = await Promise.all([api.getCursos(), api.getVideos("recent")]);
    }
    const termoMin = termo.toLowerCase();
    const cursos = todosCursosRef.current.filter(
      (c) => c.title.toLowerCase().includes(termoMin) || c.category.toLowerCase().includes(termoMin),
    );

    const utilizadores = await api.pesquisarUtilizadores(termo);
    const professores = utilizadores.filter((u) => u.isTeacher);

    const videos = todosVideosRef.current.filter(
      (v) => v.title.toLowerCase().includes(termoMin) || v.teacher.toLowerCase().includes(termoMin),
    );

    setCursosEncontrados(cursos.slice(0, 5));
    setVideosEncontrados(videos.slice(0, 5));
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
    !aPesquisar && cursosEncontrados.length === 0 && videosEncontrados.length === 0 && professoresEncontrados.length === 0;

  return (
    <div ref={searchWrapRef} className={cn("relative flex min-w-0 items-center gap-2", className)}>
      <form
        role="search"
        className="relative min-w-0 flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim().length < 2) return;
          setMostrarResultados(false);
          router.push(`/pesquisa?q=${encodeURIComponent(query.trim())}`);
        }}
      >
        <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setMostrarResultados(true);
          }}
          onFocus={() => setMostrarResultados(true)}
          // Tema claro: sem borda nem sombra; no escuro mantém a borda.
          type="search"
          enterKeyHint="search"
          className="h-10 rounded-full border-transparent bg-surface pl-4 pr-10 shadow-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-border/70"
        />
      </form>
      {aoFechar && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Fechar pesquisa"
          onClick={() => {
            aoFechar();
            setMostrarResultados(false);
          }}
          className="shrink-0 sm:hidden"
        >
          <X className="h-5 w-5" />
        </Button>
      )}

      {mostrarResultados && (query.trim().length >= 2 || aPesquisar) && (
        <Card className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[70vh] overflow-y-auto p-1 shadow-elevated">
          {aPesquisar ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">A pesquisar…</div>
          ) : semResultados ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">Nada nos cursos, vídeos e professores.</div>
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

              {videosEncontrados.length > 0 && (
                <div className="py-1">
                  <p className="px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Vídeos
                  </p>
                  <ul>
                    {videosEncontrados.map((video) => (
                      <li key={video.id}>
                        <Link
                          href={`/videos/${video.id}`}
                          onClick={() => setMostrarResultados(false)}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface"
                        >
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                            <PlayCircle className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{video.title}</p>
                            <p className="truncate text-xs text-muted-foreground">{video.teacher}</p>
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
          {!aPesquisar && query.trim().length >= 2 && (
            <Link
              href={`/pesquisa?q=${encodeURIComponent(query.trim())}`}
              onClick={() => setMostrarResultados(false)}
              className="mt-1 flex items-center justify-center gap-2 rounded-lg border-t border-border/60 px-3 py-3 text-sm font-medium text-primary transition-colors hover:bg-surface"
            >
              <Search className="h-4 w-4" aria-hidden /> Ver todos os resultados para «{query.trim()}»
            </Link>
          )}
        </Card>
      )}
    </div>
  );
}
