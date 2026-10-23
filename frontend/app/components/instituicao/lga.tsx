"use client";

import { useRef, useState, type ReactNode } from "react";
import { Camera, CheckCircle2, Clock, Film, RotateCcw, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LgaSign } from "@/components/lga-sign";
import { Etiqueta, tamanho } from "@/components/instituicao/ui";
import { duracao } from "@/lib/instituicoes/lga";
import { guardarVideoSessao, urlVideoSessao } from "@/lib/instituicoes/media-sessao";
import { ROTULO_TEMA } from "@/lib/instituicoes/permissoes";
import type { EstadoResposta, Gesto, VideoAnexo } from "@/lib/instituicoes/tipos";
import { cn } from "@/lib/utils";

/**
 * Vídeo de uma aula, resposta ou gesto. Se o ficheiro foi carregado nesta
 * visita, toca-o; senão (dados de demonstração) mostra o gesto animado e os
 * dados do vídeo.
 */
export function VideoLga({
  video,
  glyph = "🤟",
  motion = "wave",
  titulo,
  className,
}: {
  video: VideoAnexo | null;
  glyph?: string;
  motion?: Gesto["motion"];
  titulo: string;
  className?: string;
}) {
  const url = urlVideoSessao(video);
  const [play, setPlay] = useState(false);
  if (url) {
    return (
      <video src={url} controls playsInline className={cn("aspect-video w-full rounded-xl bg-black object-contain", className)} aria-label={titulo} />
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setPlay(true);
        setTimeout(() => setPlay(false), 1400);
      }}
      className={cn(
        "relative grid aspect-video w-full place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-surface to-primary/10 text-left",
        className,
      )}
      aria-label={`${titulo} — tocar para ver o gesto`}
    >
      <LgaSign glyph={glyph} motion={motion} play={play} className="text-7xl sm:text-8xl" label={titulo} />
      {video && (
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-xs backdrop-blur">
          <Film className="h-3.5 w-3.5" aria-hidden /> {video.nome} · {duracao(video.duracaoSeg)}
        </span>
      )}
      <span className="absolute right-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur">
        {video ? "Vídeo de demonstração" : "Sem vídeo"}
      </span>
    </button>
  );
}

export function CartaoGesto({ gesto, compacto, children }: { gesto: Gesto; compacto?: boolean; children?: ReactNode }) {
  const [play, setPlay] = useState(false);
  const url = urlVideoSessao(gesto.video);
  return (
    <Card className="overflow-hidden shadow-soft">
      {url ? (
        <video src={url} controls playsInline className="aspect-square w-full bg-black object-contain" aria-label={gesto.palavra} />
      ) : (
        <button
          type="button"
          onClick={() => {
            setPlay(true);
            setTimeout(() => setPlay(false), 1200);
          }}
          className={cn("grid w-full place-items-center bg-gradient-to-br from-surface to-primary/5", compacto ? "aspect-[4/3]" : "aspect-square")}
          aria-label={`Ver o gesto de ${gesto.palavra}`}
        >
          <LgaSign glyph={gesto.glyph} motion={gesto.motion} play={play} className={compacto ? "text-5xl" : "text-6xl sm:text-7xl"} label={gesto.palavra} />
        </button>
      )}
      <div className="space-y-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium leading-tight">{gesto.palavra}</p>
          {gesto.variante !== "Comum" && <Etiqueta tom="marca">{gesto.variante}</Etiqueta>}
        </div>
        <p className="text-xs text-muted-foreground">{ROTULO_TEMA[gesto.tema]}</p>
        {!compacto && gesto.descricao && <p className="text-xs">{gesto.descricao}</p>}
        {children}
      </div>
    </Card>
  );
}

/**
 * Escolher ou gravar um vídeo. Com `captura`, no telemóvel abre logo a câmara
 * (frontal para as respostas dos alunos).
 */
