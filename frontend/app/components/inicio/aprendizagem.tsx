"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { mediaUrl, type EmAndamento } from "@/lib/api";

/**
 * O Início centrado na aprendizagem: primeiro o que a pessoa está a aprender; a
 * Comunidade vem a seguir, com as recomendações pelo meio.
 */

const minutos = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} min` : `${s} s`);

function Capa({ src, icone: Icone }: { src: string | null; icone: typeof BookOpen }) {
  const url = mediaUrl(src);
  return (
    <div className="relative grid aspect-video w-28 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-primary/20 to-surface sm:w-36">
      {/* eslint-disable-next-line @next/next/no-img-element -- capa do curso ou vídeo, já servida pela media */}
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <Icone className="h-7 w-7 text-primary" aria-hidden />}
    </div>
  );
}

/** "Continua a aprender": cursos em andamento e vídeos deixados a meio. */
export function ContinuarAprender({ dados }: { dados: EmAndamento | null }) {
  // Esta secção é sobre cursos por concluir. Sem um curso em andamento,
  // não há título nem card para mostrar (mesmo que existam vídeos a meio).
  if (!dados || dados.cursos.length === 0) return null;
  return (
    <section aria-labelledby="continuar" className="space-y-3">
      <h2 id="continuar" className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">
        Continua a aprender
      </h2>
      <div className="grid gap-3 lg:grid-cols-2">
          {dados.cursos.map((c) => (
            <Card key={`c${c.cursoId}`} className="flex gap-4 p-4 shadow-soft">
              <Capa src={c.thumbnail} icone={BookOpen} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Em andamento{c.categoria ? ` · ${c.categoria}` : ""}</p>
                <p className="line-clamp-1 font-medium">{c.titulo}</p>
                <p className="line-clamp-1 text-xs text-muted-foreground">Última aula: {c.ultimaAula.titulo}</p>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-secondary"
                  role="progressbar"
                  aria-valuenow={c.progresso}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${c.progresso}% concluído`}
                >
                  <div className="h-full rounded-full bg-gradient-gold" style={{ width: `${c.progresso}%` }} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {c.progresso}% concluído · {c.aulasVistas} de {c.totalAulas} aulas
                  </span>
                  <Button asChild size="sm" className="h-8 gap-1 rounded-full px-3">
                    <Link href={`/cursos/${c.cursoId}`}>
                      Continuar <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {dados.videos.map((v) => (
            <Card key={`v${v.videoId}`} className="flex gap-4 p-4 shadow-soft">
              <Capa src={v.thumbnail} icone={PlayCircle} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Vídeo a meio</p>
                <p className="line-clamp-2 font-medium">{v.titulo}</p>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    Paraste aos {minutos(v.segundos)}
                    {v.duracao ? ` de ${minutos(v.duracao)}` : ""}
                  </span>
                  <Button asChild size="sm" variant="outline" className="h-8 gap-1 rounded-full px-3">
                    <Link href={`/videos/${v.videoId}`}>
                      Retomar <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
      </div>
    </section>
  );
}
