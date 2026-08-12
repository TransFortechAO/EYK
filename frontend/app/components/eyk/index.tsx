"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ArrowRight, Star, Clock, PlayCircle, Hand, MessageCircle, Share2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Course, Video, Post } from "@/lib/mock-data";


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
    <Link
      href="/cursos"
      className="group block outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl"
    >
      <Card className="overflow-hidden border-border/70 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevated">
        <div
          className="relative aspect-[16/9] w-full"
          style={{ background: course.cover }}
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
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {course.durationHours}h
            </span>
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
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px] bg-secondary">
                  {course.teacherAvatar}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-xs text-muted-foreground">{course.teacher}</span>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium">
              <Star className="h-3.5 w-3.5 fill-primary text-primary" />
              {course.rating}
            </span>
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
      </Card>
    </Link>
  );
}

/* ---------- Video card ---------- */
export function VideoCard({ video }: { video: Video }) {
  return (
    <Link
      href="/videos"
      className="group block outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl"
    >
      <Card className="overflow-hidden border-border/70 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevated">
        <div
          className="relative aspect-video w-full"
          style={{ background: video.cover }}
          aria-hidden
        >
          <div className="absolute inset-0 grid place-items-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-background/90 text-foreground">
              <PlayCircle className="h-6 w-6" />
            </div>
          </div>
          <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
            {video.duration}
          </div>
        </div>
        <div className="space-y-2 p-4">
          <h3 className="font-serif text-base font-semibold leading-snug line-clamp-2">{video.title}</h3>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{video.teacher}</span>
            <span>{video.views.toLocaleString()} visualizações</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

/* ---------- Post card ---------- */
export function PostCard({ post }: { post: Post }) {
  const [liked, setLiked] = useState(post.liked || false);
  const [likes, setLikes] = useState(post.likes);

  const toggleLike = () => {
    if (liked) {
      setLikes(likes - 1);
    } else {
      setLikes(likes + 1);
    }
    setLiked(!liked);
  };

  return (
    <Card className="border-border/70 shadow-soft transition-shadow hover:shadow-elevated">
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-secondary">{post.initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm">{post.author}</p>
              <p className="text-xs text-muted-foreground">{post.timeAgo}</p>
            </div>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Share2 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="end">
              <Button variant="ghost" className="w-full justify-start gap-2 text-xs">
                <MessageCircle className="h-4 w-4" />
                Partilhar
              </Button>
            </PopoverContent>
          </Popover>
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