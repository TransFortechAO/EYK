"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Users, Eye, GraduationCap, TrendingUp, Heart, MessageCircle, BarChart3, Star } from "lucide-react";
import { PageHeader } from "@/components/eyk";
import { useSecoesMoveis } from "@/components/ds/secoes-moveis";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, formatarDuracaoCurta, tempoRelativo, type CursoEngajamento } from "@/lib/api";
import { Estrelas } from "@/components/curso/AvaliacoesCurso";

const SECOES_CURSO = [
  { id: "resumo", rotulo: "Resumo" },
  { id: "aulas", rotulo: "Aulas" },
  { id: "avaliacoes", rotulo: "Avaliações" },
] as const;

export default function CursoEngajamentoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [dados, setDados] = useState<CursoEngajamento | null>(null);
  const [loading, setLoading] = useState(true);
  // Telemóvel/tablet: números, aulas e avaliações em separadores; no computador vê-se tudo.
  const { so, separadores } = useSecoesMoveis(SECOES_CURSO);

  useEffect(() => {
    const id = Number(params.id);
    if (!id) return;
    api.professor
      .getCursoEngajamento(id)
      .then(setDados)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return <div className="py-20 text-center text-muted-foreground">A carregar…</div>;
  }

  if (!dados) {
    return <div className="py-20 text-center text-muted-foreground">Curso não encontrado.</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 mb-2" onClick={() => router.push("/professor/cursos")}>
          <ArrowLeft className="h-4 w-4" /> Meus Cursos
        </Button>
        <PageHeader title={dados.curso.titulo} description="Engajamento e desempenho do curso." />
      </div>

      {separadores}

      <div className={["grid gap-4 sm:grid-cols-2 lg:grid-cols-4", so("resumo")].filter(Boolean).join(" ")}>
        <Card className="p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Inscritos</p>
              <p className="text-2xl font-serif font-semibold">{dados.totalInscritos}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Visualizações</p>
              <p className="text-2xl font-serif font-semibold">{dados.totalVisualizacoes}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Concluídos</p>
              <p className="text-2xl font-serif font-semibold">{dados.totalConcluidos}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Taxa de conclusão</p>
              <p className="text-2xl font-serif font-semibold">{dados.taxaConclusao}%</p>
            </div>
          </div>
        </Card>
        <Card className="p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
              <Heart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Gostos (todas as aulas)</p>
              <p className="text-2xl font-serif font-semibold">{dados.totalGostos}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Comentários (todas as aulas)</p>
              <p className="text-2xl font-serif font-semibold">{dados.totalComentarios}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Visualizadores únicos</p>
              <p className="text-2xl font-serif font-semibold">{dados.visualizadoresUnicos}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Média de views / aula</p>
              <p className="text-2xl font-serif font-semibold">{dados.mediaVisualizacoesPorAula}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className={["p-5 shadow-soft", so("aulas")].filter(Boolean).join(" ")}>
        <p className="font-serif text-lg font-semibold mb-4">Engajamento por aula</p>
        {dados.aulas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Este curso ainda não tem aulas.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="text-left font-medium py-2 pr-4">Aula</th>
                  <th className="text-left font-medium py-2 pr-4">Duração</th>
                  <th className="text-left font-medium py-2 pr-4">Visualizações</th>
                  <th className="text-left font-medium py-2 pr-4">Gostos</th>
                  <th className="text-left font-medium py-2">Comentários</th>
                </tr>
              </thead>
              <tbody>
                {dados.aulas.map((aula, index) => (
                  <tr key={aula.id}>
                    <td className="py-2 pr-4 bg-surface/40 rounded-l-xl">
                      {index + 1}. {aula.titulo}
                    </td>
                    <td className="py-2 pr-4 bg-surface/40 text-muted-foreground tabular-nums">
                      {formatarDuracaoCurta(aula.duracaoSegundos) || "—"}
                    </td>
                    <td className="py-2 pr-4 bg-surface/40 tabular-nums">{aula.totalVisualizacoes}</td>
                    <td className="py-2 pr-4 bg-surface/40 tabular-nums">{aula.totalLikes}</td>
                    <td className="py-2 bg-surface/40 rounded-r-xl tabular-nums">{aula.totalComentarios}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className={["p-5 shadow-soft", so("avaliacoes")].filter(Boolean).join(" ")}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="font-serif text-lg font-semibold">Avaliações dos alunos</p>
          {dados.mediaAvaliacoes !== null && (
            <div className="flex items-center gap-2 text-sm">
              <Estrelas valor={dados.mediaAvaliacoes} />
              <span className="font-semibold tabular-nums">{dados.mediaAvaliacoes.toFixed(1)}</span>
              <span className="text-muted-foreground">
                ({dados.totalAvaliacoes} avaliaç{dados.totalAvaliacoes === 1 ? "ão" : "ões"})
              </span>
            </div>
          )}
        </div>
        {dados.avaliacoesRecentes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            <Star className="mx-auto mb-2 h-5 w-5 text-muted-foreground/50" />
            Ainda nenhum aluno avaliou este curso.
          </p>
        ) : (
          <ul className="space-y-2">
            {dados.avaliacoesRecentes.map((a) => (
              <li key={a.id} className="rounded-xl bg-surface/40 px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-medium">{a.aluno}</span>
                  <Estrelas valor={a.estrelas} tamanho="h-3.5 w-3.5" />
                  <span className="text-xs text-muted-foreground">{tempoRelativo(a.atualizadoEm)}</span>
                </div>
                {a.comentario && <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">{a.comentario}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5 shadow-soft">
        <p className="font-serif text-lg font-semibold mb-4">Alunos inscritos</p>
        {dados.inscricoes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Ainda não há inscrições neste curso.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="text-left font-medium py-2 pr-4">Aluno</th>
                  <th className="text-left font-medium py-2 pr-4">Inscrito em</th>
                  <th className="text-left font-medium py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {dados.inscricoes.map((i) => (
                  <tr key={i.id}>
                    <td className="py-2 pr-4 bg-surface/40 rounded-l-xl">@{i.aluno}</td>
                    <td className="py-2 pr-4 bg-surface/40 text-muted-foreground">
                      {new Date(i.inscritoEm).toLocaleDateString("pt-PT")}
                    </td>
                    <td className="py-2 bg-surface/40 rounded-r-xl">
                      {i.concluido ? (
                        <Badge className="border-success/30 bg-success/15 text-success">Concluído</Badge>
                      ) : (
                        <Badge variant="outline">Em curso</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
