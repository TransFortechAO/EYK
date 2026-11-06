"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  Clock,
  PlayCircle,
  Hand,
  Share2,
  ExternalLink,
  Star,
  EyeOff,
  Pencil,
  MessageCircle,
  Repeat2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/UserAvatar";
import { api, formatarDataCurta, mensagemDeErro, type Course, type Video, type Post } from "@/lib/api";
import { useAuth } from "@/components/auth-gate";
import { toast } from "sonner";
import { PostComments } from "@/components/eyk/post-comments";
import { GestoAnimado } from "@/components/ds/gesto-animado";
import { ModalPartilha, PreviaPost } from "@/components/partilha/modal-partilha";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MenuModeracao } from "@/components/moderacao/denunciar";



/* ---------- Page header ---------- */
export function PageHeader({
  title,
  description,
  children,
  gesto,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Palavra do gesto de LGA mostrado ao lado do título (por omissão, o próprio título). */
  gesto?: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {/* Gesto de LGA da palavra, se a equipa já tiver um validado (Design System). */}
        <GestoAnimado palavra={gesto ?? title} className="h-14 w-14 shrink-0 sm:h-16 sm:w-16" />
        <div className="min-w-0">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">{description}</p>
          )}
        </div>
      </div>
      {children && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">{children}</div>}
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
          className="hit group inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
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

/**
 * Link dentro de um cartão que já é um link (um <a> não pode estar dentro de
 * outro): navega ao clicar ou com Enter, sem abrir o cartão.
 */
function LinkDentroDeCartao({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  const ir = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(href);
  };
  return (
    <span
      role="link"
      tabIndex={0}
      className={cn("cursor-pointer", className)}
      onClick={ir}
      onKeyDown={(e) => {
        if (e.key === "Enter") ir(e);
      }}
    >
      {children}
    </span>
  );
}

/* ---------- Course card ---------- */
export function CourseCard({ course }: { course: Course }) {
  return (
    <Card className="group relative overflow-hidden border-border/70 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevated">
      <Link
        href={`/cursos/${course.id}`}
        // Telemóvel: cartão horizontal e compacto; a partir do tablet, vertical.
        className="flex h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring sm:block"
      >
        <div
          className="relative aspect-[16/9] w-[40%] shrink-0 self-start sm:w-full"
          style={{ background: course.thumbnail }}
          aria-hidden
        >
          <Badge className="absolute left-3 top-3 hidden rounded-full bg-background/90 text-foreground border-0 backdrop-blur sm:inline-flex">
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

        <div className="min-w-0 flex-1 space-y-1.5 p-3 sm:space-y-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="hidden rounded-full bg-secondary px-2 py-0.5 sm:inline">{course.level}</span>
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
            {course.rating !== null && course.rating !== undefined && (
              <span className="ml-auto inline-flex items-center gap-1" title={`${course.ratingCount} avaliações`}>
                <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                <span className="font-medium tabular-nums text-foreground">{course.rating.toFixed(1)}</span>
              </span>
            )}
          </div>

          <h3 className="font-serif text-base font-semibold leading-snug text-foreground line-clamp-2 sm:text-lg">
            {course.title}
          </h3>

          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <UserAvatar
                name={course.teacher}
                initials={course.teacherAvatar}
                userId={course.teacherUserId ?? undefined}
                size={24}
                noLink
                className="text-[10px]"
              />
              {course.teacherUserId ? (
                <LinkDentroDeCartao
                  href={`/perfil/${course.teacherUserId}`}
                  className="hit truncate text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors"
                >
                  {course.teacher}
                </LinkDentroDeCartao>
              ) : (
                <span className="truncate text-xs text-muted-foreground">{course.teacher}</span>
              )}
            </div>
            {course.publishedAt && (
              <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
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
      {/* Telemóvel: cartão horizontal e compacto; a partir do tablet, vertical. */}
      <Card className="flex overflow-hidden border-border/70 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevated sm:block">
        <div className="relative aspect-video w-[40%] shrink-0 self-start bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center sm:w-full">
          {/* Thumbnail (se existir) */}
          {video.thumbnail ? (
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
              style={{ background: video.thumbnail }}
              aria-hidden
            />
          ) : (
            /* Fallback quando não há thumbnail */
            <PlayCircle className="h-10 w-10 text-white/30 transition-transform duration-200 group-hover:scale-110 sm:h-16 sm:w-16" />
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

        <div className="min-w-0 flex-1 space-y-1.5 p-3 sm:space-y-2 sm:p-4">
          <h3 className="font-serif text-sm font-semibold leading-snug line-clamp-2 sm:text-base">
            {video.title}
          </h3>
          <div className="flex flex-wrap items-center justify-between gap-x-2 text-xs text-muted-foreground">
            {video.teacherUserId ? (
              <LinkDentroDeCartao
                href={`/perfil/${video.teacherUserId}`}
                className="hit truncate hover:text-foreground hover:underline underline-offset-2 transition-colors"
              >
                {video.teacher}
              </LinkDentroDeCartao>
            ) : (
              <span className="truncate">{video.teacher}</span>
            )}
            <span className="shrink-0">{video.views.toLocaleString()} visualizações</span>
          </div>
          {video.publishedAt && (
            <div className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
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
/** Aviso no próprio conteúdo do autor quando a moderação o ocultou. */
export function AvisoOculto({ className }: { className?: string }) {
  return (
    <p className={cn("inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300", className)}>
      <EyeOff className="h-3.5 w-3.5 shrink-0" />
      Ocultado pela moderação — só tu o vês. Recebeste uma notificação com o link para contestar.
    </p>
  );
}

export function PostCard({
  post,
  onToggleLike,
  onAutorBloqueado,
  onRepostado,
  abrirAoCarregar = false,
}: {
  post: Post;
  onToggleLike?: () => void;
  /** Chamado depois de o utilizador bloquear o autor (para tirar os posts dele da lista). */
  onAutorBloqueado?: (userId: number) => void;
  /** Chamado com o novo post depois de repostar (para o pôr no topo da lista). */
  onRepostado?: (novo: Post) => void;
  /** Abre logo o modal do post (ex: link partilhado /comunidade?post=ID). */
  abrirAoCarregar?: boolean;
}) {
  const [liked, setLiked] = useState(post.liked || false);
  const [likes, setLikes] = useState(post.likes);
  const [comentarios, setComentarios] = useState(post.comments);
  const [modalAberto, setModalAberto] = useState(abrirAoCarregar);
  const [partilhaAberta, setPartilhaAberta] = useState(false);
  const { user } = useAuth();
  const souAutor = user?.id != null && post.authorId != null && String(user.id) === String(post.authorId);
  const [conteudo, setConteudo] = useState(post.content);
  const [editadoEm, setEditadoEm] = useState(post.editadoEm);
  const [aEditar, setAEditar] = useState(false);
  const [texto, setTexto] = useState(post.content);
  const [aGuardar, setAGuardar] = useState(false);

  useEffect(() => {
    setConteudo(post.content);
    setEditadoEm(post.editadoEm);
  }, [post.content, post.editadoEm]);

  useEffect(() => {
    if (abrirAoCarregar) setModalAberto(true);
  }, [abrirAoCarregar]);

  const guardarEdicao = async () => {
    const novo = texto.trim();
    if (!novo) return;
    setAGuardar(true);
    try {
      const atualizado = await api.editarPost(post.id, novo);
      setConteudo(atualizado.content);
      setEditadoEm(atualizado.editadoEm);
      setAEditar(false);
      toast.success("Publicação editada.");
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível editar a publicação."));
    } finally {
      setAGuardar(false);
    }
  };

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

  // O que se partilha: num repost sem comentário, a publicação original.
  const partilhaOriginal = Boolean(post.repostDe?.id && !conteudo && !post.repostDe.indisponivel);
  const idPartilha = partilhaOriginal ? post.repostDe!.id! : post.id;
  const autorPartilha = partilhaOriginal ? post.repostDe!.author ?? post.author : post.author;
  const textoPartilha = partilhaOriginal ? post.repostDe!.content ?? "" : conteudo;
  const iniciaisPartilha = partilhaOriginal ? post.repostDe!.initials ?? "??" : post.initials;
  const fotoPartilha = post.imagem ?? (post.repostDe?.indisponivel ? null : post.repostDe?.imagem) ?? null;

  const cabecalho = (emModal: boolean) => (
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
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {post.repostDe && (
              <>
                <Repeat2 className="h-3.5 w-3.5" aria-hidden /> repostou ·
              </>
            )}
            {post.timeAgo}
            {editadoEm && " · editado"}
          </p>
        </div>
      </div>
      {!emModal && (
        <div className="flex items-center gap-1">
          {souAutor && !aEditar && conteudo && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setTexto(conteudo);
                setAEditar(true);
              }}
              aria-label="Editar publicação"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          <MenuModeracao
            tipo="post"
            id={post.id}
            autorId={post.authorId}
            autorNome={post.author}
            onBloqueado={onAutorBloqueado}
          />
        </div>
      )}
    </div>
  );

  const corpo = (emModal: boolean) => (
    <>
      {post.oculto && <AvisoOculto />}
      {aEditar && !emModal ? (
        <div className="space-y-2">
          <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} className="text-sm" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAEditar(false)} disabled={aGuardar}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => void guardarEdicao()} disabled={aGuardar || !texto.trim()}>
              Guardar
            </Button>
          </div>
        </div>
      ) : (
        conteudo && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{conteudo}</p>
      )}
      {post.imagem && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.imagem}
          alt={`Foto publicada por ${post.author}`}
          loading="lazy"
          className={cn("w-full rounded-xl bg-surface object-cover", emModal ? "max-h-[60vh]" : "max-h-[480px]")}
        />
      )}
      {post.repostDe && <PostOriginal original={post.repostDe} />}
    </>
  );

  return (
    <>
      <Card className="border-border/70 shadow-soft transition-shadow">
        <div className="space-y-4 p-5">
          {cabecalho(false)}
          {corpo(false)}
          {/* Como num feed: reagir, comentar (abre o modal do post) e partilhar, com os números. */}
          <div className="grid grid-cols-3 gap-1 border-t border-border/60 pt-2">
            <Button
              variant="ghost"
              size="sm"
              className={cn("gap-2 text-xs sm:text-sm", liked && "text-primary")}
              onClick={toggleLike}
              aria-label={liked ? "Retirar reação" : "Reagir"}
            >
              <Hand className={cn("h-4 w-4", liked && "fill-primary")} />
              <span className="hidden sm:inline">Gosto</span>
              <span className="tabular-nums">{likes}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-xs sm:text-sm"
              onClick={() => setModalAberto(true)}
              aria-label={`Ver comentários (${comentarios})`}
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Comentar</span>
              <span className="tabular-nums">{comentarios}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-xs sm:text-sm"
              onClick={() => setPartilhaAberta(true)}
            >
              <Share2 className="h-4 w-4" />
              <span>Partilhar</span>
              {!!post.reposts && <span className="tabular-nums text-muted-foreground">{post.reposts}</span>}
            </Button>
          </div>
        </div>
      </Card>

      {/* Modal do post: a publicação e, por baixo, os comentários (com a caixa para comentar). */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto p-0 sm:max-w-xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Publicação de {post.author}</DialogTitle>
            <DialogDescription>A publicação e os comentários.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-5 pr-12">
            {cabecalho(true)}
            {corpo(true)}
            <div className="flex items-center gap-1 border-t border-border/60 pt-3">
              <Button
                variant="ghost"
                size="sm"
                className={cn("gap-2 text-xs", liked && "text-primary")}
                onClick={toggleLike}
              >
                <Hand className={cn("h-4 w-4", liked && "fill-primary")} />
                {likes}
              </Button>
              <span className="inline-flex items-center gap-2 px-3 text-xs text-muted-foreground">
                <MessageCircle className="h-4 w-4" />
                {comentarios} comentário{comentarios === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <div className="border-t border-border/60 bg-surface/40 p-5">
            <PostComments postId={post.id} initialCount={comentarios} modo="modal" onTotalChange={setComentarios} />
          </div>
        </DialogContent>
      </Dialog>

      <ModalPartilha
        aberto={partilhaAberta}
        aoMudar={setPartilhaAberta}
        url={`/comunidade/post/${idPartilha}`}
        titulo={`Publicação de ${autorPartilha} na comunidade EYK`}
        previsualizacao={<PreviaPost autor={autorPartilha} iniciais={iniciaisPartilha} texto={textoPartilha} foto={fotoPartilha} />}
        post={post}
        aoRepostar={onRepostado}
      />
    </>
  );
}

/** A publicação original dentro de um repost. */
function PostOriginal({ original }: { original: NonNullable<Post["repostDe"]> }) {
  if (original.indisponivel) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
        Esta publicação já não está disponível.
      </p>
    );
  }
  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-surface/50 p-4">
      <div className="flex items-center gap-2">
        <Avatar className="h-7 w-7">
          <UserAvatar
            name={original.author ?? ""}
            initials={original.initials ?? "??"}
            foto={original.authorFoto ?? undefined}
            userId={original.authorId ?? undefined}
          />
        </Avatar>
        {original.authorId ? (
          <Link href={`/perfil/${original.authorId}`} className="text-sm font-medium hover:underline underline-offset-2">
            {original.author}
          </Link>
        ) : (
          <span className="text-sm font-medium">{original.author}</span>
        )}
        <span className="text-xs text-muted-foreground">· {original.timeAgo}</span>
      </div>
      {original.content && (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{original.content}</p>
      )}
      {original.imagem && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={original.imagem}
          alt={`Foto publicada por ${original.author}`}
          loading="lazy"
          className="max-h-[480px] w-full rounded-lg bg-surface object-cover"
        />
      )}
    </div>
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
  previsualizacao,
}: {
  url: string;
  titulo?: string;
  className?: string;
  /** Miniatura no modal (ex: capa do vídeo/curso). */
  previsualizacao?: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8 shrink-0", className)}
        onClick={() => setAberto(true)}
        aria-label="Partilhar"
      >
        <Share2 className="h-4 w-4" />
      </Button>
      <ModalPartilha aberto={aberto} aoMudar={setAberto} url={url} titulo={titulo ?? "EYK"} previsualizacao={previsualizacao} />
    </>
  );
}
