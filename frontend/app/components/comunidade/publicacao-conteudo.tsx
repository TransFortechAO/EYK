"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Clock, PlayCircle, Sparkles, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BotaoSalvar } from "@/components/ds/botao-salvar";
import { tempoRelativo, type Course, type Video } from "@/lib/api";

const iniciais = (nome: string) => {
  const p = nome.trim().split(/\s+/);
  return (p.length > 1 ? p[0][0] + p[p.length - 1][0] : nome.slice(0, 2)).toUpperCase();
};

/**
 * Um curso ou um vídeo no feed do Início, com a forma de uma publicação (vertical, uma
 * coluna): quem o fez, porque aparece, a capa e o botão para o abrir.
 */
export function PublicacaoConteudo(
  props: ({ tipo: "curso"; conteudo: Course } | { tipo: "video"; conteudo: Video }) & { motivo?: string },
) {
  const { tipo, conteudo: c, motivo } = props;
  const curso = tipo === "curso" ? (props.conteudo as Course) : null;
  const video = tipo === "video" ? (props.conteudo as Video) : null;
  const href = curso ? `/cursos/${c.id}` : `/videos/${c.id}`;
  const Icone = curso ? BookOpen : PlayCircle;
  const publicadoHa = tempoRelativo(c.publishedAt);

  return (
    <Card className="space-y-4 p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          {c.teacherFoto && <AvatarImage src={c.teacherFoto} alt="" className="object-cover" />}
          <AvatarFallback className="bg-gradient-gold text-sm font-semibold uppercase text-primary-foreground">{iniciais(c.teacher)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{c.teacher}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" aria-hidden />
            {curso ? "Curso" : "Vídeo"}
            {motivo ? ` · ${motivo}` : ""}
            {publicadoHa ? ` · ${publicadoHa}` : ""}
          </p>
        </div>
        <BotaoSalvar tipo={tipo} id={c.id} variante="acao" className="shrink-0" />
      </div>

      <Link href={href} className="group block space-y-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <p className="font-serif text-lg font-semibold leading-snug group-hover:underline underline-offset-2">{c.title}</p>
        <div className="relative grid aspect-video place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-primary/20 to-surface" style={{ background: c.thumbnail }}>
          <span className="grid h-14 w-14 place-items-center rounded-full bg-background/85 text-primary shadow-elevated backdrop-blur transition-transform group-hover:scale-105">
            <Icone className="h-7 w-7" aria-hidden />
          </span>
        </div>
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {curso && (
            <>
              <span>{curso.category}</span>
              <span className="inline-flex items-center gap-1">
                <PlayCircle className="h-3.5 w-3.5" aria-hidden /> {curso.lessons} aulas
              </span>
              {curso.rating != null && (
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden /> {curso.rating.toFixed(1)}
                </span>
              )}
            </>
          )}
          {video && (
            <>
              {video.duration && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" aria-hidden /> {video.duration}
                </span>
              )}
              <span>{video.views} visualizaç{video.views === 1 ? "ão" : "ões"}</span>
            </>
          )}
        </p>
        <Button asChild size="sm" className="gap-1.5 rounded-full">
          <Link href={href}>
            {curso ? "Ver curso" : "Ver vídeo"} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
