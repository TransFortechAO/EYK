"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Users, Eye, GraduationCap, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, type CursoEngajamento } from "@/lib/api";

export default function CursoEngajamentoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [dados, setDados] = useState<CursoEngajamento | null>(null);
  const [loading, setLoading] = useState(true);

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15 text-amber-300">
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
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-500/15 text-sky-300">
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
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
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
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-500/15 text-purple-300">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Taxa de conclusão</p>
              <p className="text-2xl font-serif font-semibold">{dados.taxaConclusao}%</p>
            </div>
          </div>
        </Card>
      </div>

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
                        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Concluído</Badge>
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
