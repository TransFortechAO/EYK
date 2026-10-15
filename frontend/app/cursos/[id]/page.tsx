"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Clock,
  Users,
  PlayCircle,
  Lock,
  Maximize2,
  CheckCircle2,
  Upload,
  Star,
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
import { api, type Course, type CourseDetail, type CourseVideo } from "@/lib/api";
import { ModernVideoPlayer } from "@/components/ModernVideoPlayer";
import { UserAvatar } from "@/components/UserAvatar";
import { ListaRecursos } from "@/components/curso/ListaRecursos";
import { UploadRecurso } from "@/components/curso/UploadRecurso";
import { AvaliacoesCurso } from "@/components/curso/AvaliacoesCurso";
import { BotaoCertificado } from "@/components/curso/BotaoCertificado";
import { BotaoDenunciar } from "@/components/moderacao/denunciar";

/** "Retomar onde ficaste": abre a aula mexida mais recentemente, se ainda
 * estiver a meio e desbloqueada; senão a primeira aula por ver; senão a 1.ª. */
function aulaInicial(curso: CourseDetail): number | null {
  const videos = curso.videos;
  if (videos.length === 0) return null;
  const desbloqueadaIdx = (i: number) =>
    curso.souOProfessor || i === 0 || (curso.inscrito && (videos[i - 1]?.watched ?? false));

  let recente: CourseVideo | null = null;
  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    if (!v.positionUpdatedAt || !desbloqueadaIdx(i)) continue;
    if (!recente || v.positionUpdatedAt > (recente.positionUpdatedAt ?? "")) recente = v;
  }
  if (recente && recente.positionSeconds > 0) return recente.id;

  const porVer = videos.findIndex((v, i) => !v.watched && desbloqueadaIdx(i));
  return videos[porVer >= 0 ? porVer : 0].id;
}

