"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader, SectionHeader, CourseCard, VideoCard } from "@/components/eyk";
import { api, type Course, type Video, type UtilizadorPesquisa } from "@/lib/api";
import { useAuth } from "@/components/auth-gate";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CartaoGamificacao, CartaoLeaderboard } from "@/components/inicio-cartoes";
import { InicioEscola, SoPlataformaGeral } from "@/components/instituicao/escola";
import { cn } from "@/lib/utils";

export default function InicioPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<UtilizadorPesquisa[]>([]);
  const [aPesquisar, setAPesquisar] = useState(false);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [c, v] = await Promise.all([api.getCursos(), api.getVideos("recent")]);
      if (!alive) return;
      setCourses(c);
      setVideos(v.slice(0, 4));
    })();
    return () => { alive = false; };
  }, []);

  const pesquisar = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResultados([]);
      setAPesquisar(false);
      return;
    }
    setAPesquisar(true);
    const res = await api.pesquisarUtilizadores(q.trim());
    setResultados(res);
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

  const emAndamento = courses.filter((c) => typeof c.progress === "number");
  const firstName = user?.name?.split(" ")[0] || "Estudante";

  return (
    <div className="space-y-10">
      <PageHeader
        title={`Olá, ${firstName}`}
        description="Continua de onde ficaste ou explora novos conteúdos."
      >
        <div ref={searchWrapRef} className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Pesquisar utilizadores…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setMostrarResultados(true);
            }}
            onFocus={() => setMostrarResultados(true)}
            className="pl-9 pr-9"
          />
          {mostrarResultados && (query.trim().length >= 2 || resultados.length > 0 || aPesquisar) && (
            <Card className="absolute right-0 left-0 top-full z-30 mt-2 overflow-hidden p-1 shadow-elevated">
              {aPesquisar ? (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">A pesquisar…</div>
              ) : resultados.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">Nenhum utilizador encontrado.</div>
              ) : (
                <ul className="max-h-80 overflow-y-auto py-1">
                  {resultados.map((u) => (
                    <li key={u.id}>
                      <Link
                        href={`/perfil/${u.id}`}
                        onClick={() => setMostrarResultados(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface",
                        )}
                      >
                        <Avatar className="h-9 w-9 shrink-0">
                          {u.foto ? (
                            <AvatarImage src={u.foto} alt={u.name} className="object-cover" />
                          ) : null}
                          <AvatarFallback className="bg-gradient-gold text-primary-foreground font-semibold uppercase text-sm">
                            {u.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{u.name}</p>
                          <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0 rounded-full text-[10px] font-normal">
                          {u.isTeacher ? "Professor" : "Aluno"}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </PageHeader>

      {/* Com escola parceira: trabalhos de LGA, aulas novas, avisos e desafios da escola. */}
      <InicioEscola />

      {/* Catálogo geral: escondido ao aluno de uma escola que escolheu ver só a escola. */}
      <SoPlataformaGeral>
        <section>
          <SectionHeader
            title="Continuar a aprender"
            href="/cursos"
          />
          {/* 2 colunas em tablet, 3 em computador (a 4.ª só aparece nas 2 colunas). */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:[&>*:nth-child(n+4)]:hidden">
            {(emAndamento.length > 0 ? emAndamento : courses.slice(0, 4)).map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </section>

        <section>
          <SectionHeader title="Vídeos recentes" href="/videos" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:[&>*:nth-child(n+4)]:hidden">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        </section>
      </SoPlataformaGeral>

      {/* Tablet: Leaderboard e Gamificação ficam no Início (no telemóvel estão em "Mais"; no
          computador, na barra lateral). */}
      <section className="hidden gap-5 md:grid md:grid-cols-2 lg:hidden">
        <CartaoLeaderboard />
        <CartaoGamificacao />
      </section>
    </div>
  );
}
