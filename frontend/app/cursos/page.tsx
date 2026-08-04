"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { PageHeader, SectionHeader, CourseCard, EmptyState } from "@/components/eyk";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockCourses, courseCategories } from "@/lib/mock-data";

export default function CursosPage() {
  const [category, setCategory] = useState("Todos");
  const courses = category === "Todos"
    ? mockCourses
    : mockCourses.filter((c) => c.category === category);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Cursos"
        description="Explora todos os cursos disponíveis na plataforma EYK."
      />

      <Tabs value={category} onValueChange={setCategory}>
        <TabsList className="bg-surface flex-wrap h-auto py-1">
          {courseCategories.map((cat) => (
            <TabsTrigger key={cat} value={cat}>
              {cat}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <section>
        <SectionHeader title={`${courses.length} curso${courses.length === 1 ? "" : "s"} encontrado${courses.length === 1 ? "" : "s"}`} />
        {courses.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
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
    </div>
  );
}
