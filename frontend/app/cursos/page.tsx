"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { PageHeader, SectionHeader, CourseCard, EmptyState } from "@/components/eyk";
import { api, type Course } from "@/lib/api";
import { ConteudosComEscola } from "@/components/instituicao/escola";
import { BarraFiltros, normalizarTexto, type DefFiltro } from "@/components/filtros/barra-filtros";

const SEM_FILTROS: Record<string, string> = { categoria: "", nivel: "", duracao: "", professor: "", avaliacao: "", ordem: "" };

const ORDENAR: Record<string, (a: Course, b: Course) => number> = {
  recentes: (a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
  populares: (a, b) => b.students - a.students,
  avaliados: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
  curtos: (a, b) => a.durationHours - b.durationHours,
};

function dentroDaDuracao(c: Course, faixa: string): boolean {
  if (faixa === "ate1") return c.durationHours <= 1;
  if (faixa === "1a3") return c.durationHours > 1 && c.durationHours <= 3;
  if (faixa === "mais3") return c.durationHours > 3;
  return true;
}

export default function CursosPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [pesquisa, setPesquisa] = useState("");
  const [valores, setValores] = useState(SEM_FILTROS);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [cats, curs] = await Promise.all([api.getCategories(), api.getCursos()]);
      if (!alive) return;
      setCategories(cats.filter((c) => c !== "Todos"));
      setCourses(curs);
    })();
    return () => { alive = false; };
  }, []);

  const filtros: DefFiltro[] = useMemo(() => {
    const professores = [...new Set(courses.map((c) => c.teacher))].sort((a, b) => a.localeCompare(b, "pt"));
    return [
      { id: "categoria", rotulo: "Categoria", todos: "Todas as categorias", visivelPorOmissao: true,
        opcoes: categories.map((c) => ({ valor: c, rotulo: c })) },
      { id: "nivel", rotulo: "Nível", todos: "Todos os níveis", visivelPorOmissao: true,
        opcoes: ["Iniciante", "Intermédio", "Avançado"].map((n) => ({ valor: n, rotulo: n })) },
      { id: "duracao", rotulo: "Duração", todos: "Qualquer duração", visivelPorOmissao: true,
        opcoes: [{ valor: "ate1", rotulo: "Até 1 hora" }, { valor: "1a3", rotulo: "1 a 3 horas" }, { valor: "mais3", rotulo: "Mais de 3 horas" }] },
      { id: "professor", rotulo: "Professor", todos: "Todos os professores", visivelPorOmissao: false,
        opcoes: professores.map((p) => ({ valor: p, rotulo: p })) },
      { id: "avaliacao", rotulo: "Avaliação", todos: "Qualquer avaliação", visivelPorOmissao: false,
        opcoes: [{ valor: "4", rotulo: "4 estrelas ou mais" }, { valor: "3", rotulo: "3 estrelas ou mais" }] },
      { id: "ordem", rotulo: "Ordenar", todos: "Ordenar: recomendados", visivelPorOmissao: true,
        opcoes: [
          { valor: "recentes", rotulo: "Mais recentes" },
          { valor: "populares", rotulo: "Mais alunos" },
          { valor: "avaliados", rotulo: "Melhor avaliados" },
          { valor: "curtos", rotulo: "Mais curtos" },
        ] },
    ];
  }, [courses, categories]);

  const filtered = useMemo(() => {
    const termo = normalizarTexto(pesquisa.trim());
    const lista = courses.filter(
      (c) =>
        (!termo || normalizarTexto(`${c.title} ${c.category} ${c.teacher}`).includes(termo)) &&
        (!valores.categoria || c.category === valores.categoria) &&
        (!valores.nivel || c.level === valores.nivel) &&
        dentroDaDuracao(c, valores.duracao) &&
        (!valores.professor || c.teacher === valores.professor) &&
        (!valores.avaliacao || (c.rating ?? 0) >= Number(valores.avaliacao)),
    );
    const ordenar = ORDENAR[valores.ordem];
    return ordenar ? [...lista].sort(ordenar) : lista;
  }, [courses, pesquisa, valores]);

  const limpar = () => {
    setPesquisa("");
    setValores(SEM_FILTROS);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Cursos"
        description="Explora todos os cursos disponíveis na plataforma EYK."
      />

      {/* Com escola parceira: "Da minha escola" ao lado do catálogo público. */}
      <ConteudosComEscola tipo="curso">
        <BarraFiltros
          chave="eyk-filtros-cursos"
          filtros={filtros}
          valores={valores}
          aoMudar={(id, valor) => setValores((v) => ({ ...v, [id]: valor }))}
          pesquisa={pesquisa}
          aoPesquisar={setPesquisa}
          placeholderPesquisa="Pesquisar cursos por título, categoria ou professor…"
          aoLimpar={limpar}
        />

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
              title="Nenhum curso com estes filtros."
              description="Muda ou limpa os filtros para veres mais cursos."
            />
          )}
        </section>
      </ConteudosComEscola>
    </div>
  );
}
