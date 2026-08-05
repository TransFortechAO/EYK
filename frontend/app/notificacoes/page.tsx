"use client";

import { useEffect, useState } from "react";
import { Bell, Coins, BookOpen, Users, Settings, CheckCheck } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api, type Notification } from "@/lib/api";

const icons: Record<Notification["type"], typeof Bell> = {
  gamification: Coins,
  course: BookOpen,
  community: Users,
  system: Settings,
};

const tones: Record<Notification["type"], string> = {
  gamification: "bg-gradient-gold/15 text-primary",
  course: "bg-info/15 text-info",
  community: "bg-success/15 text-success",
  system: "bg-muted text-muted-foreground",
};

export default function NotificacoesPage() {
  const [items, setItems] = useState<Notification[]>([]);

  const load = async () => {
    const list = await api.getNotificacoes();
    setItems(list);
  };

  useEffect(() => { void load(); }, []);

  const markAll = async () => {
    setItems(items.map((n) => ({ ...n, read: true })));
    for (const n of items) {
      if (!n.read) void api.marcarNotificacaoLida(n.id);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Notificações" description="Mantém-te a par das novidades da tua jornada EYK.">
        <Button variant="outline" size="sm" onClick={() => void markAll()} className="gap-2">
          <CheckCheck className="h-4 w-4" />
          Marcar todas como lidas
        </Button>
      </PageHeader>

      {items.length > 0 ? (
        <Card className="divide-y shadow-soft overflow-hidden">
          {items.map((n) => {
            const Icon = icons[n.type];
            return (
              <div
                key={n.id}
                className={cn(
                  "flex items-start gap-4 p-5 transition-colors",
                  !n.read && "bg-surface/50",
                )}
              >
                <div
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                    tones[n.type],
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium leading-tight">{n.title}</p>
                    {!n.read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{n.timeAgo}</p>
                </div>
              </div>
            );
          })}
        </Card>
      ) : (
        <EmptyState
          icon={Bell}
          title="Sem notificações novas."
          description="Vê aqui atualizações sobre cursos, comunidade e gamificação."
        />
      )}
    </div>
  );
}
