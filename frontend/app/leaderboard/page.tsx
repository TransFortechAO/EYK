"use client";

import { Trophy, Flame, Coins } from "lucide-react";
import { PageHeader, StatCard } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { mockLeaderboard, currentUser } from "@/lib/mock-data";

const medals = [
  "from-yellow-400 to-amber-500",
  "from-slate-300 to-slate-400",
  "from-amber-700 to-amber-800",
];

export default function LeaderboardPage() {
  const top3 = mockLeaderboard.slice(0, 3);
  const rest = mockLeaderboard.slice(3);
  const me = mockLeaderboard.find((r) => r.isMe);

  return (
    <div className="space-y-8">
      <PageHeader title="Leaderboard" description="Competência saudável: vê quem está no topo esta semana." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Trophy}
          label="A tua posição"
          value={me ? `#${me.rank}` : "—"}
          hint="Continua assim!"
        />
        <StatCard icon={Coins} label="Moedas EYK" value={currentUser.coins} tone="gold" />
        <StatCard icon={Flame} label="Streak atual" value={`${currentUser.streak} dias`} tone="streak" />
      </div>

      <div className="grid grid-cols-3 items-end justify-items-center gap-4 pt-6 pb-10">
        {[top3[1], top3[0], top3[2]].map((row, idx) => {
          const realRank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
          const height = realRank === 1 ? "h-40" : realRank === 2 ? "h-32" : "h-24";
          const medal = medals[realRank - 1];
          return (
            <div key={row.name} className="flex flex-col items-center gap-3 w-full">
              <Avatar className="h-14 w-14 shadow-md ring-4 ring-background">
                <AvatarFallback
                  className={cn("text-white font-semibold bg-gradient-to-br", medal)}
                >
                  {row.initials}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <p className="font-medium truncate max-w-[140px]">{row.name}</p>
                <p className="text-xs text-muted-foreground">{row.coins} moedas</p>
              </div>
              <Card
                className={cn(
                  "w-full flex flex-col items-center justify-center rounded-2xl border-0 text-white font-serif font-bold shadow-lg bg-gradient-to-br",
                  medal,
                  height,
                )}
              >
                <span className="text-4xl">#{realRank}</span>
              </Card>
            </div>
          );
        })}
      </div>

      <Card className="shadow-soft overflow-hidden">
        <div className="hidden md:grid md:grid-cols-[80px_1fr_120px_120px] gap-4 px-5 py-3 border-b bg-surface/60 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <div>Rank</div>
          <div>Nome</div>
          <div className="text-right">Moedas</div>
          <div className="text-right">Streak</div>
        </div>
        <div className="divide-y">
          {rest.map((row) => (
            <div
              key={row.name}
              className={cn(
                "grid grid-cols-[60px_1fr_auto] md:grid-cols-[80px_1fr_120px_120px] items-center gap-4 px-5 py-4 transition-colors",
                row.isMe && "bg-primary/5",
              )}
            >
              <div className="font-serif font-semibold text-muted-foreground">#{row.rank}</div>
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className={cn(row.isMe ? "bg-gradient-gold text-primary-foreground" : "bg-secondary")}>
                    {row.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {row.name}
                    {row.isMe && <span className="ml-2 text-xs text-primary">(tu)</span>}
                  </p>
                </div>
              </div>
              <div className="hidden md:flex items-center justify-end gap-1 text-sm tabular-nums">
                <Coins className="h-4 w-4 text-primary" />
                {row.coins}
              </div>
              <div className="hidden md:flex items-center justify-end gap-1 text-sm tabular-nums">
                <Flame className="h-4 w-4 text-streak" />
                {row.streak}
              </div>
              <div className="flex md:hidden items-center gap-3 text-sm tabular-nums text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Coins className="h-3.5 w-3.5 text-primary" />{row.coins}</span>
                <span className="inline-flex items-center gap-1"><Flame className="h-3.5 w-3.5 text-streak" />{row.streak}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
