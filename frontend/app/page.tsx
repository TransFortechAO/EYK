import { PageHeader, SectionHeader, CourseCard, VideoCard } from "@/components/eyk";
import { mockCourses, mockVideos, currentUser } from "@/lib/mock-data";

export const metadata = {
  title: "Início · EYK",
  description: "O teu ponto de partida na plataforma EYK.",
};

export default function HomePage() {
  const emAndamento = mockCourses.filter((c) => typeof c.progress === "number");
  const recentes = mockVideos.slice(0, 3);

  return (
    <div className="space-y-10">
      <PageHeader
        title={`Olá, ${currentUser.name.split(" ")[0]}`}
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
