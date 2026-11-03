"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionHeader, CourseCard, VideoCard } from "@/components/eyk";
import { api, type Course, type Video } from "@/lib/api";
import { useAuth } from "@/components/auth-gate";
import { InicioEscola, SoPlataformaGeral } from "@/components/instituicao/escola";
import { PesquisaGlobal } from "@/components/pesquisa-global";
import { pesquisaDaPagina } from "@/components/pesquisa-pagina";
import { BoasVindasProfessor } from "@/components/boas-vindas-professor";

// No Início só uma amostra (12 de cada); o resto está nas páginas de Cursos e Vídeos.
const MAXIMO_NO_INICIO = 12;

export default function InicioPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [c, v] = await Promise.all([api.getCursos(), api.getVideos("recent")]);
      if (!alive) return;
      setCourses(c);
      setVideos(v.slice(0, MAXIMO_NO_INICIO));
    })();
    return () => { alive = false; };
  }, []);

  // Os mais recentes primeiro (quem é novo ainda não começou nenhum curso).
  const cursosRecentes = [...courses]
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, MAXIMO_NO_INICIO);
  const firstName = user?.name?.split(" ")[0] || "Estudante";

  return (
    <div className="space-y-10">
      <BoasVindasProfessor />
      <div className="space-y-4">
        <PageHeader
          title={`Olá, ${firstName}`}
          gesto="Olá"
          description="Explora cursos e vídeos e aprende ao teu ritmo."
        />
        {/* Telemóvel/tablet: a pesquisa fica aqui (no topo tapava os outros ícones). */}
        <PesquisaGlobal className="computador:hidden" placeholder={pesquisaDaPagina("/inicio")?.placeholder} />
      </div>

      {/* Com escola parceira: trabalhos de LGA, aulas novas, avisos e desafios da escola. */}
      <InicioEscola />

      {/* Catálogo geral: escondido ao aluno de uma escola que escolheu ver só a escola.
          Só 12 cursos e 12 vídeos — o resto está nas páginas de Cursos e Vídeos. */}
      <SoPlataformaGeral>
        <section>
          <SectionHeader title="Cursos recentes" href="/cursos" cta="Ver todos os cursos" />
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
            {cursosRecentes.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
          {courses.length > MAXIMO_NO_INICIO && (
            <div className="mt-5 flex justify-center">
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/cursos">Ver todos os cursos</Link>
              </Button>
            </div>
          )}
        </section>

        <section>
          <SectionHeader title="Vídeos recentes" href="/videos" cta="Ver todos os vídeos" />
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
          {videos.length >= MAXIMO_NO_INICIO && (
            <div className="mt-5 flex justify-center">
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/videos">Ver todos os vídeos</Link>
              </Button>
            </div>
          )}
        </section>
      </SoPlataformaGeral>
    </div>
  );
}
