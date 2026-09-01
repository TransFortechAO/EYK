"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Heart, ThumbsDown, Eye } from "lucide-react";
import { PageHeader } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { api, type VideoEngajamento } from "@/lib/api";

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

      <div className="grid gap-4 sm:grid-cols-3">
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
      </div>

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
