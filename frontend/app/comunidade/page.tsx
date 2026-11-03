"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionHeader, PostCard, EmptyState } from "@/components/eyk";
import { Card } from "@/components/ui/card";
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
    const list = await api.getPosts();
    setPosts(list);
  }, []);

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

  return (
    <div className="space-y-8">
      <PageHeader
        title="Comunidade"
        description="Partilha o teu progresso, tira dúvidas e conecta-te com outros estudantes."
      />

      {/* Com escola parceira: separadores para a comunidade de cada Turma LGA. */}
      <ComunidadeComEscola>
        <div className="space-y-8">
          {/* Só o campo; ao clicar abre o cartão para escrever a publicação. */}
          <Card className="p-4 shadow-soft">
            <CompositorPost aoPublicar={(novo) => setPosts((prev) => [novo, ...prev])} />
          </Card>

          <section>
            <SectionHeader title="Publicações recentes" />
            {posts.length > 0 ? (
              <div className="grid gap-5 md:grid-cols-2">
                {posts.map((post) => (
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
                title="Ainda não há publicações."
                description="Sê o primeiro a partilhar algo com a comunidade!"
              />
            )}
          </section>
        </div>
      </ComunidadeComEscola>
    </div>
  );
}
