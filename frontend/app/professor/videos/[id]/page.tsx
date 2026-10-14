"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Heart, ThumbsDown, Eye, Users, MessageCircle, Percent, Film } from "lucide-react";
import { PageHeader } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { api, formatarDuracaoCurta, type VideoEngajamento } from "@/lib/api";

export default function VideoEngajamentoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [dados, setDados] = useState<VideoEngajamento | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = Number(params.id);
    if (!id) return;
    api.professor
      .getVideoEngajamento(id)
      .then(setDados)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return <div className="py-20 text-center text-muted-foreground">A carregar…</div>;
  }

  if (!dados) {
    return <div className="py-20 text-center text-muted-foreground">Vídeo não encontrado.</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 mb-2" onClick={() => router.push("/professor/videos")}>
          <ArrowLeft className="h-4 w-4" /> Meus Vídeos
        </Button>
        <PageHeader title={dados.video.titulo} description="Engajamento e reações ao vídeo." />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500/15 text-rose-300">
              <Heart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Gostos</p>
              <p className="text-2xl font-serif font-semibold">{dados.totalLikes}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-500/15 text-slate-300">
              <ThumbsDown className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Não gostos</p>
              <p className="text-2xl font-serif font-semibold">{dados.totalDislikes}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-500/15 text-sky-300">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Visualizações</p>
              <p className="text-2xl font-serif font-semibold">{dados.totalVisualizacoes}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15 text-amber-300">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Visualizadores únicos</p>
              <p className="text-2xl font-serif font-semibold">{dados.totalVisualizadoresUnicos}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Comentários</p>
              <p className="text-2xl font-serif font-semibold">{dados.totalComentarios}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
              <Percent className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Taxa de aprovação</p>
              <p className="text-2xl font-serif font-semibold">
                {dados.taxaAprovacao === null ? "—" : `${dados.taxaAprovacao}%`}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {dados.cursoId && dados.outrasAulasDoCurso.length > 0 && (
        <Card className="p-5 shadow-soft">
          <p className="font-serif text-lg font-semibold mb-1">Outras aulas deste curso</p>
          <p className="text-xs text-muted-foreground mb-4">
            Esta aula faz parte de um curso — compara o engajamento com as restantes.
          </p>
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="text-left font-medium py-2 pr-4">Aula</th>
                  <th className="text-left font-medium py-2 pr-4">Duração</th>
                  <th className="text-left font-medium py-2 pr-4">Visualizações</th>
                  <th className="text-left font-medium py-2 pr-4">Gostos</th>
                  <th className="text-left font-medium py-2">Comentários</th>
                </tr>
              </thead>
              <tbody>
                {dados.outrasAulasDoCurso.map((aula) => (
                  <tr key={aula.id}>
                    <td className="py-2 pr-4 bg-surface/40 rounded-l-xl">
                      <Link
                        href={`/professor/videos/${aula.id}`}
                        className="flex items-center gap-1.5 hover:text-primary hover:underline underline-offset-2"
                      >
                        <Film className="h-3.5 w-3.5 shrink-0" />
                        {aula.titulo}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 bg-surface/40 text-muted-foreground tabular-nums">
                      {formatarDuracaoCurta(aula.duracaoSegundos) || "—"}
                    </td>
                    <td className="py-2 pr-4 bg-surface/40 tabular-nums">{aula.totalVisualizacoes}</td>
                    <td className="py-2 pr-4 bg-surface/40 tabular-nums">{aula.totalLikes}</td>
                    <td className="py-2 bg-surface/40 rounded-r-xl tabular-nums">{aula.totalComentarios}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="p-5 shadow-soft">
        <p className="font-serif text-lg font-semibold mb-4">Reações</p>
        {dados.reacoes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Ainda não há reações a este vídeo.</p>
        ) : (
          <div className="space-y-2">
            {dados.reacoes.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl bg-surface/40 px-3 py-2">
                <Avatar className="h-8 w-8">
                  <UserAvatar noLink name={r.utilizador_nome} userId={r.utilizador} size={32} />
                </Avatar>
                <span className="text-sm">@{r.utilizador_nome}</span>
                <Badge variant="outline" className="ml-auto text-xs capitalize">{r.tipo}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
