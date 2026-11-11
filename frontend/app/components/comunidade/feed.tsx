"use client";

import { Fragment, useCallback, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Flame, Users } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PostCard } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { CompositorPost } from "@/components/comunidade/compositor";
import { api, type Post } from "@/lib/api";

/** Entre um curso ou vídeo e o seguinte, 1 a 3 publicações (sorteado uma vez por visita). */
const INTERVALO_MIN = 1;
const INTERVALO_MAX = 3;

/**
 * O feed da Comunidade, agora no Início: compositor e publicações por ordem aleatória (para
 * quem entra não sentir que perdeu nada), com cursos e vídeos pelo meio, um a um e em sítios
 * diferentes a cada visita — nunca todos juntos.
 * `?post=ID` (link partilhado, notificação) abre essa publicação primeiro.
 */
export function FeedComunidade({
  intercalados = [],
  destaques,
  lateral,
}: {
  /** Cursos e vídeos, cada um com a forma de uma publicação. */
  intercalados?: { chave: string; no: ReactNode }[];
  /** O cartão "Em destaque" (um curso e um vídeo). */
  destaques?: ReactNode;
  /** Mais blocos na coluna lateral (ex: professores para seguir). */
  lateral?: ReactNode;
}) {
  const searchParams = useSearchParams();
  const postPartilhado = searchParams.get("post");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [reagindoIds, setReagindoIds] = useState<Set<string>>(new Set());
  // Sorteado uma vez: o feed não salta enquanto a pessoa lê.
  const [intervalos] = useState(() =>
    Array.from({ length: 40 }, () => INTERVALO_MIN + Math.floor(Math.random() * (INTERVALO_MAX - INTERVALO_MIN + 1))),
  );

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

  const lista = posts ?? [];
  // Depois de que publicação entra cada curso ou vídeo.
  const depoisDe = new Map<number, { chave: string; no: ReactNode }[]>();
  let posicao = -1;
  intercalados.forEach((item, n) => {
    posicao += intervalos[n % intervalos.length];
    const i = Math.min(posicao, Math.max(lista.length - 1, 0));
    depoisDe.set(i, [...(depoisDe.get(i) ?? []), item]);
  });

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
            {depoisDe.get(i)?.map((item) => <Fragment key={item.chave}>{item.no}</Fragment>)}
          </Fragment>
        ))}
        {/* Sem publicações, os cursos e vídeos aparecem na mesma. */}
        {posts && lista.length === 0 && intercalados.map((item) => <Fragment key={item.chave}>{item.no}</Fragment>)}
      </div>

      <aside className="hidden space-y-5 computador:block">
        {/* Fica à vista ao descer o feed; se for mais alta que o ecrã, desliza por dentro. */}
        <div className="sticky top-24 max-h-[calc(100dvh-7rem)] space-y-5 overflow-y-auto pb-2">
          {/* Em destaque: só cursos e vídeos (as publicações estão no feed). */}
          {destaques && (
            <Card className="space-y-3 p-4 shadow-soft">
              <h2 className="flex items-center gap-2 font-serif text-lg font-semibold">
                <Flame className="h-4 w-4 text-primary" /> Em destaque
              </h2>
              {destaques}
            </Card>
          )}
          {lateral}
        </div>
      </aside>
    </div>
  );
}
