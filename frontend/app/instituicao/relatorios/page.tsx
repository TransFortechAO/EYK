"use client";

import { useState } from "react";
import { Activity, CalendarCheck, EyeOff, Mail, Megaphone, RefreshCw, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { StatCard } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Exige, useInstituicaoAtual } from "@/components/instituicao/contexto";
import { Carregando, celula, ErroCarregar, hora, Tabela, useCarregar } from "@/components/instituicao/ui";
import { apiInstituicoes as api, LIMITE_ANONIMATO } from "@/lib/instituicoes/api";
import { PAPEIS, ROTULO_PAPEL } from "@/lib/instituicoes/permissoes";

// Os mesmos degraus de dourado validados para gráficos que as métricas da plataforma usam.
const VIZ_VARS = "[--viz-1:#ad7a14] dark:[--viz-1:#be8a22]";

function rotuloSemana(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
}

function TooltipSemana({ active, payload }: { active?: boolean; payload?: { payload: { semana: string; n: number } }[] }) {
  if (!active || !payload?.length) return null;
  const { semana, n } = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-elevated">
      <p className="text-muted-foreground">Semana de {rotuloSemana(semana)}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-foreground">{n} acessos</p>
    </div>
  );
}

export default function RelatoriosPage() {
  const { instituicaoId, pode, papel } = useInstituicaoAtual();
  const [resumoEmail, setResumoEmail] = useState(false);
  const { dados, erro, aCarregar, recarregar } = useCarregar(() => api.relatorio(instituicaoId), [instituicaoId]);

  return (
    <Exige permitido={pode("ver_relatorios")}>
      {aCarregar && !dados ? (
        <Carregando />
      ) : !dados ? (
        <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />
      ) : (
        <div className="space-y-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-serif text-2xl font-semibold">Relatório de utilização</h2>
              <p className="text-sm text-muted-foreground">
                Indicadores por instituição e por grupo — nunca por criança. Calculado periodicamente a partir dos registos de
                atividade.
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void recarregar()} disabled={aCarregar}>
              <RefreshCw className={aCarregar ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Atualizar
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Utilizadores" value={dados.utilizadores.total} hint="pessoas e crianças com perfil" tone="gold" />
            <StatCard
              icon={Activity}
              label="Ativos (30 dias)"
              value={dados.utilizadores.ativos30d}
              hint={dados.utilizadores.total ? `${Math.round((dados.utilizadores.ativos30d / dados.utilizadores.total) * 100)}% do total` : undefined}
            />
            <StatCard
              icon={Megaphone}
              label="Avisos lidos"
              value={dados.avisos.taxaLeitura === null ? "—" : `${dados.avisos.taxaLeitura}%`}
              hint={`${dados.avisos.publicados} avisos publicados`}
            />
            <StatCard icon={CalendarCheck} label="Eventos" value={dados.eventos.criados} hint={`${dados.eventos.confirmacoes} confirmações de presença`} tone="success" />
          </div>
          <p className="-mt-4 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Utilizador ativo:</span> {dados.definicaoAtivo}
          </p>

          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <Card className="p-5 shadow-soft">
              <p className="text-sm font-medium">Acessos por semana</p>
              <p className="mb-3 text-xs text-muted-foreground">Últimas 12 semanas</p>
              <div
                className={`h-52 ${VIZ_VARS}`}
                role="img"
                aria-label={`Acessos por semana: ${dados.acessosPorSemana.map((p) => `semana de ${rotuloSemana(p.semana)}, ${p.n}`).join("; ")}`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dados.acessosPorSemana} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barCategoryGap={2}>
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
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={44} />
                    <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={<TooltipSemana />} />
                    <Bar dataKey="n" fill="var(--viz-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5 shadow-soft">
              <p className="mb-3 text-sm font-medium">Conteúdos mais usados</p>
              <ol className="space-y-3">
                {dados.conteudosMaisUsados.map((c, i) => {
                  const max = dados.conteudosMaisUsados[0]?.acessos || 1;
                  return (
                    <li key={c.titulo} className={VIZ_VARS}>
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="truncate">
                          <span className="mr-1.5 tabular-nums text-muted-foreground">{i + 1}.</span>
                          {c.titulo}
                        </span>
                        <span className="tabular-nums text-muted-foreground">{c.acessos}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full" style={{ width: `${(c.acessos / max) * 100}%`, background: "var(--viz-1)" }} />
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-5 border-t border-border pt-4">
                <p className="mb-2 text-sm font-medium">Pessoas por papel</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {PAPEIS.filter((p) => dados.utilizadores.porPapel[p]).map((p) => (
                    <div key={p} className="flex justify-between">
                      <dt className="text-muted-foreground">{ROTULO_PAPEL[p]}</dt>
                      <dd className="tabular-nums">{dados.utilizadores.porPapel[p]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Card>
          </div>

          <Card className="p-5 shadow-soft">
            <p className="font-serif text-lg font-semibold">Por grupo</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Grupos com menos de {LIMITE_ANONIMATO} pessoas não mostram detalhe, para não identificar ninguém. Crianças sem
              consentimento para relatórios não contam.
            </p>
            <Tabela cabecalho={["Grupo", "Pessoas", "Ativos (30 dias)", "Acessos (30 dias)"]}>
              {dados.grupos.map((g) => (
                <tr key={g.grupoId}>
                  <td className={`${celula} font-medium`}>{g.nome}</td>
                  {g.oculto ? (
                    <td className={`${celula} text-xs text-muted-foreground`} colSpan={3}>
                      <span className="inline-flex items-center gap-1.5">
                        <EyeOff className="h-3.5 w-3.5" aria-hidden /> Menos de {LIMITE_ANONIMATO} pessoas — sem detalhe
                      </span>
                    </td>
                  ) : (
                    <>
                      <td className={`${celula} tabular-nums`}>{g.membros}</td>
                      <td className={`${celula} tabular-nums`}>{g.ativos30d}</td>
                      <td className={`${celula} tabular-nums`}>{g.acessos30d}</td>
                    </>
                  )}
                </tr>
              ))}
            </Tabela>
          </Card>

          {papel === "administrador" && (
            <Card className="flex items-center justify-between gap-4 p-5 shadow-soft">
              <div>
                <label htmlFor="resumo-email" className="flex items-center gap-2 text-sm font-medium">
                  <Mail className="h-4 w-4 text-muted-foreground" aria-hidden /> Receber um resumo mensal por email
                </label>
                <p className="text-xs text-muted-foreground">Os mesmos indicadores agregados, no primeiro dia de cada mês.</p>
              </div>
              <Switch
                id="resumo-email"
                checked={resumoEmail}
                onCheckedChange={(v) => {
                  setResumoEmail(v);
                  toast.success(v ? "Vais receber o resumo mensal." : "Resumo mensal desligado.");
                }}
              />
            </Card>
          )}

          <p className="text-xs text-muted-foreground">Gerado às {hora(dados.geradoEm)}. Valores de demonstração.</p>
        </div>
      )}
    </Exige>
  );
}
