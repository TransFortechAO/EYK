"use client";

import { PageHeader, SectionHeader, CourseCard, VideoCard } from "@/components/eyk";
import { mockCourses, mockVideos } from "@/lib/mock-data";
import { useAuth } from "@/components/auth-gate";

export default function HomePage() {
  const { user } = useAuth();
  const emAndamento = mockCourses.filter((c) => typeof c.progress === "number");
  const recentes = mockVideos.slice(0, 3);
  const firstName = user?.name?.split(" ")[0] || "Estudante";

  return (
    <div className="space-y-10">
      <PageHeader
        title={`Olá, ${firstName}`}
        description="Continua de onde ficaste ou explora novos conteúdos."
      />

      <section>
        <SectionHeader title="Continuar a aprender" href="/cursos" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(emAndamento.length > 0 ? emAndamento : mockCourses.slice(0, 3)).map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Vídeos recentes" href="/videos" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {recentes.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      </section>
    </div>
  );
}
