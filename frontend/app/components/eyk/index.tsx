"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Clock,
  PlayCircle,
  Hand,
  MessageCircle,
  Share2,
  ExternalLink,
  Check,
  Link as LinkIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Course, Video, Post } from "@/lib/mock-data";
import { UserAvatar } from "@/components/UserAvatar";
import { api, formatarDataCurta } from "@/lib/api";


/* ---------- Page header ---------- */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">{description}</p>
        )}
      </div>
      {children && <div className="shrink-0 flex items-center gap-2">{children}</div>}
    </div>
  );
}

/* ---------- Section header ---------- */
export function SectionHeader({
  title,
  href,
  cta = "Ver todos",
}: {
  title: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-2">
      <h2 className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
      {href && (
        <Link
          href={href}
          className="group inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
        >
          {cta}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

/* ---------- Empty state ---------- */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "flex flex-col items-center justify-center gap-3 border-dashed bg-surface/60 p-10 text-center animate-fade-in",
        className,
      )}
    >
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-gold/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <div>
        <h3 className="font-serif text-lg font-semibold">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground max-w-md">{description}</p>
        )}
      </div>
      {action}
    </Card>
  );
}

/* ---------- Stat card ---------- */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "gold" | "streak" | "success";
}) {
  const tones = {
    default: "bg-secondary text-secondary-foreground",
    gold: "bg-gradient-gold text-primary-foreground shadow-gold",
    streak: "bg-streak/15 text-streak",
    success: "bg-success/15 text-success",
  } as const;
  return (
    <Card className="p-5 shadow-soft transition-shadow hover:shadow-elevated">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-serif text-3xl font-semibold tabular-nums">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

/* ---------- Course card ---------- */
export function CourseCard({ course }: { course: Course }) {
  return (
    <Card className="group relative overflow-hidden border-border/70 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevated">
      <Link
        href={`/cursos/${course.id}`}
        className="block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div
          className="relative aspect-[16/9] w-full"
          style={{ background: course.thumbnail }}
          aria-hidden
        >
          <Badge className="absolute left-3 top-3 rounded-full bg-background/90 text-foreground border-0 backdrop-blur">
            {course.category}
          </Badge>
          {typeof course.progress === "number" && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
              <div
                className="h-full bg-primary-glow"
                style={{ width: `${course.progress}%` }}
              />
            </div>
          )}
        </div>

        <div className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-secondary px-2 py-0.5">{course.level}</span>
            {course.durationLabel && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {course.durationLabel}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <PlayCircle className="h-3.5 w-3.5" />
              {course.lessons} aulas
            </span>
          </div>

          <h3 className="font-serif text-lg font-semibold leading-snug text-foreground line-clamp-2">
            {course.title}
          </h3>

          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <UserAvatar
                name={course.teacher}
                initials={course.teacherAvatar}
                userId={course.teacherUserId ?? undefined}
                size={24}
                className="text-[10px]"
              />
              {course.teacherUserId ? (
                <Link
                  href={`/perfil/${course.teacherUserId}`}
                  className="truncate text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors"
                >
                  {course.teacher}
                </Link>
              ) : (
                <span className="truncate text-xs text-muted-foreground">{course.teacher}</span>
              )}
            </div>
            {course.publishedAt && (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {formatarDataCurta(course.publishedAt)}
              </span>
            )}
          </div>

          {typeof course.progress === "number" && (
            <div className="pt-1">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-medium tabular-nums">{course.progress}%</span>
              </div>
              <Progress value={course.progress} className="h-1.5" />
            </div>
          )}
        </div>
      </Link>
    </Card>
  );
}

/* ---------- Video card ---------- */
export function VideoCard({ video }: { video: Video }) {
  return (
    <Link
      href={`/videos/${video.id}`}
      className="group block outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl"
    >
      <Card className="overflow-hidden border-border/70 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevated">
        <div className="relative aspect-video w-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
          {/* Thumbnail (se existir) */}
          {video.thumbnail ? (
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
              style={{ background: video.thumbnail }}
              aria-hidden
            />
          ) : (
            /* Fallback quando não há thumbnail */
            <PlayCircle className="h-16 w-16 text-white/30 transition-transform duration-200 group-hover:scale-110" />
          )}

          {/* Overlay com ícone de play (hover) */}
          <div className="absolute inset-0 grid place-items-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-background/90 text-foreground shadow-lg">
              <PlayCircle className="h-6 w-6" />
            </div>
          </div>

          {/* Badge de duração (se existir) */}
          {video.duration && (
            <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
              {video.duration}
            </div>
          )}
        </div>

        <div className="space-y-2 p-4">
          <h3 className="font-serif text-base font-semibold leading-snug line-clamp-2">
            {video.title}
          </h3>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {video.teacherUserId ? (
              <Link
                href={`/perfil/${video.teacherUserId}`}
                className="truncate hover:text-foreground hover:underline underline-offset-2 transition-colors"
              >
                {video.teacher}
              </Link>
            ) : (
              <span className="truncate">{video.teacher}</span>
            )}
            <span className="shrink-0">{video.views.toLocaleString()} visualizações</span>
          </div>
          {video.publishedAt && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {formatarDataCurta(video.publishedAt)}
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}

/* ---------- Post card ---------- */
export function PostCard({ post, onToggleLike }: { post: Post; onToggleLike?: () => void }) {
  const [liked, setLiked] = useState(post.liked || false);
  const [likes, setLikes] = useState(post.likes);

  useEffect(() => {
    setLiked(post.liked || false);
    setLikes(post.likes);
  }, [post.liked, post.likes]);

  const toggleLike = () => {
    if (onToggleLike) {
      onToggleLike();
      return;
    }
    if (liked) {
      setLikes(likes - 1);
    } else {
      setLikes(likes + 1);
    }
    setLiked(!liked);
  };

  return (
    <Card className="border-border/70 shadow-soft transition-shadow">
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <UserAvatar
                name={post.author}
                initials={post.initials}
                foto={post.authorFoto ?? undefined}
                userId={post.authorId ?? undefined}
              />
            </Avatar>
            <div>
              {post.authorId ? (
                <Link
                  href={`/perfil/${post.authorId}`}
                  className="font-medium text-sm hover:underline underline-offset-2 transition-colors"
                >
                  {post.author}
                </Link>
              ) : (
                <p className="font-medium text-sm">{post.author}</p>
              )}
              <p className="text-xs text-muted-foreground">{post.timeAgo}</p>
            </div>
          </div>
          <ShareButton url={`/comunidade?post=${post.id}`} titulo="Publicação na comunidade EYK" />
        </div>
        <p className="text-sm leading-relaxed text-foreground">{post.content}</p>
        <div className="flex items-center gap-4 pt-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn("gap-2 text-xs", liked && "text-primary")}
            onClick={toggleLike}
          >
            <Hand className={cn("h-4 w-4", liked && "fill-primary")} />
            {likes}
          </Button>
          <Button variant="ghost" size="sm" className="gap-2 text-xs">
            <MessageCircle className="h-4 w-4" />
            {post.comments}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ---------- Media player (ficheiro próprio ou embed de link externo) ---------- */
function youtubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "youtube.com") {
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (u.pathname.startsWith("/embed/")) return url;
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/")[2];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
    }
  } catch {
    /* link inválido, cai para o fallback */
  }
  return null;
}

export function MediaPlayer({
  fileUrl,
  externalUrl,
  title,
  cover,
  videoId,
}: {
  fileUrl?: string | null;
  externalUrl?: string | null;
  title: string;
  cover?: string;
  /** Quando definido, regista uma "view" ao fim de 1 minuto de reprodução
   * CONTÍNUA (pausar ou trocar de vídeo reinicia a contagem — regra
   * anti-fraude do modelo de coins). Só funciona para ficheiro próprio —
   * embeds do YouTube não expõem o estado de reprodução. */
  videoId?: string | number;
}) {
  const embed = !fileUrl && externalUrl ? youtubeEmbedUrl(externalUrl) : null;
  const semConteudo = !fileUrl && !embed && !externalUrl;

  const segundosContinuosRef = useRef(0);
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const viewRegistadaRef = useRef(false);

  const pararContagem = () => {
    segundosContinuosRef.current = 0;
    if (intervaloRef.current) {
      clearInterval(intervaloRef.current);
      intervaloRef.current = null;
    }
  };

  useEffect(() => {
    // vídeo novo (ou "sair e reentrar") — reinicia tudo
    viewRegistadaRef.current = false;
    pararContagem();
    return pararContagem;
  }, [videoId, fileUrl]);

  const aoIniciarReproducao = () => {
    if (!videoId || viewRegistadaRef.current || intervaloRef.current) return;
    intervaloRef.current = setInterval(() => {
      segundosContinuosRef.current += 1;
      if (segundosContinuosRef.current >= 60) {
        viewRegistadaRef.current = true;
        pararContagem();
        void api.registarViewVideo(videoId);
      }
    }, 1000);
  };

  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black"
      style={semConteudo && cover ? { background: cover } : undefined}
    >
      {fileUrl ? (
        <video
          key={fileUrl}
          controls
          className="h-full w-full"
          src={fileUrl}
          onPlay={aoIniciarReproducao}
          onPause={pararContagem}
          onEnded={pararContagem}
        >
          O teu browser não suporta reprodução de vídeo.
        </video>
      ) : embed ? (
        <iframe
          key={embed}
          src={embed}
          title={title}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : externalUrl ? (
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/90 transition hover:text-white"
        >
          <div className="grid h-16 w-16 place-items-center rounded-full bg-white/10 backdrop-blur">
            <ExternalLink className="h-7 w-7" />
          </div>
          <span className="text-sm font-medium">Abrir vídeo em nova aba</span>
        </a>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-white/70">
          <PlayCircle className="h-12 w-12" />
        </div>
      )}
    </div>
  );
}

/* ---------- Botão de partilha (copia link / partilha nativa) ---------- */
export function ShareButton({
  url,
  titulo,
  className,
}: {
  url: string;
  titulo?: string;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  const partilhar = async () => {
    const absoluta = url.startsWith("http") ? url : `${window.location.origin}${url}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ url: absoluta, title: titulo });
        return;
      } catch {
        // utilizador cancelou a partilha nativa — cai para copiar o link
      }
    }

    try {
      await navigator.clipboard.writeText(absoluta);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* clipboard indisponível neste browser */
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("h-8 w-8 shrink-0", className)}>
          <Share2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="end">
        <Button variant="ghost" className="w-full justify-start gap-2 text-xs" onClick={() => void partilhar()}>
          {copiado ? <Check className="h-4 w-4 text-primary" /> : <LinkIcon className="h-4 w-4" />}
          {copiado ? "Link copiado!" : "Copiar link"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}