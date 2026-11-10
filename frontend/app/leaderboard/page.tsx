"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Trophy, Flame, Coins, GraduationCap } from "lucide-react";
import { PageHeader, StatCard, EmptyState } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import { api, type LeaderRow, type ProfessorLeaderRow } from "@/lib/api";
import { LeaderboardComEscola } from "@/components/instituicao/escola";

const medals = [
  "from-yellow-400 to-amber-500",
  "from-slate-300 to-slate-400",
  "from-amber-700 to-amber-800",
];

// Cada tipo de classificação no seu separador, para não ficar tudo misturado.
const SEPARADORES = [
  { id: "posicao", rotulo: "Classificação", icone: Trophy },
  { id: "streak", rotulo: "Streak", icone: Flame },
  { id: "moedas", rotulo: "Moedas", icone: Coins },
] as const;

type Linha = { chave: string; posicao: number; userId: number | null; name: string; initials: string; isMe?: boolean; valor: ReactNode };

function Podio({ rows }: { rows: LeaderRow[] }) {
  const top3 = rows.slice(0, 3);
  return (
    <div className="grid grid-cols-3 items-end justify-items-center gap-4 pt-2 pb-4">
      {[top3[1], top3[0], top3[2]].map((row, idx) => {
        if (!row) return <div key={idx} />;
        const realRank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
        const height = realRank === 1 ? "h-32 sm:h-40" : realRank === 2 ? "h-24 sm:h-32" : "h-20 sm:h-24";
        const medal = medals[realRank - 1];
        return (
          <div key={row.name} className="flex w-full flex-col items-center gap-3">
            <Avatar className="h-14 w-14 shadow-md ring-4 ring-background">
              <UserAvatar
                name={row.name}
                initials={row.initials}
                userId={row.userId ?? undefined}
                size={56}
                noLink
                backgroundColor="transparent"
                className={cn("text-white font-semibold bg-gradient-to-br", medal)}
              />
            </Avatar>
            <div className="text-center">
              <p className="max-w-[140px] truncate font-medium">{row.name}</p>
              <p className="text-xs text-muted-foreground">{row.coins} moedas</p>
            </div>
            <Card
              className={cn(
                "flex w-full flex-col items-center justify-center rounded-2xl border-0 bg-gradient-to-br font-serif font-bold text-white shadow-lg",
                medal,
                height,
              )}
            >
              <span className="text-3xl sm:text-4xl">#{realRank}</span>
            </Card>
          </div>
        );
      })}
    </div>
  );
}

