"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api, type Video } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface RelatedVideosProps {
  /** Vídeo atual sendo reproduzido (com campos normalizados) */
  currentVideo: {
    id: string | number;
    title: string;
    teacher: string;
    professorId?: number | null; // para recomendação mais precisa
  };
  /** Lista de todos os vídeos (opcional – se não fornecido, busca internamente) */
  allVideos?: Video[];
  /** Número máximo de sugestões (padrão: 6) */
  limit?: number;
  /** Classe CSS adicional */
  className?: string;
  /**
   * Chamado sempre que a lista de recomendações calculada mudar. Permite ao componente
   * pai (ex: a página do vídeo) usar estes mesmos vídeos como fila de "seguinte" no player.
   */
  onRecommendationsChange?: (videos: Video[]) => void;
}

/** Calcula similaridade entre títulos (baseada em palavras em comum) */
function titleSimilarity(title1: string, title2: string): number {
  if (!title1 || !title2) return 0;
  const words1 = title1.toLowerCase().split(/\s+/);
  const words2 = title2.toLowerCase().split(/\s+/);
  const intersection = words1.filter(w => words2.includes(w));
  return intersection.length;
}

export function RelatedVideos({
  currentVideo,
  allVideos,
  limit = 6,
  className,
  onRecommendationsChange,
}: RelatedVideosProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Busca vídeos se não forem fornecidos
  useEffect(() => {
    let alive = true;

    const fetchAll = async () => {
      try {
        // Usa "recent" ou "all" – se sua API suportar "all", melhor
        const data = await api.getVideos("recent");
        if (alive) {
          setVideos(data);
          setLoading(false);
        }
      } catch {
        if (alive) {
          setError(true);
          setLoading(false);
        }
      }
    };

    if (allVideos) {
      setVideos(allVideos);
      setLoading(false);
    } else {
      fetchAll();
    }

    return () => { alive = false; };
  }, [allVideos]);

  // Calcula recomendações com base nos critérios
  const recommendations = useMemo(() => {
    if (videos.length === 0 || loading) return [];

    // Exclui o vídeo atual
    const others = videos.filter(v => v.id !== currentVideo.id);
    if (others.length === 0) return [];

    // Pontua cada vídeo
    const scored = others.map(v => {
      let score = 0;

      // Critério 1: mesmo professor (peso alto)
      if (v.teacher && currentVideo.teacher && v.teacher === currentVideo.teacher) {
        score += 10;
      }

      // Critério 2: similaridade no título (palavras em comum)
      const similarity = titleSimilarity(currentVideo.title, v.title || "");
      if (similarity > 0) {
        score += similarity * 2;
      }

      return { ...v, score };
    });

    // Ordena por score decrescente
    scored.sort((a, b) => b.score - a.score);

    // Pega os com maior score
    const top = scored.slice(0, limit);

    // Se não houver suficientes com score > 0, completa com aleatórios
    if (top.length < limit) {
      const remaining = scored.filter(v => !top.includes(v));
      // Embaralha
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      const fill = remaining.slice(0, limit - top.length);
      return [...top, ...fill];
    }

    return top;
  }, [videos, currentVideo, limit, loading]);

  // Avisa o pai sobre a lista calculada, só quando os vídeos (por id) realmente mudam,
  // para evitar um loop de re-renderizações caso o pai passe um objeto novo a cada render.
  const lastSentIdsRef = useRef<string>("");
  useEffect(() => {
    if (!onRecommendationsChange) return;
    const idsKey = recommendations.map((v) => v.id).join(",");
    if (idsKey === lastSentIdsRef.current) return;
    lastSentIdsRef.current = idsKey;
    onRecommendationsChange(recommendations);
  }, [recommendations, onRecommendationsChange]);

  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-16 w-28 rounded-lg" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error || recommendations.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Recomendações</p>
        <p className="text-xs">Nenhuma sugestão disponível no momento.</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Você ja viu ?
      </h3>
      <div className="space-y-2">
        {recommendations.map((video) => (
          <Link
            key={video.id}
            href={`/videos/${video.id}`}
            className="group flex items-start gap-3 p-2 rounded-xl transition-all duration-200 hover:bg-muted/50 hover:scale-[1.02]"
          >
            <div
              className="h-16 w-28 shrink-0 rounded-lg bg-cover bg-center shadow-sm transition-transform duration-200 group-hover:shadow-md"
              style={{
                background: video.thumbnail
                  ? video.thumbnail
                  : 'linear-gradient(135deg, #4A90D9, #6C5B7B)'
              }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary transition-colors">
                {video.title}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground truncate">
                  {video.teacher || "Professor"}
                </span>
                <span className="text-[10px] text-muted-foreground/60">
                  • {(video.views || 0).toLocaleString()} views
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}