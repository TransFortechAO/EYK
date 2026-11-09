"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Captions, Contrast, Hand, PlayCircle, Settings2, Sparkles, Type } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CourseCard, SectionHeader, VideoCard } from "@/components/eyk";
import { useAuth } from "@/components/auth-gate";
import { LgaSign } from "@/components/lga-sign";
import { api, mediaUrl, type Course, type EmAndamento, type TamanhoTexto, type Video } from "@/lib/api";
import { lgaSigns } from "@/lib/lga-data";
import { aplicarPreferenciasVisuais } from "@/lib/preferencias-visuais";
import { cn } from "@/lib/utils";

/**
 * O Início centrado na aprendizagem (Educação · Inclusão · Comunidade): primeiro o que a
 * pessoa está a aprender, depois a aprendizagem acessível (LGA e acessibilidade), depois
 * o que lhe recomendamos; a Comunidade vem a seguir.
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
  if (!dados) return null;
  const vazio = dados.cursos.length === 0 && dados.videos.length === 0;
  return (
    <section aria-labelledby="continuar" className="space-y-3">
      <h2 id="continuar" className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">
        Continua a aprender
      </h2>
      {vazio ? (
        <Card className="flex flex-col items-start gap-3 p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Ainda não começaste nenhum curso.</p>
            <p className="text-sm text-muted-foreground">Escolhe um curso e a tua aprendizagem fica aqui, pronta para continuar.</p>
          </div>
          <Button asChild className="gap-2 rounded-full">
            <Link href="/cursos">
              Explorar cursos <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </Card>
      ) : (
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
      )}
    </section>
  );
}

/** Quatro sinais diferentes por dia, para a Biblioteca LGA ter sempre algo novo. */
function sinaisDoDia(n = 4) {
  const dia = Math.floor(Date.now() / 86_400_000);
  const semLetras = lgaSigns.filter((s) => s.category !== "Alfabeto");
  return Array.from({ length: n }, (_, i) => semLetras[(dia * 7 + i * 13) % semLetras.length]);
}

const TAMANHOS: { valor: TamanhoTexto; rotulo: string; classe: string }[] = [
  { valor: "normal", rotulo: "Texto normal", classe: "text-sm" },
  { valor: "grande", rotulo: "Texto grande", classe: "text-base" },
  { valor: "muito_grande", rotulo: "Texto muito grande", classe: "text-lg" },
];

// Fora do componente: definido lá dentro seria recriado a cada clique e o teclado perdia o foco.
function Interruptor({ ligado, desligado, icone: Icone, rotulo, onClick }: { ligado: boolean; desligado: boolean; icone: typeof Captions; rotulo: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      disabled={desligado}
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors",
        ligado ? "bg-primary text-primary-foreground" : "bg-surface text-foreground hover:bg-accent",
      )}
    >
      <Icone className="h-4 w-4" aria-hidden />
      {rotulo}
    </button>
  );
}

function Motivo({ texto }: { texto: string }) {
  return <p className="mt-1.5 px-1 text-xs text-muted-foreground">{texto}</p>;
}

