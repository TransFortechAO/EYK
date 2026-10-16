"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Video, Users, Eye, Sparkles, Shield, User2, Coins } from "lucide-react";
import { PageHeader, StatCard } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { api, tempoRelativo, type ProfessorCurso, type ProfessorVideo, type ProfessorLeaderRow } from "@/lib/api";

type AtividadeItem = {
  id: string;
  tipo: "curso" | "video";
  titulo: string;
  visualizacoes: number;
  criadoEm: string;
  href: string;
};

export default function ProfessorDashboardPage() {
  const [cursos, setCursos] = useState<ProfessorCurso[]>([]);
  const [videos, setVideos] = useState<ProfessorVideo[]>([]);
  const [ranking, setRanking] = useState<ProfessorLeaderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [c, v, r] = await Promise.all([
        api.professor.getCursos(),
        api.professor.getVideos(),
        api.getLeaderboardProfessores(),
      ]);
      if (!alive) return;
      setCursos(c);
      setVideos(v);
      setRanking(r);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const totalAlunos = cursos.reduce((acc, c) => acc + c.total_inscritos, 0);
  const totalVisualizacoes =
    cursos.reduce((acc, c) => acc + c.total_visualizacoes, 0) +
    videos.reduce((acc, v) => acc + v.total_visualizacoes, 0);
  const totalPublicados = cursos.filter((c) => c.ativo).length + videos.filter((v) => v.ativo).length;

  const atividade: AtividadeItem[] = [
    ...cursos.map((c) => ({
      id: `curso-${c.id}`,
      tipo: "curso" as const,
      titulo: c.titulo,
      visualizacoes: c.total_visualizacoes,
      criadoEm: c.criado_em,
      href: `/professor/cursos/${c.id}`,
    })),
    ...videos.map((v) => ({
      id: `video-${v.id}`,
      tipo: "video" as const,
      titulo: v.titulo,
      visualizacoes: v.total_visualizacoes,
      criadoEm: v.criado_em,
      href: `/professor/videos/${v.id}`,
    })),
  ]
    .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <PageHeader title="Painel do Professor" description="Gere o teu perfil público, cursos e vídeos." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Alunos" value={totalAlunos} hint="inscritos nos teus cursos" tone="gold" />
        <StatCard icon={Eye} label="Visualizações" value={totalVisualizacoes} hint="cursos + vídeos" />
        <StatCard icon={Sparkles} label="Publicados" value={totalPublicados} hint="conteúdos ativos" tone="success" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/professor/perfil">
          <Card className="p-5 shadow-soft hover:shadow-elevated transition-shadow cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/15 text-violet-300">
                <User2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Perfil do Professor</p>
                <p className="text-xs text-muted-foreground">Biografia, área de atuação e nome público</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/professor/cursos">
          <Card className="p-5 shadow-soft hover:shadow-elevated transition-shadow cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15 text-amber-300">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Meus Cursos</p>
                <p className="text-xs text-muted-foreground">Criar, editar e ver engajamento</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/professor/videos">
          <Card className="p-5 shadow-soft hover:shadow-elevated transition-shadow cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-500/15 text-sky-300">
                <Video className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Meus Vídeos</p>
                <p className="text-xs text-muted-foreground">Publicar e gerir vídeos</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/configuracoes">
          <Card className="p-5 shadow-soft hover:shadow-elevated transition-shadow cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Segurança da conta</p>
                <p className="text-xs text-muted-foreground">Palavra-passe, 2FA, apagar conta</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {ranking.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="font-serif text-xl font-semibold">Ranking mensal de professores</h2>
            <p className="text-sm text-muted-foreground">
              Moedas ganhas este mês com visualizações — a cada 20 views geras 30 moedas.
            </p>
          </div>
          <Card className="shadow-soft overflow-hidden">
            <div className="divide-y">
              {ranking.map((row) => (
                <div
                  key={row.userId ?? row.rank}
                  className={cn(
                    "flex items-center justify-between gap-4 px-5 py-3",
                    row.isMe && "bg-primary/5",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                      {row.rank}
                    </span>
                    <p className="font-medium">
                      {row.name}
                      {row.isMe && <Badge variant="outline" className="ml-2 text-xs">Tu</Badge>}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium tabular-nums">
                    <Coins className="h-4 w-4 text-primary" /> {row.coins}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-semibold">Atividade recente</h2>
        {loading ? (
          <Card className="p-10 text-center text-muted-foreground shadow-soft">A carregar…</Card>
        ) : atividade.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground shadow-soft">
            Ainda não tens cursos nem vídeos publicados.
          </Card>
        ) : (
          <Card className="shadow-soft overflow-hidden">
            <div className="divide-y">
              {atividade.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-surface/60"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                      {item.tipo === "curso" ? <BookOpen className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.titulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.tipo === "curso" ? "Curso" : "Vídeo"} · criado {tempoRelativo(item.criadoEm)}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <Eye className="h-3.5 w-3.5" /> {item.visualizacoes}
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
