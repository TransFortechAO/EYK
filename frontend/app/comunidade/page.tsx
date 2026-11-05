"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Flame, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PostCard, EmptyState } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { CampoPesquisaPagina, usePesquisaPagina } from "@/components/pesquisa-pagina";
import { normalizarTexto } from "@/components/filtros/barra-filtros";
import { api, type Post } from "@/lib/api";
import { ComunidadeComEscola } from "@/components/instituicao/escola";
import { CompositorPost } from "@/components/comunidade/compositor";

export default function ComunidadePage() {
  return (
    <Suspense fallback={null}>
      <ComunidadeConteudo />
    </Suspense>
  );
}

function ComunidadeConteudo() {
  const searchParams = useSearchParams();
  const postPartilhado = searchParams.get("post");
  const [posts, setPosts] = useState<Post[]>([]);
  const [reagindoIds, setReagindoIds] = useState<Set<string>>(new Set());

  const loadPosts = useCallback(async () => {
    const list = await api.getPosts(postPartilhado);
    setPosts(list);
  }, [postPartilhado]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (!postPartilhado || posts.length === 0) return;
    const alvo = document.getElementById(`post-${postPartilhado}`);
    if (alvo) {
      alvo.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [postPartilhado, posts]);

  const toggleLike = async (postId: string) => {
    // Evita disparar dois pedidos para o mesmo post (ex: duplo clique antes
    // do primeiro responder), que podia dar erro 500 por violar a restrição
    // de reação única por utilizador.
    if (reagindoIds.has(postId)) return;
    setReagindoIds((prev) => new Set(prev).add(postId));
    try {
      const res = await api.reactPost(postId);

      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                liked: res.liked,
                likes: res.likes,
              }
            : post
        )
      );
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

  // Pesquisa da página (?q=): no topo no computador, aqui no telemóvel/tablet.
  const [pesquisa] = usePesquisaPagina();

  const visiveis = useMemo(() => {
    const termo = normalizarTexto(pesquisa.trim());
    return posts.filter(
      (p) => !termo || normalizarTexto(`${p.content} ${p.author} ${p.repostDe?.content ?? ""}`).includes(termo),
    );
  }, [posts, pesquisa]);

  // Coluna lateral (computador): publicações em destaque.
  const destaques = useMemo(
    () => [...posts].filter((p) => p.content).sort((a, b) => b.likes + b.comments - (a.likes + a.comments)).slice(0, 3),
    [posts],
  );
  return (
    <div className="space-y-6">
      <PageHeader
        title="Comunidade"
        description="Partilha o teu progresso, tira dúvidas e conecta-te com outros estudantes."
      />

      {/* Com escola parceira: separadores para a comunidade de cada Turma LGA. */}
      <ComunidadeComEscola>
        <div className="grid gap-8 computador:grid-cols-[minmax(0,1fr)_18rem]">
          {/* Feed: uma coluna, como numa rede social. */}
          <div className="mx-auto w-full max-w-2xl space-y-5">
            <CampoPesquisaPagina className="computador:hidden" />

            {/* Só o campo; ao clicar abre o cartão para escrever a publicação. */}
            <Card className="p-4 shadow-soft">
              <CompositorPost aoPublicar={(novo) => setPosts((prev) => [novo, ...prev])} />
            </Card>

            {visiveis.length > 0 ? (
              <div className="space-y-5">
                {visiveis.map((post) => (
                  <div
                    key={post.id}
                    id={`post-${post.id}`}
                    className={
                      postPartilhado === post.id
                        ? "rounded-2xl ring-2 ring-primary transition-shadow"
                        : undefined
                    }
                  >
                    <PostCard
                      post={post}
                      onToggleLike={() => void toggleLike(post.id)}
                      onAutorBloqueado={(userId) => setPosts((prev) => prev.filter((p) => p.authorId !== userId))}
                      onRepostado={(novo) => setPosts((prev) => [novo, ...prev])}
                      abrirAoCarregar={postPartilhado === post.id}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Users}
                title={posts.length === 0 ? "Ainda não há publicações." : "Nada encontrado aqui."}
                description={
                  posts.length === 0
                    ? "Sê o primeiro a partilhar algo com a comunidade!"
                    : "Tenta outra pesquisa."
                }
              />
            )}
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
                        <Link href={`/comunidade?post=${p.id}`} scroll={false} className="block rounded-lg p-2 transition-colors hover:bg-surface">
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
      </ComunidadeComEscola>
    </div>
  );
}