export function CarregarVideo({
  id,
  valor,
  onChange,
  captura,
  rotulo = "Escolher vídeo",
}: {
  id: string;
  valor: VideoAnexo | null;
  onChange: (v: VideoAnexo | null) => void;
  captura?: "user" | "environment";
  rotulo?: string;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [aLer, setALer] = useState(false);
  const url = urlVideoSessao(valor);

  return (
    <div className="space-y-2">
      <input
        ref={entrada}
        id={id}
        type="file"
        accept="video/*"
        {...(captura ? { capture: captura } : {})}
        className="sr-only"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setALer(true);
          try {
            onChange(await guardarVideoSessao(f));
          } finally {
            setALer(false);
          }
        }}
      />
      {valor ? (
        <div className="space-y-2">
          {url && <video src={url} controls playsInline className="aspect-video w-full rounded-lg bg-black object-contain" />}
          <div className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2 text-xs">
            <span className="truncate">
              {valor.nome} · {tamanho(valor.tamanhoBytes)} · {duracao(valor.duracaoSeg)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={() => {
                onChange(null);
                if (entrada.current) entrada.current.value = "";
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Trocar
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" className="w-full gap-2" disabled={aLer} onClick={() => entrada.current?.click()}>
          {captura ? <Camera className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
          {aLer ? "A preparar…" : rotulo}
        </Button>
      )}
    </div>
  );
}

export function EtiquetaResposta({ estado }: { estado: EstadoResposta }) {
  if (estado === "correto")
    return (
      <Etiqueta tom="sucesso">
        <CheckCircle2 className="h-3 w-3" aria-hidden /> Correto
      </Etiqueta>
    );
  if (estado === "repetir")
    return (
      <Etiqueta tom="aviso">
        <RotateCcw className="h-3 w-3" aria-hidden /> Repetir
      </Etiqueta>
    );
  return (
    <Etiqueta>
      <Clock className="h-3 w-3" aria-hidden /> Por rever
    </Etiqueta>
  );
}

/** Escolher gestos do gestuário (validados), com pesquisa e filtro por tema. */
export function EscolherGestos({
  gestos,
  valor,
  onChange,
  multiplo = true,
}: {
  gestos: Gesto[];
  valor: string[];
  onChange: (ids: string[]) => void;
  multiplo?: boolean;
}) {
  const [pesquisa, setPesquisa] = useState("");
  const [tema, setTema] = useState("");
  const termo = pesquisa.trim().toLowerCase();
  const lista = gestos
    .filter((g) => g.estado === "validado" && (!tema || g.tema === tema) && (!termo || g.palavra.toLowerCase().includes(termo)))
    .slice(0, 60);
  const alternar = (id: string) => {
    if (!multiplo) onChange(valor[0] === id ? [] : [id]);
    else onChange(valor.includes(id) ? valor.filter((x) => x !== id) : [...valor, id]);
  };
  const escolhidos = valor.map((id) => gestos.find((g) => g.id === id)).filter((g): g is Gesto => !!g);

  return (
    <div className="space-y-2">
      {escolhidos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {escolhidos.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => alternar(g.id)}
              className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs text-primary hover:bg-primary/25"
              aria-label={`Retirar ${g.palavra}`}
            >
              <span aria-hidden>{g.glyph}</span> {g.palavra} ×
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          aria-label="Pesquisar gestos"
          placeholder="Pesquisar gesto"
          value={pesquisa}
          onChange={(e) => setPesquisa(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring pointer-coarse:min-h-11"
        />
        <select
          aria-label="Tema"
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          className="h-9 rounded-md border border-input bg-card px-2 text-sm shadow-sm pointer-coarse:min-h-11"
        >
          <option value="">Todos</option>
          {(Object.keys(ROTULO_TEMA) as Gesto["tema"][]).map((t) => (
            <option key={t} value={t}>
              {ROTULO_TEMA[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid max-h-44 grid-cols-3 gap-1.5 overflow-y-auto rounded-md border border-border p-1.5 sm:grid-cols-4">
        {lista.map((g) => {
          const ativo = valor.includes(g.id);
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => alternar(g.id)}
              aria-pressed={ativo}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-md p-1.5 text-center text-[11px] leading-tight transition-colors",
                ativo ? "bg-primary text-primary-foreground" : "hover:bg-surface",
              )}
            >
              <span className="text-xl" aria-hidden>
                {g.glyph}
              </span>
              <span className="line-clamp-2">{g.palavra}</span>
            </button>
          );
        })}
        {lista.length === 0 && <p className="col-span-full py-4 text-center text-xs text-muted-foreground">Nenhum gesto.</p>}
      </div>
    </div>
  );
}

/** Barra de mestria (0–100) de uma competência. */
export function BarraMestria({ valor, rotulo, className }: { valor: number; rotulo: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-secondary"
        role="meter"
        aria-label={rotulo}
        aria-valuenow={valor}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn("h-full rounded-full", valor >= 80 ? "bg-success" : valor >= 50 ? "bg-primary" : "bg-amber-500")}
          style={{ width: `${valor}%` }}
        />
      </div>
      <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{valor}%</span>
    </div>
  );
}
