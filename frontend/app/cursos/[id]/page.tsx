"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Star,
  Users,
  PlayCircle,
  Lock,
  Maximize2,
  CheckCircle2,
} from "lucide-react";
import { CourseCard, SectionHeader, EmptyState, ShareButton } from "@/components/eyk";
import { VideoComments } from "@/components/eyk/video-comments";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { api, type Course, type CourseDetail } from "@/lib/api";
import { useAuth } from "@/components/auth-gate";
import { ModernVideoPlayer } from "@/components/ModernVideoPlayer";
import { UserAvatar } from "@/components/UserAvatar";

export default function CoursePlayerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [curso, setCurso] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeVideoId, setActiveVideoId] = useState<number | null>(null);
  const [relacionados, setRelacionados] = useState<Course[]>([]);
  const [inscrevendo, setInscrevendo] = useState(false);
  const playerWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const dados = await api.getCurso(params.id);
      if (!alive) return;
      setCurso(dados);
      setActiveVideoId(dados?.videos[0]?.id ?? null);
      setLoading(false);

      if (dados) {
        const todos = await api.getCursos();
        if (!alive) return;
        setRelacionados(
          todos.filter((c) => c.id !== dados.id && c.category === dados.category).slice(0, 3),
        );
      }
    })();
    return () => {
      alive = false;
    };
  }, [params.id]);

  if (loading) {
    return <div className="py-24 text-center text-muted-foreground">A carregar curso…</div>;
  }

  if (!curso) {
    return (
      <div className="py-24 text-center">
        <p className="text-muted-foreground">Curso não encontrado.</p>
        <Button variant="outline" className="mt-4 gap-1.5" onClick={() => router.push("/cursos")}>
          <ArrowLeft className="h-4 w-4" /> Voltar aos cursos
        </Button>
      </div>
    );
  }

  const desbloqueada = (index: number) => index === 0 || curso.inscrito;
  const activeIndex = Math.max(curso.videos.findIndex((v) => v.id === activeVideoId), 0);
  const activeVideo = curso.videos[activeIndex] || null;

  const selecionarAula = (videoId: number, index: number) => {
    if (!desbloqueada(index)) return;
    setActiveVideoId(videoId);
  };

  const comecarCurso = async () => {
    if (inscrevendo || curso.inscrito) return;
    setInscrevendo(true);
    try {
      await api.inscreverCurso(curso.id);
      setCurso({ ...curso, inscrito: true });
    } finally {
      setInscrevendo(false);
    }
  };

  const entrarEmFullscreen = () => {
    playerWrapRef.current?.requestFullscreen?.();
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2 gap-1.5" onClick={() => router.push("/cursos")}>
        <ArrowLeft className="h-4 w-4" /> Todos os cursos
      </Button>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        {/* Coluna principal: player + info + tabs */}
        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden rounded-3xl border-border/70 shadow-elevated">
            <div ref={playerWrapRef} className="relative">
              {activeVideo ? (
                <ModernVideoPlayer
                  fileUrl={activeVideo.fileUrl}
                  externalUrl={activeVideo.externalUrl}
                  title={activeVideo.title}
                  thumbnail={curso.thumbnail}
                />
              ) : (
                <div
                  className="flex aspect-video w-full items-center justify-center text-white/70"
                  style={{ background: curso.thumbnail }}
                >
                  <PlayCircle className="h-12 w-12" />
                </div>
              )}
              <button
                type="button"
                onClick={entrarEmFullscreen}
                aria-label="Ecrã inteiro"
                className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              {activeVideo && (
                <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                  Aula {activeIndex + 1} — {activeVideo.title}
                </span>
              )}
            </div>
          </Card>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground sm:text-sm">
            <Badge variant="outline" className="rounded-full">
              {curso.category}
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {curso.level}
            </Badge>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {curso.durationHours}h
            </span>
            <span className="inline-flex items-center gap-1.5">
              <PlayCircle className="h-3.5 w-3.5" /> {curso.videos.length} aula{curso.videos.length === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> {curso.students.toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <Star className="h-3.5 w-3.5 fill-primary text-primary" /> {curso.rating}
            </span>
          </div>

          <div className="flex items-start justify-between gap-3">
            <h1 className="font-serif text-2xl font-semibold leading-snug sm:text-3xl">{curso.title}</h1>
            <ShareButton url={`/cursos/${curso.id}`} titulo={curso.title} />
          </div>

          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11">
              <UserAvatar name={curso.teacher} noLink />
            </Avatar>
            <div>
              <p className="text-sm font-medium">{curso.teacher}</p>
              <p className="text-xs text-muted-foreground">Professor EYK</p>
            </div>
          </div>

          <Tabs defaultValue="sobre">
            <TabsList className="bg-surface">
              <TabsTrigger value="sobre">Sobre</TabsTrigger>
              <TabsTrigger value="aulas">Aulas</TabsTrigger>
              <TabsTrigger value="recursos">Recursos</TabsTrigger>
            </TabsList>

            <TabsContent value="sobre" className="space-y-4">
              {curso.description ? (
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {curso.description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Este curso ainda não tem descrição.</p>
              )}
              <Card className="grid gap-3 rounded-2xl border-border/70 p-4 sm:grid-cols-2">
                <div className="flex items-center gap-2.5 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  {curso.videos.length} aula{curso.videos.length === 1 ? "" : "s"} em vídeo
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  {curso.durationHours}h de conteúdo
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  Categoria {curso.category}
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  {curso.students.toLocaleString()} aluno{curso.students === 1 ? "" : "s"} inscritos
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="aulas" className="space-y-2">
              {curso.videos.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Este curso ainda não tem aulas publicadas.
                </p>
              ) : (
                curso.videos.map((v, index) => {
                  const desbloqueado = desbloqueada(index);
                  const ativo = activeVideo?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => selecionarAula(v.id, index)}
                      disabled={!desbloqueado}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition",
                        ativo
                          ? "border-primary bg-gradient-gold/10"
                          : desbloqueado
                            ? "border-border/70 hover:border-primary/40 hover:bg-surface/60"
                            : "cursor-not-allowed border-border/50 opacity-60",
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
                          ativo ? "bg-gradient-gold text-primary-foreground" : "bg-secondary text-secondary-foreground",
                        )}
                      >
                        {desbloqueado ? (ativo ? <PlayCircle className="h-3.5 w-3.5" /> : index + 1) : <Lock className="h-3 w-3" />}
                      </div>
                      <div className="min-w-0">
                        <p className={cn("text-sm font-medium", ativo && "text-primary")}>{v.title}</p>
                        {v.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{v.description}</p>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="recursos">
              <EmptyState icon={BookOpen} title="Sem recursos adicionais" description="Este curso ainda não tem materiais para download." />
            </TabsContent>
          </Tabs>

          {activeVideo && (
            <VideoComments videoId={activeVideo.id} />
          )}

          {relacionados.length > 0 && (
            <section className="pt-4">
              <SectionHeader title="Cursos relacionados" href="/cursos" cta="Ver todos" />
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {relacionados.map((c) => (
                  <CourseCard key={c.id} course={c} />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar: progresso + currículo */}
        <div className="space-y-4 lg:sticky lg:top-24">
          <Card className="space-y-3 rounded-2xl border-border/70 p-4 shadow-soft">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso do curso</span>
              <span className="font-medium tabular-nums">{curso.progress ?? 0}%</span>
            </div>
            <Progress value={curso.progress ?? 0} className="h-1.5" />

            {curso.inscrito ? (
              <div className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2.5 text-sm font-medium text-success">
                <CheckCircle2 className="h-4 w-4" /> Já estás inscrito
              </div>
            ) : (
              <Button
                onClick={() => void comecarCurso()}
                disabled={inscrevendo || curso.videos.length === 0}
                className="w-full gap-2 bg-gradient-gold text-primary-foreground hover:opacity-95 shadow-gold"
              >
                <PlayCircle className="h-4 w-4" />
                {inscrevendo ? "A inscrever…" : "Começar curso"}
              </Button>
            )}
          </Card>

          {curso.videos.length > 0 && (
            <Card className="rounded-2xl border-border/70 p-2 shadow-soft">
              <p className="px-2.5 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Conteúdo do curso
              </p>
              <div className="space-y-1">
                {curso.videos.map((v, index) => {
                  const desbloqueado = desbloqueada(index);
                  const ativo = activeVideo?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => selecionarAula(v.id, index)}
                      disabled={!desbloqueado}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2.5 text-left text-sm transition",
                        ativo
                          ? "border-primary/60 bg-gradient-gold/10 text-primary"
                          : desbloqueado
                            ? "border-transparent hover:bg-surface/60"
                            : "cursor-not-allowed border-transparent text-muted-foreground opacity-60",
                      )}
                    >
                      {desbloqueado ? (
                        <PlayCircle className={cn("h-4 w-4 shrink-0", ativo ? "text-primary" : "text-muted-foreground")} />
                      ) : (
                        <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        {index + 1}. {v.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
