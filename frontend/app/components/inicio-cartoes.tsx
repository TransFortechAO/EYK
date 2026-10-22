"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Coins, Flame, TrendingUp, Trophy } from "lucide-react";
import { api, type GamePanel, type LeaderRow } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

function CabecalhoCartao({ icone: Icone, titulo, href, cta }: {
  icone: typeof Trophy;
  titulo: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary">
          <Icone className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <h2 className="font-serif text-xl font-semibold text-foreground">{titulo}</h2>
      </div>
      <Link href={href} className="hit inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        {cta}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}

/** Top 3 do ranking de alunos, com a posição de quem está a ver. */
export function CartaoLeaderboard({ className }: { className?: string }) {
  const [linhas, setLinhas] = useState<LeaderRow[] | null>(null);

  useEffect(() => {
    let vivo = true;
    void api.getLeaderboard().then((r) => vivo && setLinhas(r));
    return () => {
      vivo = false;
    };
  }, []);

  const top = (linhas ?? []).slice(0, 3);
  const eu = (linhas ?? []).find((r) => r.isMe);
  const euForaDoTop = eu && !top.some((r) => r.isMe);

  return (
    <Card className={cn("p-5 shadow-soft", className)}>
      <CabecalhoCartao icone={Trophy} titulo="Leaderboard" href="/leaderboard" cta="Ver ranking" />
      {linhas === null ? (
        <p className="py-6 text-center text-sm text-muted-foreground">A carregar…</p>
      ) : top.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Ainda não há ninguém no ranking.</p>
      ) : (
        <ol className="space-y-1">
          {top.map((r) => (
            <li
              key={`${r.rank}-${r.userId}`}
              className={cn("flex items-center gap-3 rounded-xl px-2 py-2", r.isMe && "bg-primary/10")}
            >
              <span className="w-5 text-center text-sm font-semibold tabular-nums text-muted-foreground">{r.rank}</span>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-gold text-xs font-semibold uppercase text-primary-foreground">
                {r.initials}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {r.name}
                {r.isMe && <span className="ml-1.5 text-xs text-primary">(tu)</span>}
              </span>
              <span className="flex items-center gap-1 text-sm font-medium tabular-nums">
                <Coins className="h-3.5 w-3.5 text-primary" aria-hidden />
                {r.coins.toLocaleString("pt-PT")}
              </span>
            </li>
          ))}
          {euForaDoTop && (
            <li className="mt-2 flex items-center gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/10 px-2 py-2">
              <span className="w-5 text-center text-sm font-semibold tabular-nums text-primary">{eu.rank}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">A tua posição</span>
              <span className="flex items-center gap-1 text-sm font-medium tabular-nums">
                <Coins className="h-3.5 w-3.5 text-primary" aria-hidden />
                {eu.coins.toLocaleString("pt-PT")}
              </span>
            </li>
          )}
        </ol>
      )}
    </Card>
  );
}

/** Nível, moedas e sequência de dias de quem está a ver. */
export function CartaoGamificacao({ className }: { className?: string }) {
  const [p, setP] = useState<GamePanel | null>(null);

  useEffect(() => {
    let vivo = true;
    void api.getDadosGamificacao().then((r) => vivo && setP(r));
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <Card className={cn("p-5 shadow-soft", className)}>
      <CabecalhoCartao icone={TrendingUp} titulo="Gamificação" href="/gamificacao" cta="Ver tudo" />
      {p === null ? (
        <p className="py-6 text-center text-sm text-muted-foreground">A carregar…</p>
      ) : (
        <>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Nível {p.level}</span>
            <span className="text-sm font-medium tabular-nums">{p.levelProgress}%</span>
          </div>
          <Progress value={p.levelProgress} className="h-2.5" />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {Math.max(0, p.nextLevelXp - p.xp).toLocaleString("pt-PT")} XP para o nível {p.level + 1}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-surface px-3 py-3">
              <Coins className="mb-1 h-4 w-4 text-primary" aria-hidden />
              <p className="text-lg font-semibold tabular-nums">{p.coins.toLocaleString("pt-PT")}</p>
              <p className="text-xs text-muted-foreground">EYK-coins</p>
            </div>
            <div className="rounded-xl bg-surface px-3 py-3">
              <Flame className="mb-1 h-4 w-4 text-streak" aria-hidden />
              <p className="text-lg font-semibold tabular-nums">{p.streak}</p>
              <p className="text-xs text-muted-foreground">dias seguidos</p>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
