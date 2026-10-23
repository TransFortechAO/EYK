"use client";

import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { PageHeader, SectionHeader, CourseCard, EmptyState } from "@/components/eyk";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, type Course } from "@/lib/api";
import { ConteudosComEscola } from "@/components/instituicao/escola";

export default function CursosPage() {
  const [category, setCategory] = useState("Todos");
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<string[]>(["Todos"]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [cats, curs] = await Promise.all([api.getCategories(), api.getCursos()]);
      if (!alive) return;
      setCategories(cats);
      setCourses(curs);
    })();
    return () => { alive = false; };
  }, []);

  const filtered = category === "Todos"
    ? courses
    : courses.filter((c) => c.category === category);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Cursos"
        description="Explora todos os cursos disponíveis na plataforma EYK."
      />

      {/* Com escola parceira: "Da minha escola" ao lado do catálogo público. */}
      <ConteudosComEscola tipo="curso">
        <Tabs value={category} onValueChange={setCategory}>
          <TabsList className="bg-surface flex-wrap h-auto py-1">
            {categories.map((cat) => (
              <TabsTrigger key={cat} value={cat}>
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <section>
          <SectionHeader title={`${filtered.length} curso${filtered.length === 1 ? "" : "s"} encontrado${filtered.length === 1 ? "" : "s"}`} />
          {filtered.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={BookOpen}
              title="Nenhum curso nesta categoria."
              description="Tenta outra categoria ou explora todos os cursos."
            />
          )}
        </section>
      </ConteudosComEscola>
    </div>
  );
}