export default function CoursePlayerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [curso, setCurso] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeVideoId, setActiveVideoId] = useState<number | null>(null);
  const [relacionados, setRelacionados] = useState<Course[]>([]);
  const [inscrevendo, setInscrevendo] = useState(false);
  const [mostrarUploadRecurso, setMostrarUploadRecurso] = useState(false);
  const [recursosKey, setRecursosKey] = useState(0);
  const playerWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const dados = await api.getCurso(params.id);
      if (!alive) return;
      setCurso(dados);
      setActiveVideoId(dados ? aulaInicial(dados) : null);
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

  // O professor (a ver o seu próprio curso) vê sempre tudo desbloqueado.
  // Para o aluno: a 1ª aula está sempre livre; as seguintes só desbloqueiam
  // depois de a aula anterior ter sido assistida (não basta estar inscrito).
  const desbloqueada = (index: number) => {
    if (curso.souOProfessor) return true;
    if (index === 0) return true;
    if (!curso.inscrito) return false;
    return curso.videos[index - 1]?.watched ?? false;
  };
  const activeIndex = Math.max(curso.videos.findIndex((v) => v.id === activeVideoId), 0);
  const activeVideo = curso.videos[activeIndex] || null;

  const selecionarAula = (videoId: number, index: number) => {
    if (!desbloqueada(index)) {
      toast.info("Termina a aula anterior para desbloquear esta.");
      return;
    }
    setActiveVideoId(videoId);
  };

  // Chamado pelo player quando regista uma view (60s de reprodução contínua)
  // — desbloqueia a aula seguinte de imediato, sem precisar de recarregar a página.
  const marcarAulaComoAssistida = (videoId: number) => {
    setCurso((prev) => {
      if (!prev) return prev;
      const videos = prev.videos.map((v) => (v.id === videoId ? { ...v, watched: true } : v));
      // Última aula vista = curso concluído no servidor (ver `_verificar_curso_concluido`).
      const concluiuAgora =
        prev.inscrito && !prev.souOProfessor && !prev.certificadoDisponivel && videos.every((v) => v.watched);
      if (concluiuAgora) {
        toast.success("Parabéns, concluíste o curso! O teu certificado já está disponível.");
      }
      return {
        ...prev,
        videos,
        certificadoDisponivel: prev.certificadoDisponivel || concluiuAgora,
        progress: concluiuAgora ? 100 : prev.progress,
      };
    });
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
                  videoId={activeVideo.id}
                  onViewRegistered={() => marcarAulaComoAssistida(activeVideo.id)}
                  recursos={[...curso.recursos, ...activeVideo.recursos]}
                  temLegenda={activeVideo.temLegenda}
                  // "Seguinte"/"anterior" = outra aula deste curso (a seguinte só
                  // se já estiver desbloqueada). Ao terminar, o player avança
                  // sozinho se a preferência "passar à aula seguinte" estiver ligada.
                  hasNext={activeIndex < curso.videos.length - 1 && desbloqueada(activeIndex + 1)}
                  hasPrevious={activeIndex > 0}
                  onNext={() => {
                    const seguinte = curso.videos[activeIndex + 1];
                    if (seguinte) selecionarAula(seguinte.id, activeIndex + 1);
                  }}
                  onPrevious={() => {
                    const anterior = curso.videos[activeIndex - 1];
                    if (anterior) setActiveVideoId(anterior.id);
                  }}
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

          {activeVideo && activeVideo.durationLabel && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Duração da aula: {activeVideo.durationLabel}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground sm:text-sm">
            <Badge variant="outline" className="rounded-full">
              {curso.category}
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {curso.level}
            </Badge>
            {curso.durationLabel && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> {curso.durationLabel}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <PlayCircle className="h-3.5 w-3.5" /> {curso.videos.length} aula{curso.videos.length === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> {curso.students.toLocaleString()}
            </span>
            {curso.rating !== null && (
              <span className="inline-flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                <span className="font-medium text-foreground">{curso.rating.toFixed(1)}</span>
                ({curso.ratingCount})
              </span>
            )}
          </div>

          <div className="flex items-start justify-between gap-3">
            <h1 className="font-serif text-2xl font-semibold leading-snug sm:text-3xl">{curso.title}</h1>
            <div className="flex shrink-0 items-center gap-1">
              <ShareButton url={`/cursos/${curso.id}`} titulo={curso.title} />
              {!curso.souOProfessor && <BotaoDenunciar tipo="curso" id={curso.id} autorId={curso.teacherUserId} />}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11">
              <UserAvatar noLink name={curso.teacher} userId={curso.teacherUserId ?? undefined} />
            </Avatar>
            <div>
              {curso.teacherUserId ? (
                <Link
                  href={`/perfil/${curso.teacherUserId}`}
                  className="text-sm font-medium hover:underline underline-offset-2 transition-colors"
                >
                  {curso.teacher}
                </Link>
              ) : (
                <p className="text-sm font-medium">{curso.teacher}</p>
              )}
              <p className="text-xs text-muted-foreground">Professor EYK</p>
            </div>
          </div>

          <Tabs defaultValue="sobre">
            <TabsList className="bg-surface">
              <TabsTrigger value="sobre">Sobre</TabsTrigger>
              <TabsTrigger value="aulas">Aulas</TabsTrigger>
              <TabsTrigger value="recursos">Recursos</TabsTrigger>
              <TabsTrigger value="avaliacoes">Avaliações</TabsTrigger>
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
                {curso.durationLabel && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    {curso.durationLabel} de conteúdo
                  </div>
                )}
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
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={cn("text-sm font-medium", ativo && "text-primary")}>{v.title}</p>
                          {v.watched && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />}
                        </div>
                        {v.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{v.description}</p>
                        )}
                      </div>
                      {v.durationLabel && (
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{v.durationLabel}</span>
                      )}
                    </button>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="recursos" className="space-y-4">
              {curso?.souOProfessor ? (
                <>
                  {mostrarUploadRecurso ? (
                    <UploadRecurso
                      cursoId={curso.id}
                      onAdicionado={() => {
                        setMostrarUploadRecurso(false);
                        setRecursosKey((k) => k + 1);
                      }}
                      onCancelar={() => setMostrarUploadRecurso(false)}
                    />
                  ) : (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setMostrarUploadRecurso(true)}
                        className="gap-2 bg-gradient-gold text-primary-foreground hover:opacity-95 shadow-gold"
                      >
                        <Upload className="h-4 w-4" />
                        Adicionar recurso PDF
                      </Button>
                    </div>
                  )}
                  <ListaRecursos
                    key={recursosKey}
                    cursoId={curso.id}
                    podeEditar
                  />
                </>
              ) : curso?.inscrito ? (
                <ListaRecursos key={recursosKey} cursoId={curso.id} />
              ) : (
                <EmptyState
                  icon={Lock}
                  title="Recursos disponíveis após inscrição"
                  description="Inscreve-te no curso para desbloqueares os materiais de apoio (PDFs, exercícios, etc.)."
                  action={
                    <Button
                      onClick={() => void comecarCurso()}
                      disabled={inscrevendo || curso.videos.length === 0}
                      className="gap-2 bg-gradient-gold text-primary-foreground hover:opacity-95 shadow-gold"
                      size="sm"
                    >
                      <PlayCircle className="h-4 w-4" />
                      {inscrevendo ? "A inscrever…" : "Inscrever-me agora"}
                    </Button>
                  }
                />
              )}
            </TabsContent>
            <TabsContent value="avaliacoes">
              <AvaliacoesCurso
                cursoId={curso.id}
                onResumoAlterado={(resumo) =>
                  setCurso((prev) => (prev ? { ...prev, rating: resumo.media, ratingCount: resumo.total } : prev))
                }
              />
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
          {!curso.souOProfessor && (
            <Card className="space-y-3 rounded-2xl border-border/70 p-4 shadow-soft">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progresso do curso</span>
                <span className="font-medium tabular-nums">{curso.progress ?? 0}%</span>
              </div>
              <Progress value={curso.progress ?? 0} className="h-1.5" />

              {curso.certificadoDisponivel ? (
                <>
                  <div className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2.5 text-sm font-medium text-success">
                    <CheckCircle2 className="h-4 w-4" /> Curso concluído
                  </div>
                  <BotaoCertificado cursoId={curso.id} />
                </>
              ) : curso.inscrito ? (
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
          )}

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
                      {v.durationLabel && (
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{v.durationLabel}</span>
                      )}
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
