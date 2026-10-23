"use client";

import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useInstituicaoAtual } from "@/components/instituicao/contexto";
import { BarraMestria } from "@/components/instituicao/lga";
import { Carregando, celula, ErroCarregar, Tabela, useCarregar } from "@/components/instituicao/ui";
import { apiLga } from "@/lib/instituicoes/lga";
import { ROTULO_COMPETENCIA } from "@/lib/instituicoes/permissoes";
import type { Competencia } from "@/lib/instituicoes/tipos";

const COMPETENCIAS: Competencia[] = ["alfabeto", "numeros", "vocabulario", "frases"];

export function SeparadorProgresso({ turmaId }: { turmaId: string }) {
  const { instituicaoId } = useInstituicaoAtual();
  const { dados, erro, aCarregar, recarregar } = useCarregar(() => apiLga.progressoTurma(instituicaoId, turmaId), [instituicaoId, turmaId]);

  if (aCarregar && !dados) return <Carregando />;
  if (!dados) return <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {COMPETENCIAS.map((c) => (
          <Card key={c} className="space-y-2 p-4 shadow-soft">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{ROTULO_COMPETENCIA[c]}</p>
            <p className="font-serif text-3xl font-semibold tabular-nums">{dados.media[c]}%</p>
            <BarraMestria valor={dados.media[c]} rotulo={`Média da turma em ${ROTULO_COMPETENCIA[c]}`} />
            <p className="text-xs text-muted-foreground">média da turma</p>
          </Card>
        ))}
      </div>

      <Card className="p-5 shadow-soft">
        <Tabela cabecalho={["Aluno", ...COMPETENCIAS.map((c) => ROTULO_COMPETENCIA[c]), "Respostas certas"]}>
          {dados.alunos.map((a) => (
            <tr key={a.id}>
              <td className={`${celula} font-medium`}>{a.nome}</td>
              {COMPETENCIAS.map((c) => (
                <td key={c} className={`${celula} min-w-32`}>
                  <BarraMestria valor={a.competencias[c]} rotulo={`${a.nome}: ${ROTULO_COMPETENCIA[c]}`} />
                </td>
              ))}
              <td className={`${celula} tabular-nums`}>{a.respostasCorretas}</td>
            </tr>
          ))}
        </Tabela>
        {dados.alunos.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Ainda não há alunos nesta turma.</p>}
      </Card>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        A mestria é a percentagem de acertos nas últimas 10 respostas de cada competência, em Praticar. Só quem ensina na turma vê o
        progresso de cada aluno; os relatórios da escola mostram apenas valores agregados.
      </p>
    </div>
  );
}
