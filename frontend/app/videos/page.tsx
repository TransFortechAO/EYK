"use client";

import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { PageHeader, VideoCard, EmptyState } from "@/components/eyk";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockVideos } from "@/lib/mock-data";

export default function VideosPage() {
  const [tab, setTab] = useState("recent");
  const videos = tab === "popular"
    ? [...mockVideos].sort((a, b) => b.views - a.views)
    : tab === "short"
    ? mockVideos.filter((v) => parseInt(v.duration.split(":")[0]) < 6)
    : mockVideos;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Vídeos"
        description="Conteúdos avulsos de todos os professores da plataforma."
      />

      <Tabs value={tab} onValueChange={setTab}>
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
    </div>
  );
}