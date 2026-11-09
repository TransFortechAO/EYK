"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/eyk";
import { api, type Course, type EmAndamento, type Video } from "@/lib/api";
import { useAuth } from "@/components/auth-gate";
import { ComunidadeComEscola, InicioEscola, SoPlataformaGeral } from "@/components/instituicao/escola";
import { FeedComunidade } from "@/components/comunidade/feed";
import { DestaquesCatalogo, LateralInicio } from "@/components/comunidade/lateral";
import { ContinuarAprender } from "@/components/inicio/aprendizagem";
import { PublicacaoConteudo } from "@/components/comunidade/publicacao-conteudo";
import { PesquisaGlobal } from "@/components/pesquisa-global";
import { pesquisaDaPagina } from "@/components/pesquisa-pagina";
import { BoasVindasProfessor } from "@/components/boas-vindas-professor";

type ComMotivo<T> = T & { motivo: string };
type Sugestoes = { cursos: ComMotivo<Course>[]; videos: ComMotivo<Video>[] };

function baralhar<T>(lista: T[]): T[] {
  const r = [...lista];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** A Comunidade: publicações e, pelo meio, cursos e vídeos para esta pessoa, um a um. */
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

  // Baralhado uma vez por visita: cursos e vídeos misturados, em sítios diferentes.
  const intercalados = useMemo(
    () =>
      baralhar([
        ...(sugestoes?.cursos ?? []).map((c) => ({ chave: `c${c.id}`, no: <PublicacaoConteudo tipo="curso" conteudo={c} motivo={c.motivo} /> })),
        ...(sugestoes?.videos ?? []).map((v) => ({ chave: `v${v.id}`, no: <PublicacaoConteudo tipo="video" conteudo={v} motivo={v.motivo} /> })),
      ]),
    [sugestoes],
  );

  // Em destaque: o curso com mais alunos (desempata a avaliação) e o vídeo mais visto.
  const cursoDestaque = [...cursos].sort((a, b) => b.students - a.students || (b.rating ?? 0) - (a.rating ?? 0))[0] ?? null;
  const videoDestaque = [...videos].sort((a, b) => b.views - a.views)[0] ?? null;

  return (
    <FeedComunidade
      intercalados={intercalados}
      destaques={cursoDestaque || videoDestaque ? <DestaquesCatalogo curso={cursoDestaque} video={videoDestaque} /> : undefined}
      lateral={<LateralInicio />}
    />
  );
}

/**
 * O Início do EYK: Educação · Inclusão · Comunidade. Primeiro a aprendizagem da pessoa
 * (continuar a aprender); depois a Comunidade, com os cursos e vídeos
 * recomendados pelo meio, um a um.
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