/** Acessibilidade num toque: as mesmas preferências de Configurações → Aparência e Reprodução. */
function AcessibilidadeRapida() {
  const { user, refresh } = useAuth();
  const p = user?.preferencias;
  const [aGuardar, setAGuardar] = useState(false);
  if (!p) return null;

  const mudar = async (dados: { legendas_ativas?: boolean; alto_contraste?: boolean; tamanho_texto?: TamanhoTexto }) => {
    setAGuardar(true);
    const visuais = {
      tamanhoTexto: dados.tamanho_texto ?? p.tamanhoTexto,
      altoContraste: dados.alto_contraste ?? p.altoContraste,
      reduzirAnimacoes: p.reduzirAnimacoes,
    };
    aplicarPreferenciasVisuais(visuais);
    try {
      await api.preferencias.atualizar(dados);
      await refresh();
    } catch {
      aplicarPreferenciasVisuais({ tamanhoTexto: p.tamanhoTexto, altoContraste: p.altoContraste, reduzirAnimacoes: p.reduzirAnimacoes });
      toast.error("Não foi possível guardar. Tenta de novo.");
    } finally {
      setAGuardar(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4 p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Sparkles className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h3 className="font-serif text-lg font-semibold">Acessibilidade</h3>
          <p className="text-sm text-muted-foreground">Adapta a EYK às tuas necessidades. Fica guardado na tua conta.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Interruptor desligado={aGuardar} ligado={p.legendasAtivas} icone={Captions} rotulo="Legendas" onClick={() => void mudar({ legendas_ativas: !p.legendasAtivas })} />
        <Interruptor desligado={aGuardar} ligado={p.altoContraste} icone={Contrast} rotulo="Contraste elevado" onClick={() => void mudar({ alto_contraste: !p.altoContraste })} />
      </div>
      <div role="radiogroup" aria-label="Tamanho do texto" className="flex items-center gap-2">
        <Type className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        {TAMANHOS.map((t) => (
          <button
            key={t.valor}
            type="button"
            role="radio"
            aria-checked={p.tamanhoTexto === t.valor}
            aria-label={t.rotulo}
            disabled={aGuardar}
            onClick={() => void mudar({ tamanho_texto: t.valor })}
            className={cn(
              "grid h-11 w-11 place-items-center rounded-full font-serif font-semibold transition-colors",
              t.classe,
              p.tamanhoTexto === t.valor ? "bg-primary text-primary-foreground" : "bg-surface hover:bg-accent",
            )}
          >
            A
          </button>
        ))}
      </div>
      <Link href="/configuracoes?tab=aparencia" className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <Settings2 className="h-4 w-4" aria-hidden /> Mais preferências de acessibilidade
      </Link>
    </Card>
  );
}

function BibliotecaDestaque() {
  const sinais = sinaisDoDia();
  return (
    <Card className="flex flex-col gap-4 p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-gold text-primary-foreground shadow-gold">
          <Hand className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h3 className="font-serif text-lg font-semibold">Aprende em Língua Gestual Angolana</h3>
          <p className="text-sm text-muted-foreground">Sinais, alfabeto e vocabulário do dia a dia, por categorias.</p>
        </div>
      </div>
      <ul className="grid grid-cols-4 gap-2" aria-label="Sinais de hoje">
        {sinais.map((s) => (
          <li key={s.id}>
            <Link href="/biblioteca" className="flex flex-col items-center gap-1 rounded-xl bg-surface p-2 text-center transition-colors hover:bg-accent">
              <LgaSign glyph={s.glyph} motion={s.motion} hoverPlay className="text-3xl" label={s.term} />
              <span className="line-clamp-1 text-[11px] font-medium">{s.term}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Button asChild className="mt-auto w-full gap-2 rounded-full sm:w-auto sm:self-start">
        <Link href="/biblioteca">
          Abrir a Biblioteca LGA <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </Button>
    </Card>
  );
}

/** "Aprende de forma acessível": a Biblioteca LGA em destaque e a acessibilidade à mão. */
export function AprendeAcessivel() {
  return (
    <section aria-labelledby="acessivel" className="space-y-3">
      <h2 id="acessivel" className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">
        Aprende de forma acessível
      </h2>
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <BibliotecaDestaque />
        <AcessibilidadeRapida />
      </div>
    </section>
  );
}

type ComMotivo<T> = T & { motivo: string };

/** "Recomendados para ti": o que a pessoa já aprende e quem segue; diz sempre porquê. */
export function Recomendados({ cursos, videos }: { cursos: ComMotivo<Course>[]; videos: ComMotivo<Video>[] }) {
  if (cursos.length === 0 && videos.length === 0) return null;
  return (
    <section aria-labelledby="recomendados" className="space-y-6">
      <h2 id="recomendados" className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">
        Recomendados para ti
      </h2>
      {cursos.length > 0 && (
        <div>
          <SectionHeader title="Cursos" href="/cursos" cta="Ver todos os cursos" />
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
            {cursos.map((c) => (
              <div key={c.id}>
                <CourseCard course={c} />
                <Motivo texto={c.motivo} />
              </div>
            ))}
          </div>
        </div>
      )}
      {videos.length > 0 && (
        <div>
          <SectionHeader title="Vídeos" href="/videos" cta="Ver todos os vídeos" />
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
            {videos.map((v) => (
              <div key={v.id}>
                <VideoCard video={v} />
                <Motivo texto={v.motivo} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
