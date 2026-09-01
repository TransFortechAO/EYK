"use client";
//Video Player Page
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Heart, Eye, Calendar } from "lucide-react";
import { ShareButton } from "@/components/eyk";
import { VideoComments } from "@/components/eyk/video-comments";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { api, type VideoDetail, type Video } from "@/lib/api";
import { ModernVideoPlayer } from "@/components/ModernVideoPlayer";
import { RelatedVideos } from "@/components/eyk/related-content";
import { UserAvatar } from "@/components/UserAvatar";

/**
 * Guarda, na sessão do browser, um pequeno "histórico de navegação" entre vídeos.
 * Serve só para saber se o botão "anterior" deve ficar habilitado: ele só liga depois
 * de teres clicado em "seguinte" pelo menos uma vez a partir do vídeo atual.
 */
const NAV_STACK_KEY = "eyk:video-nav-stack";

interface VideoNavStack {
  /** ids dos vídeos que ficam "para trás" do vídeo atual, do mais antigo ao mais recente */
  history: string[];
  /** id do vídeo atualmente aberto quando esta pilha foi guardada */
  current: string;
}

function readNavStack(): VideoNavStack | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(NAV_STACK_KEY);
    return raw ? (JSON.parse(raw) as VideoNavStack) : null;
  } catch {
    return null;
  }
}

function writeNavStack(stack: VideoNavStack) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(stack));
  } catch {
    // Sem sessionStorage disponível: a navegação seguinte/anterior continua a funcionar,
    // só que o "anterior" não persiste entre trocas de página.
  }
}

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
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [reagindo, setReagindo] = useState(false);
  const playerWrapRef = useRef<HTMLDivElement>(null);

  // Vídeos relacionados (calculados pelo <RelatedVideos />) que servem de fila para "seguinte".
  const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
  // Histórico de vídeos visitados nesta "sessão de navegação", para o botão "anterior".
  const [watchHistory, setWatchHistory] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const dados = await api.getVideo(params.id);
      if (!alive) return;
      setVideo(dados);
      setLikes(dados?.likes ?? 0);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [params.id]);

  // Sincroniza o histórico de navegação com este vídeo: se chegámos aqui através do
  // botão seguinte/anterior, a pilha guardada em sessionStorage já reflete isso. Caso
  // contrário (link direto, lista de vídeos, refresh), começamos um histórico novo.
  useEffect(() => {
    const stack = readNavStack();
    if (stack && stack.current === params.id) {
      setWatchHistory(stack.history);
    } else {
      writeNavStack({ history: [], current: params.id });
      setWatchHistory([]);
    }
  }, [params.id]);

  const handleRecommendationsChange = useCallback((videos: Video[]) => {
    setRelatedVideos(videos);
  }, []);

  const goToNextVideo = useCallback(() => {
    const nextVideo = relatedVideos[0];
    if (!nextVideo) return;
    const nextId = String(nextVideo.id);
    writeNavStack({ history: [...watchHistory, params.id], current: nextId });
    router.push(`/videos/${nextId}`);
  }, [relatedVideos, watchHistory, params.id, router]);

  const goToPreviousVideo = useCallback(() => {
    if (watchHistory.length === 0) return;
    const previousId = watchHistory[watchHistory.length - 1];
    writeNavStack({ history: watchHistory.slice(0, -1), current: previousId });
    router.push(`/videos/${previousId}`);
  }, [watchHistory, router]);

  // Referência estável para o <RelatedVideos />, para não recalcular recomendações
  // a cada render só porque criámos um objeto literal novo.
  const relatedCurrentVideo = useMemo(
    () => ({
      id: video?.id ?? "",
      title: video?.title ?? "",
      teacher: video?.teacher ?? "",
      professorId: video?.professorId,
    }),
    [video?.id, video?.title, video?.teacher, video?.professorId]
  );

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
          <Card className="overflow-hidden rounded-3xl border-0 shadow-xl shadow-black/5 bg-black/5 backdrop-blur-sm">
            <div ref={playerWrapRef} className="relative aspect-video">
              <ModernVideoPlayer
                fileUrl={video.fileUrl}
                externalUrl={video.externalUrl}
                title={video.title}
                thumbnail={video.thumbnail || undefined}
                videoId={video.id}
                hasNext={relatedVideos.length > 0}
                hasPrevious={watchHistory.length > 0}
                onNext={goToNextVideo}
                onPrevious={goToPreviousVideo}
              />
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
                <UserAvatar noLink name={video.teacher} userId={video.teacherUserId ?? undefined} />
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

        {/* Sidebar: vídeos relacionados */}
        <aside className="space-y-4 lg:sticky lg:top-24">
          <Card className="rounded-2xl border-border/70 p-3 shadow-soft">
            <RelatedVideos
              currentVideo={relatedCurrentVideo}
              limit={6}
              onRecommendationsChange={handleRecommendationsChange}
            />
          </Card>
        </aside>
      </div>
    </div>
  );
}