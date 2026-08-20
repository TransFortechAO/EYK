"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  LoaderCircle,
  SkipBack,
  SkipForward,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoSource {
  fileUrl?: string | null;
  externalUrl?: string;
  title?: string;
  thumbnail?: string;
}

// Referência estável: usar `suggestions = []` como valor por omissão criaria um array
// novo a cada render, o que faria o useEffect abaixo (que depende de `suggestions`)
// disparar infinitamente. Esta constante garante a mesma referência sempre que a prop
// não for passada.
const EMPTY_SUGGESTIONS: VideoSource[] = [];

interface ModernVideoPlayerProps extends VideoSource {
  className?: string;
  autoPlay?: boolean;
  /**
   * Fila de vídeos sugeridos para o modo NÃO controlado: o botão "seguinte" troca
   * o vídeo internamente (sem o pai intervir), consumindo o primeiro item da lista.
   * Ignorado quando `onNext`/`onPrevious` são fornecidos (modo controlado).
   */
  suggestions?: VideoSource[];
  /** Chamado sempre que o vídeo atual muda internamente (apenas no modo não controlado). */
  onVideoChange?: (video: VideoSource, direction: "next" | "previous") => void;
  /**
   * Modo controlado: quando `onNext` e/ou `onPrevious` são passados, o player deixa de
   * gerir a fila internamente e delega a troca de vídeo ao componente pai — útil quando
   * "seguinte"/"anterior" significa navegar para outra página (ex: outro vídeo com a sua
   * própria URL, likes e comentários). Nesse caso, `hasNext`/`hasPrevious` controlam se os
   * botões ficam habilitados.
   */
  hasNext?: boolean;
  hasPrevious?: boolean;
  onNext?: () => void;
  onPrevious?: () => void;
}

