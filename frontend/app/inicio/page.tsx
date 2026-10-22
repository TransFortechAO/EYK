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
      </PageHeader>

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

      {/* Tablet: Leaderboard e Gamificação ficam no Início (no telemóvel estão em "Mais"; no
          computador, na barra lateral). */}
      <section className="hidden gap-5 md:grid md:grid-cols-2 lg:hidden">
        <CartaoLeaderboard />
        <CartaoGamificacao />
      </section>
    </div>
  );
}
