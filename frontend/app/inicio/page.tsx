"use client";

import { Suspense, useEffect, useState } from "react";
import { PageHeader, SectionHeader, CourseCard, VideoCard } from "@/components/eyk";
import { api, type Course, type EmAndamento, type Video } from "@/lib/api";
import { useAuth } from "@/components/auth-gate";
import { ComunidadeComEscola, InicioEscola, SoPlataformaGeral } from "@/components/instituicao/escola";
import { FeedComunidade } from "@/components/comunidade/feed";
import { DestaquesCatalogo, LateralInicio } from "@/components/comunidade/lateral";
import { AprendeAcessivel, ContinuarAprender, Recomendados } from "@/components/inicio/aprendizagem";
import { PesquisaGlobal } from "@/components/pesquisa-global";
import { pesquisaDaPagina } from "@/components/pesquisa-pagina";
import { BoasVindasProfessor } from "@/components/boas-vindas-professor";

/** Quantas recomendações aparecem em cima; as seguintes entram no meio do feed. */
const NO_TOPO = 4;

type ComMotivo<T> = T & { motivo: string };
type Sugestoes = { cursos: ComMotivo<Course>[]; videos: ComMotivo<Video>[] };

function Faixa({ titulo, href, cta, children }: { titulo: string; href: string; cta: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface/50 p-4">
      <SectionHeader title={titulo} href={href} cta={cta} />
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** A Comunidade: publicações e, pelo meio, mais recomendações. */
function Feed({ sugestoes }: { sugestoes: Sugestoes | null }) {
  const [cursos, setCursos] = useState<Course[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);

  useEffect(() => {
    let vivo = true;
    void Promise.all([api.getCursos(), api.getVideos("recent")]).then(([c, v]) => {
      if (!vivo) return;
      setCursos(c);
      setVideos(v);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const maisCursos = sugestoes?.cursos.slice(NO_TOPO, NO_TOPO * 2) ?? [];
  const maisVideos = sugestoes?.videos.slice(NO_TOPO, NO_TOPO * 2) ?? [];
  const faixas = [
    maisCursos.length > 0 && (
      <Faixa key="c" titulo="Mais cursos para ti" href="/cursos" cta="Ver todos os cursos">
        {maisCursos.map((c) => <CourseCard key={c.id} course={c} />)}
      </Faixa>
    ),
    maisVideos.length > 0 && (
      <Faixa key="v" titulo="Mais vídeos para ti" href="/videos" cta="Ver todos os vídeos">
        {maisVideos.map((v) => <VideoCard key={v.id} video={v} />)}
      </Faixa>
    ),
  ].filter(Boolean);

  // Em destaque: o curso com mais alunos (desempata a avaliação) e o vídeo mais visto.
  const cursoDestaque = [...cursos].sort((a, b) => b.students - a.students || (b.rating ?? 0) - (a.rating ?? 0))[0] ?? null;
  const videoDestaque = [...videos].sort((a, b) => b.views - a.views)[0] ?? null;

  return (
    <FeedComunidade
      faixas={faixas}
      destaques={<DestaquesCatalogo curso={cursoDestaque} video={videoDestaque} />}
      lateral={<LateralInicio />}
    />
  );
}

/**
 * O Início do EYK: Educação · Inclusão · Comunidade. Primeiro a aprendizagem da pessoa
 * (continuar, aprender em LGA, acessibilidade, recomendações); depois a Comunidade.
 */
export default function InicioPage() {
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0] || "Estudante";
  const [emAndamento, setEmAndamento] = useState<EmAndamento | null>(null);
  const [sugestoes, setSugestoes] = useState<Sugestoes | null>(null);

  useEffect(() => {
    let vivo = true;
    void api.inicio.continuar().then((d) => vivo && setEmAndamento(d)).catch(() => vivo && setEmAndamento({ cursos: [], videos: [] }));
    void api.inicio.recomendados().then((d) => vivo && setSugestoes(d)).catch(() => vivo && setSugestoes({ cursos: [], videos: [] }));
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <div className="space-y-10">
      <BoasVindasProfessor />
      <div className="space-y-4">
        <PageHeader
          title={`Olá, ${firstName}`}
          gesto="Olá"
          description="A tua aprendizagem continua aqui. Descobre, aprende e evolui ao teu ritmo."
        />
        {/* Telemóvel/tablet: a pesquisa fica aqui (no topo tapava os outros ícones). */}
        <PesquisaGlobal className="computador:hidden" placeholder={pesquisaDaPagina("/inicio")?.placeholder} />
      </div>

      {/* Catálogo geral: escondido ao aluno de uma escola que escolheu ver só a escola. */}
      <SoPlataformaGeral>
        <ContinuarAprender dados={emAndamento} />
      </SoPlataformaGeral>

      {/* Com escola parceira: trabalhos de LGA, aulas novas, avisos e desafios da escola. */}
      <InicioEscola />

      <AprendeAcessivel />

      <SoPlataformaGeral>
        {sugestoes && <Recomendados cursos={sugestoes.cursos.slice(0, NO_TOPO)} videos={sugestoes.videos.slice(0, NO_TOPO)} />}
      </SoPlataformaGeral>

      <section aria-labelledby="comunidade" className="space-y-4">
        <div>
          <h2 id="comunidade" className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">
            Comunidade EYK
          </h2>
          <p className="text-sm text-muted-foreground">Partilha experiências, coloca questões e aprende com outras pessoas.</p>
        </div>
        {/* Com escola: separadores para a comunidade de cada Turma LGA; o aluno que só vê a escola não vê o feed geral. */}
        <ComunidadeComEscola>
          <Suspense fallback={null}>
            <Feed sugestoes={sugestoes} />
          </Suspense>
        </ComunidadeComEscola>
      </section>
    </div>
  );
}