export function ModernVideoPlayer({
  fileUrl,
  externalUrl,
  title,
  thumbnail,
  className,
  autoPlay = true,
  suggestions = EMPTY_SUGGESTIONS,
  onVideoChange,
  hasNext,
  hasPrevious,
  onNext,
  onPrevious,
}: ModernVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  // --- Vídeo atual e navegação (seguinte / anterior) ---
  const [current, setCurrent] = useState<VideoSource>({ fileUrl, externalUrl, title, thumbnail });
  const [queue, setQueue] = useState<VideoSource[]>(suggestions);
  const [history, setHistory] = useState<VideoSource[]>([]);

  // Modo controlado: o pai (ex: a página do vídeo) decide o que "seguinte"/"anterior" significa.
  // Calculado a partir de props, não muda de valor a cada render.
  const isControlledNav = onNext !== undefined || onPrevious !== undefined;

  // Se o vídeo vier de fora (props mudaram por ação do pai), sincroniza e reinicia o histórico.
  useEffect(() => {
    setCurrent({ fileUrl, externalUrl, title, thumbnail });
    setHistory([]);
  }, [fileUrl, externalUrl]);

  // Mantém a fila de sugestões atualizada quando o pai enviar uma nova lista.
  // Só é relevante no modo NÃO controlado — no modo controlado a fila nem chega a ser usada.
  useEffect(() => {
    if (isControlledNav) return;
    setQueue(suggestions);
  }, [suggestions, isControlledNav]);

  const canGoNext = isControlledNav ? !!hasNext : queue.length > 0;
  const canGoPrevious = isControlledNav ? !!hasPrevious : history.length > 0;

  const goToNext = useCallback(() => {
    if (isControlledNav) {
      onNext?.();
      return;
    }
    setQueue((prevQueue: VideoSource[]) => {
      if (prevQueue.length === 0) return prevQueue;
      const [nextVideo, ...rest] = prevQueue;
      setHistory((prevHistory: VideoSource[]) => [...prevHistory, current]);
      setCurrent(nextVideo);
      onVideoChange?.(nextVideo, "next");
      return rest;
    });
  }, [current, onVideoChange, isControlledNav, onNext]);

  const goToPrevious = useCallback(() => {
    if (isControlledNav) {
      onPrevious?.();
      return;
    }
    setHistory((prevHistory: VideoSource[]) => {
      if (prevHistory.length === 0) return prevHistory;
      const previousVideo = prevHistory[prevHistory.length - 1];
      setQueue((prevQueue: VideoSource[]) => [current, ...prevQueue]);
      setCurrent(previousVideo);
      onVideoChange?.(previousVideo, "previous");
      return prevHistory.slice(0, -1);
    });
  }, [current, onVideoChange, isControlledNav, onPrevious]);

  // Reinicia o estado de reprodução sempre que o vídeo atual muda.
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setIsLoading(true);
    if (videoRef.current) {
      videoRef.current.load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.fileUrl, current.externalUrl]);

  // --- Controles ---
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    // O estado será atualizado pelos eventos 'play'/'pause'
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      if (val === 0) {
        videoRef.current.muted = true;
        setIsMuted(true);
      } else {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
    }
  };

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  const skip = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.currentTime + seconds, duration));
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !videoRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const newTime = x * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);

  // --- Event listeners do vídeo ---
  const onPlay = () => setIsPlaying(true);
  const onPause = () => setIsPlaying(false);
  const onTimeUpdate = () => {
    if (!videoRef.current || isDragging) return;
    setCurrentTime(videoRef.current.currentTime);
  };
  const onLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
    setIsLoading(false);
  };
  const onWaiting = () => setIsLoading(true);
  const onCanPlay = () => {
    setIsLoading(false);
    if (autoPlay && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };
  const onEnded = () => {
    setIsPlaying(false);
    // Ao terminar, avança automaticamente para o próximo vídeo sugerido, se houver.
    if (canGoNext) {
      goToNext();
    }
  };
  const onError = () => {
    setIsLoading(false);
    console.error("Erro no vídeo");
  };

  // --- Controles automáticos (esconder após inatividade) ---
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const container = containerRef.current;
    if (!container) return;

    const show = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 3000);
    };

    container.addEventListener("mousemove", show);
    container.addEventListener("mouseenter", show);
    container.addEventListener("touchstart", show);

    show();

    return () => {
      clearTimeout(timeout);
      container.removeEventListener("mousemove", show);
      container.removeEventListener("mouseenter", show);
      container.removeEventListener("touchstart", show);
    };
  }, []);

  // --- Fullscreen change ---
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // --- Atalhos de teclado ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return; // ignora inputs
      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          skip(+10);
          break;
        case "ArrowLeft":
          e.preventDefault();
          skip(-10);
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
        case "M":
          e.preventDefault();
          toggleMute();
          break;
        case "n":
        case "N":
          e.preventDefault();
          if (canGoNext) goToNext();
          break;
        case "p":
        case "P":
          e.preventDefault();
          if (canGoPrevious) goToPrevious();
          break;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, toggleFullscreen, toggleMute, canGoNext, canGoPrevious, goToNext, goToPrevious]);

  // --- Auto-play inicial (após carregar) ---
  useEffect(() => {
    if (videoRef.current && autoPlay && !isLoading) {
      videoRef.current.play().catch(() => {});
    }
  }, [autoPlay, isLoading]);

  // --- Formatação ---
  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Botões de navegação entre vídeos (reutilizados nos três estados: externo, indisponível e normal)
  const NavButtons = ({ variant = "default" }: { variant?: "default" | "compact" }) => (
    <div className={cn("flex items-center gap-2", variant === "compact" && "gap-1")}>
      <button
        onClick={goToPrevious}
        disabled={!canGoPrevious}
        className={cn(
          "p-1.5 rounded-full transition text-white",
          canGoPrevious ? "hover:bg-white/20" : "opacity-30 cursor-not-allowed"
        )}
        aria-label="Vídeo anterior"
        title="Vídeo anterior"
      >
        <ChevronsLeft className="h-5 w-5" />
      </button>
      <button
        onClick={goToNext}
        disabled={!canGoNext}
        className={cn(
          "p-1.5 rounded-full transition text-white",
          canGoNext ? "hover:bg-white/20" : "opacity-30 cursor-not-allowed"
        )}
        aria-label="Próximo vídeo"
        title="Próximo vídeo"
      >
        <ChevronsRight className="h-5 w-5" />
      </button>
    </div>
  );

  // --- Vídeo externo (YouTube/Vimeo) ---
  if (current.externalUrl) {
    return (
      <div ref={containerRef} className={cn("relative w-full aspect-video bg-black group", className)}>
        <iframe
          src={current.externalUrl}
          className="absolute inset-0 w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={current.title || "Vídeo externo"}
        />
        {(canGoNext || canGoPrevious) && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-1 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <NavButtons variant="compact" />
          </div>
        )}
      </div>
    );
  }

  if (!current.fileUrl) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 bg-black/10 aspect-video", className)}>
        <p className="text-muted-foreground text-sm">Vídeo indisponível</p>
        {(canGoNext || canGoPrevious) && (
          <div className="flex items-center gap-2 text-foreground">
            <button
              onClick={goToPrevious}
              disabled={!canGoPrevious}
              className={cn(
                "p-1.5 rounded-full border transition",
                canGoPrevious ? "hover:bg-black/10" : "opacity-30 cursor-not-allowed"
              )}
              aria-label="Vídeo anterior"
            >
              <ChevronsLeft className="h-5 w-5" />
            </button>
            <button
              onClick={goToNext}
              disabled={!canGoNext}
              className={cn(
                "p-1.5 rounded-full border transition",
                canGoNext ? "hover:bg-black/10" : "opacity-30 cursor-not-allowed"
              )}
              aria-label="Próximo vídeo"
            >
              <ChevronsRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full aspect-video bg-black group overflow-hidden", className)}
    >
      {/* Vídeo */}
      <video
        ref={videoRef}
        src={current.fileUrl}
        poster={current.thumbnail || undefined}
        className="w-full h-full object-contain"
        onClick={togglePlay}
        onPlay={onPlay}
        onPause={onPause}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onWaiting={onWaiting}
        onCanPlay={onCanPlay}
        onEnded={onEnded}
        onError={onError}
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        playsInline
        preload="metadata"
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <LoaderCircle className="h-14 w-14 animate-spin text-white/80" />
        </div>
      )}

      {/* Controles overlay */}
      <div
        className={cn(
          "absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/70 via-transparent to-black/20 p-4 transition-opacity duration-300",
          showControls && !isLoading ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Título (topo) */}
        {current.title && (
          <div className="text-white text-sm font-medium drop-shadow-lg line-clamp-1 max-w-[80%]">
            {current.title}
          </div>
        )}

        {/* Botões centrais: trocar vídeo (extremos) · recuar/avançar 10s · play/pause (centro) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 sm:gap-3">
          {/* Vídeo anterior */}
          <button
            onClick={goToPrevious}
            disabled={!canGoPrevious}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full border transition text-white",
              canGoPrevious
                ? "bg-white/10 border-white/20 hover:bg-white/25 hover:scale-105 active:scale-95"
                : "bg-white/5 border-white/10 opacity-40 cursor-not-allowed"
            )}
            aria-label="Vídeo anterior"
            title={canGoPrevious ? "Vídeo anterior" : "Ainda não há vídeo anterior"}
          >
            <ChevronsLeft className="h-6 w-6" />
          </button>

          {/* Separador visual entre "trocar vídeo" e "avançar/recuar 10s" */}
          <span className="h-8 w-px bg-white/15" aria-hidden />

          {/* Recuar 10s */}
          <button
            onClick={() => skip(-10)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 hover:scale-105 active:scale-95 transition text-white"
            aria-label="Recuar 10 segundos"
            title="Recuar 10 segundos"
          >
            <SkipBack className="h-5 w-5" />
            <span className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-1 text-[9px] font-semibold leading-tight text-white">
              10
            </span>
          </button>

          {/* Play / Pause */}
          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white hover:scale-110 active:scale-100 transition-transform duration-200"
            aria-label={isPlaying ? "Pausar" : "Reproduzir"}
          >
            {isPlaying ? (
              <Pause className="h-8 w-8 fill-white" />
            ) : (
              <Play className="h-8 w-8 fill-white ml-1" />
            )}
          </button>

          {/* Avançar 10s */}
          <button
            onClick={() => skip(10)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 hover:scale-105 active:scale-95 transition text-white"
            aria-label="Avançar 10 segundos"
            title="Avançar 10 segundos"
          >
            <SkipForward className="h-5 w-5" />
            <span className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-1 text-[9px] font-semibold leading-tight text-white">
              10
            </span>
          </button>

          {/* Separador visual entre "avançar/recuar 10s" e "trocar vídeo" */}
          <span className="h-8 w-px bg-white/15" aria-hidden />

          {/* Próximo vídeo */}
          <button
            onClick={goToNext}
            disabled={!canGoNext}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full border transition text-white",
              canGoNext
                ? "bg-white/10 border-white/20 hover:bg-white/25 hover:scale-105 active:scale-95"
                : "bg-white/5 border-white/10 opacity-40 cursor-not-allowed"
            )}
            aria-label="Próximo vídeo"
            title={canGoNext ? "Próximo vídeo" : "Sem sugestões disponíveis"}
          >
            <ChevronsRight className="h-6 w-6" />
          </button>
        </div>

        {/* Barra inferior */}
        <div className="space-y-3">
          {/* Progresso */}
          <div
            ref={progressRef}
            className="relative w-full h-1.5 bg-white/30 rounded-full cursor-pointer hover:h-2 transition-all"
            onClick={handleProgressClick}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              className="h-full bg-white rounded-full transition-all duration-100"
              style={{ width: `${progressPercent}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg"
              style={{ left: `calc(${progressPercent}% - 6px)` }}
            />
          </div>

          {/* Controles inferiores */}
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="p-1.5 rounded-full hover:bg-white/20 transition"
                aria-label={isPlaying ? "Pausar" : "Reproduzir"}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </button>

              <span className="text-xs font-mono tabular-nums">
                {formatTime(currentTime)}
                {duration > 0 && (
                  <span className="text-white/50"> / {formatTime(duration)}</span>
                )}
              </span>

              <div className="flex items-center gap-1 group/volume">
                <button
                  onClick={toggleMute}
                  className="p-1.5 rounded-full hover:bg-white/20 transition"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 accent-white cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded-full hover:bg-white/20 transition"
                aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-5 w-5" />
                ) : (
                  <Maximize2 className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}