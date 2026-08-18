"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Heart, Eye, Calendar, Maximize2 } from "lucide-react";
import { MediaPlayer, ShareButton } from "@/components/eyk";
import { VideoComments } from "@/components/eyk/video-comments";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { api, type VideoDetail, type Video } from "@/lib/api";

function formatarData(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

export default function VideoPlayerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [outrosVideos, setOutrosVideos] = useState<Video[]>([]);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [reagindo, setReagindo] = useState(false);
  const playerWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const [dados, todos] = await Promise.all([api.getVideo(params.id), api.getVideos("recent")]);
      if (!alive) return;
      setVideo(dados);
      setLikes(dados?.likes ?? 0);
      setOutrosVideos(todos.filter((v) => v.id !== params.id).slice(0, 8));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [params.id]);

  const alternarGosto = async () => {
    if (!video || reagindo) return;
    setReagindo(true);
    try {
      const res = await api.reagirVideo(video.id, "like");
      setLikes(res.likes);
      setLiked((prev) => !prev);
    } finally {
      setReagindo(false);
    }
  };

  const entrarEmFullscreen = () => {
    playerWrapRef.current?.requestFullscreen?.();
  };

  if (loading) {
    return <div className="py-24 text-center text-muted-foreground">A carregar vídeo…</div>;
  }

  if (!video) {
    return (
      <div className="py-24 text-center">
        <p className="text-muted-foreground">Vídeo não encontrado.</p>
        <Button variant="outline" className="mt-4 gap-1.5" onClick={() => router.push("/videos")}>
          <ArrowLeft className="h-4 w-4" /> Voltar aos vídeos
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2 gap-1.5" onClick={() => router.push("/videos")}>
        <ArrowLeft className="h-4 w-4" /> Vídeos
      </Button>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        {/* Coluna principal: player + info */}
        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden rounded-3xl border-border/70 shadow-elevated">
            <div ref={playerWrapRef} className="relative">
              <MediaPlayer
                fileUrl={video.fileUrl}
                externalUrl={video.externalUrl}
                title={video.title}
                cover={video.cover}
                videoId={video.id}
              />
              <button
                type="button"
                onClick={entrarEmFullscreen}
                aria-label="Ecrã inteiro"
                className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
          </Card>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground sm:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" /> {video.views.toLocaleString()} visualizações
            </span>
            {video.createdAt && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> {formatarData(video.createdAt)}
              </span>
            )}
          </div>

          <div className="flex items-start justify-between gap-3">
            <h1 className="font-serif text-2xl font-semibold leading-snug sm:text-3xl">{video.title}</h1>
            <ShareButton url={`/videos/${video.id}`} titulo={video.title} />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-surface/40 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="h-11 w-11">
                <AvatarFallback className="bg-secondary">{video.teacherAvatar}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{video.teacher}</p>
                <p className="text-xs text-muted-foreground">Professor EYK</p>
              </div>
            </div>
            <Button
              variant={liked ? "default" : "outline"}
              size="sm"
              className={cn("shrink-0 gap-2", liked && "bg-gradient-gold text-primary-foreground hover:opacity-95")}
              onClick={() => void alternarGosto()}
              disabled={reagindo}
            >
              <Heart className={cn("h-4 w-4", liked && "fill-current")} />
              {likes}
            </Button>
          </div>

          {video.description && (
            <Card className="rounded-2xl border-border/70 p-4 shadow-soft sm:p-5">
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {video.description}
              </p>
            </Card>
          )}

          <VideoComments videoId={video.id} />
        </div>

        {/* Sidebar: mais vídeos */}
        {outrosVideos.length > 0 && (
          <div className="space-y-4 lg:sticky lg:top-24">
            <Card className="rounded-2xl border-border/70 p-2 shadow-soft">
              <p className="px-2.5 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Mais vídeos
              </p>
              <div className="space-y-1">
                {outrosVideos.map((v) => (
                  <Link
                    key={v.id}
                    href={`/videos/${v.id}`}
                    className="flex items-center gap-2.5 rounded-xl px-2 py-2 transition hover:bg-surface/60"
                  >
                    <div
                      className="h-12 w-20 shrink-0 rounded-lg"
                      style={{ background: v.cover }}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-medium leading-snug">{v.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{v.teacher}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
