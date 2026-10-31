"use client";

import { useEffect, useState } from "react";
import { PageHeader, SectionHeader, CourseCard, VideoCard } from "@/components/eyk";
import { api, type Course, type Video } from "@/lib/api";
import { useAuth } from "@/components/auth-gate";
import { InicioEscola, SoPlataformaGeral } from "@/components/instituicao/escola";
import { PesquisaGlobal } from "@/components/pesquisa-global";
import { BoasVindasProfessor } from "@/components/boas-vindas-professor";

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
      setVideos(v.slice(0, 4));
    })();
    return () => { alive = false; };
  }, []);

  // Os mais recentes primeiro (quem é novo ainda não começou nenhum curso).
  const cursosRecentes = [...courses]
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, 4);
  const firstName = user?.name?.split(" ")[0] || "Estudante";

  return (
    <div className="space-y-10">
      <BoasVindasProfessor />
      <div className="space-y-4">
        <PageHeader
          title={`Olá, ${firstName}`}
          description="Explora cursos e vídeos e aprende ao teu ritmo."
        />
        {/* Telemóvel/tablet: a pesquisa fica aqui (no topo tapava os outros ícones). */}
        <PesquisaGlobal className="computador:hidden" />
      </div>

      {/* Com escola parceira: trabalhos de LGA, aulas novas, avisos e desafios da escola. */}
      <InicioEscola />

      {/* Catálogo geral: escondido ao aluno de uma escola que escolheu ver só a escola.
          Só 4 cursos e 4 vídeos — o resto está nas páginas de Cursos e Vídeos. */}
      <SoPlataformaGeral>
        <section>
          <SectionHeader title="Cursos recentes" href="/cursos" cta="Ver todos os cursos" />
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {cursosRecentes.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </section>

        <section>
          <SectionHeader title="Vídeos recentes" href="/videos" cta="Ver todos os vídeos" />
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        </section>
      </SoPlataformaGeral>
    </div>
  );
}
