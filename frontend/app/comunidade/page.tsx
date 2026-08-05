"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, Send } from "lucide-react";
import { PageHeader, SectionHeader, PostCard, EmptyState } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api, type Post } from "@/lib/api";
import { useAuth } from "@/components/auth-gate";

export default function ComunidadePage() {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadPosts = useCallback(async () => {
    const list = await api.getPosts();
    setPosts(list);
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const submit = async () => {
    if (!text.trim() || submitting) return;
    try {
      setSubmitting(true);
      const newPost = await api.createPost(text.trim());
      setPosts((prev) => [newPost, ...prev]);
      setText("");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLike = async (postId: string) => {
    try {
      const res = await api.reactPost(postId);
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, liked: res.liked, likes: res.likes } : p));
    } catch {
      /* ignora */
    }
  };

  const initials = user?.initials || "?";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Comunidade"
        description="Partilha o teu progresso, tira dúvidas e conecta-te com outros estudantes."
      />

      <Card className="p-5 shadow-soft">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="bg-gradient-gold text-primary-foreground font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-3">
            <Textarea
              placeholder="O que estás a aprender hoje? Partilha com a comunidade..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[90px] resize-none bg-surface"
            />
            <div className="flex justify-end">
              <Button onClick={() => void submit()} disabled={!text.trim() || submitting} className="gap-2">
                <Send className="h-4 w-4" />
                {submitting ? "A publicar…" : "Publicar"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <section>
        <SectionHeader title="Publicações recentes" />
        {posts.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onToggleLike={() => void toggleLike(post.id)} />
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
  );
}
