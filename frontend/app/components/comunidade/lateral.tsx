"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, PlayCircle, Sparkles, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, type Course, type ProfessorSugerido, type Video } from "@/lib/api";

/**
 * Coluna lateral do Início (computador), como nas redes sociais: os cursos e vídeos em
 * destaque e pessoas para seguir. Cada bloco some se não tiver nada para mostrar.
 */

function Miniatura({ fundo, video }: { fundo: string; video?: boolean }) {
  return (
    <div className="relative grid aspect-video w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-secondary" style={{ background: fundo }} aria-hidden>
      {video && <PlayCircle className="h-5 w-5 text-white drop-shadow" />}
    </div>
  );
}

/** Curso e vídeo em destaque, dentro do cartão "Em destaque". */
export function DestaquesCatalogo({ curso, video }: { curso: Course | null; video: Video | null }) {
  if (!curso && !video) return null;
  return (
    <ul className="space-y-2">
      {curso && (
        <li>
          <Link href={`/cursos/${curso.id}`} className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface">
            <Miniatura fundo={curso.thumbnail} />
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-primary">Curso</p>
              <p className="line-clamp-2 text-sm font-medium">{curso.title}</p>
              <p className="text-xs text-muted-foreground">
                {curso.students} aluno{curso.students === 1 ? "" : "s"}
              </p>
            </div>
          </Link>
        </li>
      )}
      {video && (
        <li>
          <Link href={`/videos/${video.id}`} className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface">
            <Miniatura fundo={video.thumbnail} video />
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-primary">Vídeo</p>
              <p className="line-clamp-2 text-sm font-medium">{video.title}</p>
              <p className="text-xs text-muted-foreground">
                {video.views} visualizaç{video.views === 1 ? "ão" : "ões"}
              </p>
            </div>
          </Link>
        </li>
      )}
    </ul>
  );
}

function ProfessoresParaSeguir() {
  const [lista, setLista] = useState<ProfessorSugerido[]>([]);
  const [seguindo, setSeguindo] = useState<Set<number>>(new Set());

  useEffect(() => {
    void api.professoresSugeridos().then(setLista).catch(() => setLista([]));
  }, []);

  const seguir = async (p: ProfessorSugerido) => {
    try {
      const r = await api.seguirProfessor(p.professorId);
      setSeguindo((atual) => {
        const novo = new Set(atual);
        if (r.seguindo) novo.add(p.professorId);
        else novo.delete(p.professorId);
        return novo;
      });
    } catch {
      toast.error("Não foi possível seguir agora.");
    }
  };

  if (lista.length === 0) return null;
  return (
    <Card className="space-y-3 p-4 shadow-soft">
      <h2 className="flex items-center gap-2 font-serif text-lg font-semibold">
        <Sparkles className="h-4 w-4 text-primary" /> Professores para seguir
      </h2>
      <ul className="space-y-3">
        {lista.map((p) => {
          const sigo = seguindo.has(p.professorId);
          return (
            <li key={p.professorId} className="flex items-center gap-3">
              <Link href={`/perfil/${p.userId}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar className="h-10 w-10 shrink-0">
                  {p.foto && <AvatarImage src={p.foto} alt="" className="object-cover" />}
                  <AvatarFallback className="bg-gradient-gold text-sm font-semibold uppercase text-primary-foreground">{p.iniciais}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium hover:underline">{p.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.area || `${p.cursos} curso${p.cursos === 1 ? "" : "s"}`} · {p.seguidores} seguidor{p.seguidores === 1 ? "" : "es"}
                  </p>
                </div>
              </Link>
              <Button
                size="sm"
                variant={sigo ? "outline" : "default"}
                className="h-8 shrink-0 gap-1 rounded-full px-3"
                onClick={() => void seguir(p)}
                aria-pressed={sigo}
              >
                {sigo ? <Check className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                {sigo ? "A seguir" : "Seguir"}
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function LateralInicio() {
  return (
    <>
      <ProfessoresParaSeguir />
    </>
  );
}
