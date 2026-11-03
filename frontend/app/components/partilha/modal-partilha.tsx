"use client";

import { useState, type ReactNode } from "react";
import {
  Check,
  Facebook,
  Link as LinkIcon,
  Linkedin,
  Mail,
  MessageCircle,
  Repeat2,
  Send,
  Share2,
  Twitter,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api, mensagemDeErro, type Post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Pré-visualização de um vídeo ou curso no modal: a capa da plataforma com o título. */
export function PreviaConteudo({
  capa,
  titulo,
  rotulo,
  autor,
}: {
  capa: string;
  titulo: string;
  rotulo: string;
  autor?: string;
}) {
  return (
    <div
      className="relative aspect-[1200/630] w-full"
      style={{ background: capa }}
    >
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 text-white">
        <span className="mb-1 w-fit rounded-full bg-background/90 px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
          {rotulo}
        </span>
        <p className="line-clamp-2 font-serif text-lg font-semibold leading-snug">
          {titulo}
        </p>
        {autor && <p className="text-xs text-white/80">{autor}</p>}
      </div>
    </div>
  );
}

/** Pré-visualização de uma publicação: cartão com as cores da EYK (igual à imagem partilhada). */
export function PreviaPost({
  autor,
  iniciais,
  texto,
}: {
  autor: string;
  iniciais: string;
  texto: string;
}) {
  return (
    <div className="bg-gradient-gold p-4">
      <div className="space-y-2 rounded-xl bg-[#FBF6EC] p-4 text-[#1F1A12] shadow-soft">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-gold text-xs font-bold text-white">
            {iniciais}
          </span>
          <span className="text-sm font-semibold">{autor}</span>
          <span className="text-xs text-[#7A6A4F]">· comunidade EYK</span>
        </div>
        <p className="line-clamp-3 text-sm leading-relaxed">
          {texto || "Uma publicação na comunidade EYK"}
        </p>
      </div>
    </div>
  );
}

type Destino = {
  nome: string;
  icone: LucideIcon;
  cor: string;
  href: (url: string, texto: string) => string;
};

const DESTINOS: Destino[] = [
  {
    nome: "WhatsApp",
    icone: MessageCircle,
    cor: "bg-[#25D366] text-white",
    href: (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}`,
  },
  {
    nome: "Facebook",
    icone: Facebook,
    cor: "bg-[#1877F2] text-white",
    href: (u) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`,
  },
  {
    nome: "X",
    icone: Twitter,
    cor: "bg-black text-white dark:bg-white dark:text-black",
    href: (u, t) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`,
  },
  {
    nome: "LinkedIn",
    icone: Linkedin,
    cor: "bg-[#0A66C2] text-white",
    href: (u) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}`,
  },
  {
    nome: "Telegram",
    icone: Send,
    cor: "bg-[#229ED9] text-white",
    href: (u, t) =>
      `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`,
  },
  {
    nome: "Email",
    icone: Mail,
    cor: "bg-primary text-primary-foreground",
    href: (u, t) =>
      `mailto:?subject=${encodeURIComponent(t)}&body=${encodeURIComponent(`${t}\n\n${u}`)}`,
  },
];

/**
 * Modal de partilha: redes sociais, email, copiar link e (nas publicações da
 * comunidade) repostar. A pré-visualização nas redes vem das etiquetas Open
 * Graph de cada página (ver lib/partilha-servidor.ts).
 */
export function ModalPartilha({
  aberto,
  aoMudar,
  url,
  titulo,
  previsualizacao,
  post,
  aoRepostar,
}: {
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
  /** Caminho na plataforma (ex: "/videos/3"). */
  url: string;
  titulo: string;
  /** Miniatura do que se partilha (capa do vídeo/curso ou cartão do post). */
  previsualizacao?: ReactNode;
  /** Publicação da comunidade: mostra também "Repostar". */
  post?: Post;
  aoRepostar?: (novo: Post) => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const [aRepostar, setARepostar] = useState(false);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);

  const absoluta = () =>
    url.startsWith("http") ? url : `${window.location.origin}${url}`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(absoluta());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const partilhaNativa =
    typeof navigator !== "undefined" && typeof navigator.share === "function";
  const maisOpcoes = async () => {
    try {
      await navigator.share({ url: absoluta(), title: titulo });
    } catch {
      /* cancelado */
    }
  };

  const repostar = async () => {
    if (!post || enviando) return;
    setEnviando(true);
    try {
      const novo = await api.repostar(
        post.repostDe?.id ?? post.id,
        comentario.trim(),
      );
      toast.success("Publicação repostada na comunidade.");
      aoRepostar?.(novo);
      setComentario("");
      setARepostar(false);
      aoMudar(false);
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível repostar."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        aoMudar(v);
        if (!v) setARepostar(false);
      }}
    >
      <DialogContent className="max-h-[90dvh] sm:max-w-md">
        <DialogHeader className="flex-col items-start gap-0.5">
          <DialogTitle className="font-serif text-2xl">Partilhar</DialogTitle>
          <DialogDescription className="line-clamp-1">
            {titulo}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto p-5">
          {previsualizacao && (
            <div className="overflow-hidden rounded-2xl border border-border/70">
              {previsualizacao}
            </div>
          )}

          {post && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
              {aRepostar ? (
                <div className="space-y-2">
                  <Textarea
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    placeholder="Acrescenta um comentário (opcional)…"
                    rows={2}
                    className="resize-none bg-background text-sm"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setARepostar(false)}
                      disabled={enviando}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => void repostar()}
                      disabled={enviando}
                    >
                      <Repeat2 className="h-4 w-4" />
                      {enviando ? "A repostar…" : "Repostar"}
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setARepostar(true)}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Repeat2 className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">
                      Repostar na comunidade
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Partilha esta publicação no teu perfil, com um comentário
                      se quiseres.
                    </span>
                  </span>
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-4 gap-3">
            {DESTINOS.map((d) => (
              <a
                key={d.nome}
                href={d.href(
                  typeof window === "undefined" ? url : absoluta(),
                  titulo,
                )}
                target={d.nome === "Email" ? undefined : "_blank"}
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 rounded-xl p-1.5 text-xs font-medium transition-colors hover:bg-surface"
              >
                <span
                  className={cn(
                    "grid h-12 w-12 place-items-center rounded-full shadow-soft",
                    d.cor,
                  )}
                >
                  <d.icone className="h-5 w-5" />
                </span>
                {d.nome}
              </a>
            ))}
            <button
              type="button"
              onClick={() => void copiar()}
              className="flex flex-col items-center gap-1.5 rounded-xl p-1.5 text-xs font-medium transition-colors hover:bg-surface"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-surface text-foreground shadow-soft ring-1 ring-border">
                {copiado ? (
                  <Check className="h-5 w-5 text-primary" />
                ) : (
                  <LinkIcon className="h-5 w-5" />
                )}
              </span>
              {copiado ? "Copiado!" : "Copiar link"}
            </button>
            {partilhaNativa && (
              <button
                type="button"
                onClick={() => void maisOpcoes()}
                className="flex flex-col items-center gap-1.5 rounded-xl p-1.5 text-xs font-medium transition-colors hover:bg-surface"
              >
                <span className="grid h-12 w-12 place-items-center rounded-full bg-surface text-foreground shadow-soft ring-1 ring-border">
                  <Share2 className="h-5 w-5" />
                </span>
                Mais opções
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
