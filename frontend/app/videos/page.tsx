"use client";

import { useEffect, useState } from "react";
import { PlayCircle } from "lucide-react";
import { PageHeader, VideoCard, EmptyState } from "@/components/eyk";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, type Video } from "@/lib/api";
import { ConteudosComEscola } from "@/components/instituicao/escola";

type Tab = "recent" | "popular" | "short";

export default function VideosPage() {
  const [tab, setTab] = useState<Tab>("recent");
  const [videos, setVideos] = useState<Video[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await api.getVideos(tab);
      if (alive) setVideos(list);
    })();
    return () => { alive = false; };
  }, [tab]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Vídeos"
        description="Conteúdos avulsos de todos os professores da plataforma."
      />

      {/* Com escola parceira: "Da minha escola" ao lado do catálogo público. */}
      <ConteudosComEscola tipo="video">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="bg-surface">
            <TabsTrigger value="recent">Mais recentes</TabsTrigger>
            <TabsTrigger value="popular">Mais vistos</TabsTrigger>
            <TabsTrigger value="short">Curtos (&lt; 6 min)</TabsTrigger>
          </TabsList>
        </Tabs>

        {videos.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        ) : (
          <EmptyState icon={PlayCircle} title="Nenhum vídeo disponível." />
        )}
      </ConteudosComEscola>
    </div>
  );
}
