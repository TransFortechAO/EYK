"use client";

import { useState } from "react";
import { Users, Send } from "lucide-react";
import { PageHeader, SectionHeader, PostCard, EmptyState } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { mockPosts } from "@/lib/mock-data";
import { useAuth } from "@/components/auth-gate";

export default function ComunidadePage() {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [posts, setPosts] = useState(mockPosts);

  const submit = () => {
    if (!text.trim()) return;
    const newPost = {
      id: `p${Date.now()}`,
      author: user?.name || "Utilizador",
      initials: user?.initials || "?",
      timeAgo: "agora",
      content: text.trim(),
      likes: 0,
      comments: 0,
      liked: false,
    };
    setPosts([newPost, ...posts]);
    setText("");
  };

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
              {user?.initials || "?"}
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
              <Button onClick={submit} disabled={!text.trim()} className="gap-2">
                <Send className="h-4 w-4" />
                Publicar
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
              <PostCard key={post.id} post={post} />
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
