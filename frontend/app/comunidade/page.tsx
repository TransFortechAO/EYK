"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Clock, Flame, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PostCard, EmptyState } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/components/auth-gate";
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

  // Separadores do feed e pesquisa da página (?q=: no topo no computador, aqui no telemóvel/tablet).
  const [separador, setSeparador] = useState<"recentes" | "alta" | "minhas">("recentes");
  const [pesquisa] = usePesquisaPagina();
  const { user } = useAuth();

  const visiveis = useMemo(() => {
    const termo = normalizarTexto(pesquisa.trim());
    let lista = posts.filter(
      (p) => !termo || normalizarTexto(`${p.content} ${p.author} ${p.repostDe?.content ?? ""}`).includes(termo),
    );
    if (separador === "minhas") lista = lista.filter((p) => user?.id != null && p.authorId === user.id);
    if (separador === "alta") lista = [...lista].sort((a, b) => b.likes + b.comments * 2 - (a.likes + a.comments * 2));
    return lista;
  }, [posts, pesquisa, separador, user?.id]);

  // Coluna lateral (computador): publicações em destaque e quem mais participa.
  const destaques = useMemo(
    () => [...posts].filter((p) => p.content).sort((a, b) => b.likes + b.comments - (a.likes + a.comments)).slice(0, 3),
    [posts],
  );
  const ativos = useMemo(() => {
    const contagem = new Map<number, { nome: string; iniciais: string; foto: string | null; total: number }>();
    for (const p of posts) {
      if (p.authorId == null) continue;
      const atual = contagem.get(p.authorId) ?? { nome: p.author, iniciais: p.initials, foto: p.authorFoto, total: 0 };
      atual.total += 1;
      contagem.set(p.authorId, atual);
    }
    return [...contagem.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 5);
  }, [posts]);

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

            <Tabs value={separador} onValueChange={(v) => setSeparador(v as typeof separador)}>
              <TabsList className="w-full bg-surface">
                <TabsTrigger value="recentes" className="flex-1 gap-1.5"><Clock className="h-4 w-4" />Recentes</TabsTrigger>
                <TabsTrigger value="alta" className="flex-1 gap-1.5"><Flame className="h-4 w-4" />Em alta</TabsTrigger>
                <TabsTrigger value="minhas" className="flex-1 gap-1.5"><UserRound className="h-4 w-4" />As minhas</TabsTrigger>
              </TabsList>
            </Tabs>

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
                    : separador === "minhas"
                      ? "Ainda não publicaste nada — partilha o que estás a aprender."
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
              <Card className="space-y-3 p-4 shadow-soft">
                <h2 className="flex items-center gap-2 font-serif text-lg font-semibold">
                  <Users className="h-4 w-4 text-primary" /> Quem mais participa
                </h2>
                <ul className="space-y-2">
                  {ativos.map(([id, a]) => (
                    <li key={id}>
                      <Link href={`/perfil/${id}`} className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-surface">
                        <Avatar className="h-9 w-9">
                          <UserAvatar noLink name={a.nome} initials={a.iniciais} foto={a.foto ?? undefined} userId={id} size={36} />
                        </Avatar>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.nome}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">{a.total}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </aside>
        </div>
      </ComunidadeComEscola>
    </div>
  );
}
