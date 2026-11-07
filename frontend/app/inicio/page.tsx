"use client";

import { Suspense, useEffect, useState } from "react";
import { PageHeader, SectionHeader, CourseCard, VideoCard } from "@/components/eyk";
import { api, type Course, type Video } from "@/lib/api";
import { useAuth } from "@/components/auth-gate";
import { ComunidadeComEscola, InicioEscola } from "@/components/instituicao/escola";
import { FeedComunidade } from "@/components/comunidade/feed";
import { PesquisaGlobal } from "@/components/pesquisa-global";
import { pesquisaDaPagina } from "@/components/pesquisa-pagina";
import { BoasVindasProfessor } from "@/components/boas-vindas-professor";

/** Quantos cursos ou vídeos entram em cada faixa do feed. */
const POR_FAIXA = 4;

function Faixa({ titulo, href, cta, children }: { titulo: string; href: string; cta: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface/50 p-4">
      <SectionHeader title={titulo} href={href} cta={cta} />
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/**
 * O Início é a Comunidade: publicações e, pelo meio, faixas de cursos e vídeos — tudo
 * numa só página, sem saltar entre Início e Comunidade. O catálogo completo, com filtros,
 * continua em Cursos e Vídeos.
 */
function Feed() {
  const [cursos, setCursos] = useState<Course[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);

  useEffect(() => {
    let vivo = true;
    void Promise.all([api.getCursos(), api.getVideos("recent")]).then(([c, v]) => {
      if (!vivo) return;
      // Os mais recentes primeiro (quem é novo ainda não começou nenhum curso).
      setCursos([...c].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")));
      setVideos(v);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const bloco = <T,>(lista: T[], n: number) => lista.slice(n * POR_FAIXA, (n + 1) * POR_FAIXA);
  const faixas = [
    bloco(cursos, 0).length > 0 && (
      <Faixa key="c0" titulo="Cursos recentes" href="/cursos" cta="Ver todos os cursos">
        {bloco(cursos, 0).map((c) => <CourseCard key={c.id} course={c} />)}
      </Faixa>
    ),
    bloco(videos, 0).length > 0 && (
      <Faixa key="v0" titulo="Vídeos recentes" href="/videos" cta="Ver todos os vídeos">
        {bloco(videos, 0).map((v) => <VideoCard key={v.id} video={v} />)}
      </Faixa>
    ),
    bloco(cursos, 1).length > 0 && (
      <Faixa key="c1" titulo="Mais cursos para ti" href="/cursos" cta="Ver todos os cursos">
        {bloco(cursos, 1).map((c) => <CourseCard key={c.id} course={c} />)}
      </Faixa>
    ),
    bloco(videos, 1).length > 0 && (
      <Faixa key="v1" titulo="Mais vídeos" href="/videos" cta="Ver todos os vídeos">
        {bloco(videos, 1).map((v) => <VideoCard key={v.id} video={v} />)}
      </Faixa>
    ),
  ].filter(Boolean);

  return <FeedComunidade faixas={faixas} />;
}

export default function InicioPage() {
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0] || "Estudante";

  return (
    <div className="space-y-8">
      <BoasVindasProfessor />
      <div className="space-y-4">
        <PageHeader
          title={`Olá, ${firstName}`}
          gesto="Olá"
          description="Publicações da comunidade, cursos e vídeos — tudo num só lugar."
        />
        {/* Telemóvel/tablet: a pesquisa fica aqui (no topo tapava os outros ícones). */}
        <PesquisaGlobal className="computador:hidden" placeholder={pesquisaDaPagina("/inicio")?.placeholder} />
      </div>

      {/* Com escola parceira: trabalhos de LGA, aulas novas, avisos e desafios da escola. */}
      <InicioEscola />

      {/* Com escola: separadores para a comunidade de cada Turma LGA; o aluno que só vê a escola não vê o feed geral. */}
      <ComunidadeComEscola>
        <Suspense fallback={null}>
          <Feed />
        </Suspense>
      </ComunidadeComEscola>
    </div>
  );
}