function Lista({ linhas, rotuloValor }: { linhas: Linha[]; rotuloValor: string }) {
  if (linhas.length === 0) {
    return <EmptyState icon={Trophy} title="Ainda não há classificação." description="Participa na plataforma para apareceres aqui." />;
  }
  return (
    <Card className="overflow-hidden shadow-soft">
      <div className="grid grid-cols-[52px_1fr_auto] gap-4 border-b bg-surface/60 px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <div>#</div>
        <div>Nome</div>
        <div className="text-right">{rotuloValor}</div>
      </div>
      <div className="divide-y">
        {linhas.map((l) => (
          <div key={l.chave} className={cn("grid grid-cols-[52px_1fr_auto] items-center gap-4 px-5 py-3.5", l.isMe && "bg-primary/5")}>
            <div className="font-serif font-semibold text-muted-foreground">#{l.posicao}</div>
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="h-9 w-9 shrink-0">
                <UserAvatar
                  noLink
                  name={l.name}
                  initials={l.initials}
                  userId={l.userId ?? undefined}
                  size={36}
                  backgroundColor="transparent"
                  className={cn(l.isMe ? "bg-gradient-gold text-primary-foreground" : "bg-secondary")}
                />
              </Avatar>
              <p className="truncate font-medium">
                {l.name}
                {l.isMe && <span className="ml-2 text-xs text-primary">(tu)</span>}
              </p>
            </div>
            <div className="flex items-center justify-end gap-1 text-sm tabular-nums">{l.valor}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [professores, setProfessores] = useState<ProfessorLeaderRow[]>([]);
  const [meStats, setMeStats] = useState<{ coins: number; streak: number }>({ coins: 0, streak: 0 });

  useEffect(() => {
    let alive = true;
    (async () => {
      const [list, panel, profs] = await Promise.all([
        api.getLeaderboard(),
        api.getDadosGamificacao(),
        api.getLeaderboardProfessores(),
      ]);
      if (!alive) return;
      setRows(list);
      setProfessores(profs);
      setMeStats({ coins: panel.coins, streak: panel.streak });
    })();
    return () => { alive = false; };
  }, []);

  const me = rows.find((r) => r.isMe);

  const porRank: Linha[] = useMemo(
    () => rows.slice(3).map((r) => ({ chave: `${r.rank}-${r.name}`, posicao: r.rank, userId: r.userId, name: r.name, initials: r.initials, isMe: r.isMe, valor: <><Coins className="h-4 w-4 text-primary" />{r.coins}</> })),
    [rows],
  );
  const porStreak: Linha[] = useMemo(
    () => [...rows].sort((a, b) => b.streak - a.streak).map((r, i) => ({ chave: `${r.rank}-${r.name}`, posicao: i + 1, userId: r.userId, name: r.name, initials: r.initials, isMe: r.isMe, valor: <><Flame className="h-4 w-4 text-streak" />{r.streak} dias</> })),
    [rows],
  );
  const porMoedas: Linha[] = useMemo(
    () => [...rows].sort((a, b) => b.coins - a.coins).map((r, i) => ({ chave: `${r.rank}-${r.name}`, posicao: i + 1, userId: r.userId, name: r.name, initials: r.initials, isMe: r.isMe, valor: <><Coins className="h-4 w-4 text-primary" />{r.coins}</> })),
    [rows],
  );
  const dosProfessores: Linha[] = useMemo(
    () => professores.map((r) => ({ chave: `${r.rank}-${r.name}`, posicao: r.rank, userId: r.userId, name: r.name, initials: r.initials, isMe: r.isMe, valor: <><Coins className="h-4 w-4 text-primary" />{r.coins}</> })),
    [professores],
  );

  return (
    <div className="space-y-8">
      <PageHeader title="Leaderboard" description="Competência saudável: vê quem está no topo esta semana." />

      {/* Com escola parceira: classificações da escola e de cada Turma LGA. */}
      <LeaderboardComEscola>
        <Tabs defaultValue="posicao" className="space-y-6">
          <TabsList className="h-auto w-full flex-wrap justify-start bg-surface py-1 sm:w-auto">
            {SEPARADORES.map((s) => (
              <TabsTrigger key={s.id} value={s.id} className="gap-1.5">
                <s.icone className="h-4 w-4" />
                {s.rotulo}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="posicao" className="space-y-6">
            <StatCard icon={Trophy} label="A tua posição" value={me ? `#${me.rank}` : "—"} hint="Continua assim!" />
            <Podio rows={rows} />
            {porRank.length > 0 && <Lista linhas={porRank} rotuloValor="Moedas" />}
          </TabsContent>

          <TabsContent value="streak" className="space-y-6">
            <StatCard icon={Flame} label="O teu streak atual" value={`${meStats.streak} dias`} tone="streak" />
            <Lista linhas={porStreak} rotuloValor="Streak" />
          </TabsContent>

          <TabsContent value="moedas" className="space-y-6">
            <StatCard icon={Coins} label="As tuas moedas EYK" value={meStats.coins} tone="gold" />
            <Lista linhas={porMoedas} rotuloValor="Moedas" />
          </TabsContent>

          
        </Tabs>
      </LeaderboardComEscola>
    </div>
  );
}
