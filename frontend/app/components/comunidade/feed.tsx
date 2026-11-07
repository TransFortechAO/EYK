"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Flame, Users } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PostCard } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { CompositorPost } from "@/components/comunidade/compositor";
import { api, type Post } from "@/lib/api";

/** Depois de quantas publicações entra cada faixa de cursos ou vídeos. */
const POSICOES_FAIXAS = [2, 7, 12, 17];

/**
 * O feed da Comunidade, agora no Início: compositor, publicações por ordem aleatória (para
 * quem entra não sentir que perdeu nada) e, pelo meio, faixas de cursos e vídeos.
 * `?post=ID` (link partilhado, notificação) abre essa publicação primeiro.
 */
export function FeedComunidade({ faixas = [] }: { faixas?: ReactNode[] }) {
  const searchParams = useSearchParams();
  const postPartilhado = searchParams.get("post");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [reagindoIds, setReagindoIds] = useState<Set<string>>(new Set());

  const carregar = useCallback(async () => {
    setPosts(await api.getPosts(postPartilhado));
  }, [postPartilhado]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!postPartilhado || !posts?.length) return;
    document.getElementById(`post-${postPartilhado}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [postPartilhado, posts]);

  const toggleLike = async (postId: string) => {
    // Evita dois pedidos para o mesmo post (duplo clique antes do primeiro responder).
    if (reagindoIds.has(postId)) return;
    setReagindoIds((prev) => new Set(prev).add(postId));
    try {
      const res = await api.reactPost(postId);
      setPosts((prev) => prev?.map((p) => (p.id === postId ? { ...p, liked: res.liked, likes: res.likes } : p)) ?? prev);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível reagir à publicação.");
    } finally {
      setReagindoIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  // Coluna lateral (computador): publicações em destaque.
  const destaques = useMemo(
    () => [...(posts ?? [])].filter((p) => p.content).sort((a, b) => b.likes + b.comments - (a.likes + a.comments)).slice(0, 3),
    [posts],
  );

  const lista = posts ?? [];
  const faixaDepois = (i: number) => {
    const n = POSICOES_FAIXAS.indexOf(i);
    return n >= 0 ? faixas[n] : null;
  };
  // Com poucas publicações, as faixas que sobram ficam no fim.
  const sobra = faixas.filter((_, n) => (POSICOES_FAIXAS[n] ?? Infinity) >= lista.length);

  return (
    <div className="grid gap-8 computador:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="mx-auto w-full min-w-0 max-w-2xl space-y-5">
        <Card className="p-4 shadow-soft">
          <CompositorPost aoPublicar={(novo) => setPosts((prev) => [novo, ...(prev ?? [])])} />
        </Card>

        {posts && lista.length === 0 && (
          <EmptyState icon={Users} title="Ainda não há publicações." description="Sê o primeiro a partilhar algo com a comunidade!" />
        )}
        {lista.map((post, i) => (
          <Fragment key={post.id}>
            <div id={`post-${post.id}`} className={postPartilhado === post.id ? "rounded-2xl ring-2 ring-primary transition-shadow" : undefined}>
              <PostCard
                post={post}
                onToggleLike={() => void toggleLike(post.id)}
                onAutorBloqueado={(userId) => setPosts((prev) => prev?.filter((p) => p.authorId !== userId) ?? prev)}
                onRepostado={(novo) => setPosts((prev) => [novo, ...(prev ?? [])])}
                abrirAoCarregar={postPartilhado === post.id}
              />
            </div>
            {faixaDepois(i)}
          </Fragment>
        ))}
        {posts && sobra}
      </div>

      <aside className="hidden space-y-5 computador:block">
        <div className="sticky top-24 space-y-5">
          <Card className="space-y-3 p-4 shadow-soft">
            <h2 className="flex items-center gap-2 font-serif text-lg font-semibold">
              <Flame className="h-4 w-4 text-primary" /> Em destaque
            </h2>
            {destaques.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda sem destaques.</p>
            ) : (
              <ul className="space-y-3">
                {destaques.map((p) => (
                  <li key={p.id}>
                    <Link href={`/inicio?post=${p.id}`} scroll={false} className="block rounded-lg p-2 transition-colors hover:bg-surface">
                      <p className="line-clamp-2 text-sm">{p.content}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.author} · {p.likes} gosto{p.likes === 1 ? "" : "s"} · {p.comments} comentário{p.comments === 1 ? "" : "s"}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </aside>
    </div>
  );
}
