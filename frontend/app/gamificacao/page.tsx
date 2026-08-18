"use client";

import { useEffect, useState } from "react";
import { Coins, Flame, Target, TrendingUp, Award, History, Sparkles, Zap, Compass, MessageCircle, GraduationCap, Heart, PlayCircle, Trophy } from "lucide-react";
import { PageHeader, StatCard } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { api, type Badge, type WalletEntry, type GamePanel } from "@/lib/api";
import {UserAvatar,UserInitialsLink } from "@/components/UserAvatar";

const badgeIcons: Record<string, typeof Sparkles> = {
  Flame,
  Compass,
  MessageCircle,
  Zap,
  GraduationCap,
  Heart,
  PlayCircle,
  Trophy,
  Crown: Trophy,
  Award,
  Calendar: Target,
  Users: MessageCircle,
  Coins,
};

export default function GamificacaoPage() {
  const [panel, setPanel] = useState<GamePanel | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [wallet, setWallet] = useState<WalletEntry[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [p, b, w] = await Promise.all([
        api.getDadosGamificacao(),
        api.getBadges(),
        api.getCarteira(),
      ]);
      if (!alive) return;
      setPanel(p);
      setBadges(b);
      setWallet(w);
    })();
    return () => { alive = false; };
  }, []);

  const p = panel || { coins: 0, streak: 0, streakRecord: 0, level: 1, levelProgress: 0, nextLevelCoins: 500, initials: "?", name: "Estudante" };
  const xpNeeded = Math.max(0, p.nextLevelCoins - p.coins);

  return (
    <div className="space-y-8">
      <PageHeader title="Gamificação" description="Conquistas, moedas e progresso — acompanha a tua jornada." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Coins} label="Moedas EYK" value={p.coins} tone="gold" />
        <StatCard icon={Flame} label="Streak atual" value={`${p.streak} dias`} tone="streak" />
        <StatCard icon={Target} label="Recorde streak" value={`${p.streakRecord} dias`} />
        <StatCard icon={TrendingUp} label="Nível atual" value={`Nível ${p.level}`} tone="success" />
      </div>

      <Card className="p-6 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-end gap-6">
          <Avatar className="h-20 w-20 shrink-0 shadow-md">
            {/* <AvatarFallback className="text-2xl bg-gradient-gold text-primary-foreground font-serif font-bold">
              {p.initials}
            </AvatarFallback> */}
            <UserAvatar
            className="text-2xl bg-gradient-gold text-primary-foreground font-serif font-bold"
            name={p.name}
            initials={p.initials}
            />
          </Avatar>
          <div className="flex-1 space-y-2">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <p className="font-serif text-2xl font-semibold">Olá, {p.name} 👋</p>
                <p className="text-sm text-muted-foreground">
                  Faltam {xpNeeded} moedas para chegares ao Nível {p.level + 1}.
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Progresso nível {p.level}
                </p>
                <p className="font-serif text-2xl font-semibold tabular-nums">
                  {p.levelProgress}%
                </p>
              </div>
            </div>
            <Progress value={p.levelProgress} className="h-2.5" />
          </div>
        </div>
      </Card>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-semibold flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          Conquistas
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {badges.map((badge) => {
            const Icon = badgeIcons[badge.icon] || Sparkles;
            return (
              <Card
                key={badge.id}
                className={cn(
                  "p-5 shadow-soft relative overflow-hidden transition-all",
                  !badge.earned && "opacity-80",
                )}
              >
                <div
                  className={cn(
                    "grid h-14 w-14 place-items-center rounded-2xl mb-3",
                    badge.earned ? "bg-gradient-gold text-primary-foreground shadow-gold" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="h-7 w-7" />
                </div>
                <p className="font-semibold">
                  {badge.name}
                  {badge.earned && <Sparkles className="ml-2 inline h-4 w-4 text-primary" />}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{badge.description}</p>
                {!badge.earned && typeof badge.progress === "number" && (
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progresso</span>
                      <span className="tabular-nums">{badge.progress}%</span>
                    </div>
                    <Progress value={badge.progress} className="h-1.5" />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-semibold flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Histórico de moedas
        </h2>
        <Card className="shadow-soft overflow-hidden">
          <div className="divide-y">
            {wallet.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{entry.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{entry.date}</p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 shrink-0 font-semibold tabular-nums",
                    entry.delta > 0 ? "text-success" : "text-destructive",
                  )}
                >
                  <Coins className="h-4 w-4" />
                  {entry.delta > 0 ? "+" : ""}
                  {entry.delta}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
