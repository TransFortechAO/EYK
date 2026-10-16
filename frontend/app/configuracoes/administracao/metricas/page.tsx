"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Activity,
  GraduationCap,
  Clock,
  Star,
  RefreshCw,
  BookOpen,
  PlayCircle,
  MailWarning,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader, StatCard } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-gate";
import { api, mensagemDeErro, type MetricasPlataforma, type SerieSemanal } from "@/lib/api";

// Dourado da marca em degraus validados para gráficos (contraste ≥ 3:1 e
// banda de luminosidade): claro sobre branco, escuro sobre a superfície escura.
const VIZ_VARS = "[--viz-1:#ad7a14] dark:[--viz-1:#be8a22]";

function rotuloSemana(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
}

function TooltipSemana({
  active,
  payload,
  unidade,
}: {
  active?: boolean;
  payload?: { payload: { semana: string; n: number } }[];
  unidade: string;
}) {
  if (!active || !payload?.length) return null;
  const { semana, n } = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-elevated">
      <p className="text-muted-foreground">Semana de {rotuloSemana(semana)}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-foreground">
        {n} {unidade}
      </p>
    </div>
  );
}

/** Um gráfico de barras semanal (small multiple): uma só série, o título nomeia-a. */
function GraficoSemanal({ titulo, unidade, serie }: { titulo: string; unidade: string; serie: SerieSemanal }) {
  const total = serie.reduce((acc, p) => acc + p.n, 0);
  const ultima = serie[serie.length - 1]?.n ?? 0;
  return (
    <Card className="p-5 shadow-soft">
      <div className="mb-3 space-y-0.5">
        <p className="text-sm font-medium">{titulo}</p>
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{ultima}</span> esta semana · {total} em 12 sem.
        </p>
      </div>
      <div
        className={`h-44 ${VIZ_VARS}`}
        role="img"
        aria-label={`${titulo}: ${serie.map((p) => `semana de ${rotuloSemana(p.semana)}, ${p.n}`).join("; ")}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={serie} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="semana"
              tickFormatter={rotuloSemana}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              content={<TooltipSemana unidade={unidade} />}
            />
            <Bar dataKey="n" fill="var(--viz-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function Percentagem({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-muted-foreground">—</span>;
  return (
    <div className={`flex items-center gap-2 ${VIZ_VARS}`}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full" style={{ width: `${valor}%`, background: "var(--viz-1)" }} />
      </div>
      <span className="tabular-nums">{valor}%</span>
    </div>
  );
}

export default function AdminMetricasPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [dados, setDados] = useState<MetricasPlataforma | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aCarregar, setACarregar] = useState(true);

  useEffect(() => {
    if (user && !user.isStaff) router.replace("/inicio");
  }, [user, router]);

  const carregar = async () => {
    setACarregar(true);
    setErro(null);
    try {
      setDados(await api.admin.getMetricas());
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível carregar as métricas."));
    } finally {
      setACarregar(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  if (aCarregar && !dados) {
    return <div className="py-24 text-center text-muted-foreground">A carregar métricas…</div>;
  }
  if (!dados) {
    return (
      <div className="py-24 text-center">
        <p className="text-muted-foreground">{erro}</p>
        <Button variant="outline" className="mt-4" onClick={() => void carregar()}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  const { totais, ativos } = dados;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader title="Métricas da plataforma" description="Crescimento, atividade, retenção e conteúdos mais vistos." />
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void carregar()} disabled={aCarregar}>
          <RefreshCw className={aCarregar ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Utilizadores"
          value={totais.utilizadores.toLocaleString("pt-PT")}
          hint={`${totais.alunos} aluno${totais.alunos === 1 ? "" : "s"} · ${totais.professores} professor${totais.professores === 1 ? "" : "es"}`}
          tone="gold"
        />
        <StatCard
          icon={Activity}
          label="Ativos (7 dias)"
          value={ativos.semana.toLocaleString("pt-PT")}
          hint={`${ativos.hoje} nas últimas 24h · ${ativos.mes} em 30 dias`}
        />
        <StatCard
          icon={RefreshCw}
          label="Retenção a 30 dias"
          value={ativos.retencao30d === null ? "—" : `${ativos.retencao30d}%`}
          hint="contas com +30 dias ainda ativas"
        />
        <StatCard
          icon={GraduationCap}
          label="Taxa de conclusão"
          value={`${totais.taxaConclusao}%`}
          hint={`${totais.conclusoes} de ${totais.inscricoes} inscrições`}
          tone="success"
        />
        <StatCard icon={BookOpen} label="Cursos ativos" value={totais.cursos} />
        <StatCard icon={PlayCircle} label="Vídeos ativos" value={totais.videos} />
        <StatCard
          icon={Star}
          label="Avaliação média"
          value={totais.mediaAvaliacoes === null ? "—" : totais.mediaAvaliacoes.toFixed(1)}
          hint={`${totais.avaliacoes} avaliações de cursos`}
        />
        <StatCard
          icon={MailWarning}
          label="Emails por confirmar"
          value={totais.emailsPorVerificar}
          hint="contas sem email verificado"
        />
      </div>

      <section className="space-y-3">
        <h2 className="font-serif text-xl font-semibold">Crescimento semanal</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <GraficoSemanal titulo="Novos utilizadores" unidade="registos" serie={dados.crescimento.utilizadores} />
          <GraficoSemanal titulo="Inscrições em cursos" unidade="inscrições" serie={dados.crescimento.inscricoes} />
          <GraficoSemanal titulo="Cursos concluídos" unidade="conclusões" serie={dados.crescimento.conclusoes} />
        </div>
      </section>

      <Card className="p-5 shadow-soft">
        <p className="font-serif text-lg font-semibold">Retenção por semana de registo</p>
        <p className="mb-4 text-xs text-muted-foreground">
          Dos utilizadores que se registaram em cada semana, quantos estiveram ativos nos últimos 7 dias (login, aulas
          vistas ou progresso num vídeo).
        </p>
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="min-w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-4 text-left font-medium">Semana</th>
                <th className="py-2 pr-4 text-left font-medium">Novos</th>
                <th className="py-2 pr-4 text-left font-medium">Ativos (7 dias)</th>
                <th className="py-2 text-left font-medium">Retenção</th>
              </tr>
            </thead>
            <tbody>
              {[...dados.coortes].reverse().map((c) => (
                <tr key={c.semana}>
                  <td className="rounded-l-xl bg-surface/40 py-2 pl-3 pr-4">{rotuloSemana(c.semana)}</td>
                  <td className="bg-surface/40 py-2 pr-4 tabular-nums">{c.novos}</td>
                  <td className="bg-surface/40 py-2 pr-4 tabular-nums">{c.ativos7d}</td>
                  <td className="rounded-r-xl bg-surface/40 py-2 pr-3">
                    <Percentagem valor={c.taxa} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5 shadow-soft">
          <p className="mb-4 font-serif text-lg font-semibold">Cursos com mais inscritos</p>
          {dados.topCursos.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Ainda não há inscrições.</p>
          ) : (
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-4 text-left font-medium">Curso</th>
                    <th className="py-2 pr-4 text-left font-medium">Inscritos</th>
                    <th className="py-2 pr-4 text-left font-medium">Conclusão</th>
                    <th className="py-2 text-left font-medium">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.topCursos.map((c) => (
                    <tr key={c.id}>
                      <td className="rounded-l-xl bg-surface/40 py-2 pl-3 pr-4">
                        <Link href={`/cursos/${c.id}`} className="font-medium hover:underline underline-offset-2">
                          {c.titulo}
                        </Link>
                        <p className="text-xs text-muted-foreground">{c.professor}</p>
                      </td>
                      <td className="bg-surface/40 py-2 pr-4 tabular-nums">{c.inscritos}</td>
                      <td className="bg-surface/40 py-2 pr-4">
                        <Percentagem valor={c.taxaConclusao} />
                      </td>
                      <td className="rounded-r-xl bg-surface/40 py-2 pr-3 tabular-nums">
                        {c.mediaAvaliacoes === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                            {c.mediaAvaliacoes.toFixed(1)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-5 shadow-soft">
          <p className="mb-4 font-serif text-lg font-semibold">Vídeos mais vistos</p>
          {dados.topVideos.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Ainda não há visualizações.</p>
          ) : (
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-4 text-left font-medium">Vídeo</th>
                    <th className="py-2 pr-4 text-left font-medium">Views</th>
                    <th className="py-2 text-left font-medium">Espectadores</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.topVideos.map((v) => (
                    <tr key={v.id}>
                      <td className="rounded-l-xl bg-surface/40 py-2 pl-3 pr-4">
                        <Link
                          href={v.cursoId ? `/cursos/${v.cursoId}` : `/videos/${v.id}`}
                          className="font-medium hover:underline underline-offset-2"
                        >
                          {v.titulo}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {v.professor}
                          {v.curso ? ` · ${v.curso}` : ""}
                        </p>
                      </td>
                      <td className="bg-surface/40 py-2 pr-4 tabular-nums">{v.views.toLocaleString("pt-PT")}</td>
                      <td className="rounded-r-xl bg-surface/40 py-2 pr-3 tabular-nums">{v.espectadores}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Atualizado às {new Date(dados.geradoEm).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}.
        Contas de administração não entram nas contagens.
      </p>
    </div>
  );
}
