"use client";

import { Coins, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useInstituicaoAtual } from "@/components/instituicao/contexto";
import { Carregando, ErroCarregar, useCarregar } from "@/components/instituicao/ui";
import { apiLga } from "@/lib/instituicoes/lga";
import { cn } from "@/lib/utils";

const MEDALHAS = ["from-yellow-400 to-amber-500", "from-slate-300 to-slate-400", "from-amber-700 to-amber-800"];

/** Classificação de uma turma ou da escola inteira (só primeiro nome; a escola pode desligar). */
export function ListaClassificacao({ ambito }: { ambito: { turmaId: string } | "escola" }) {
  const { instituicaoId } = useInstituicaoAtual();
  const chave = ambito === "escola" ? "escola" : ambito.turmaId;
  const { dados, erro, aCarregar, recarregar } = useCarregar(() => apiLga.classificacao(instituicaoId, ambito), [instituicaoId, chave]);

  if (aCarregar && !dados) return <Carregando />;
  if (!dados) return <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />;
  if (dados.linhas.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Ainda ninguém pontuou.</p>;

  return (
    <Card className="divide-y divide-border overflow-hidden shadow-soft">
      {dados.linhas.map((l) => (
        <div key={`${l.posicao}-${l.nome}`} className={cn("flex items-center gap-4 px-5 py-3", l.eu && "bg-primary/5")}>
          <span
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-full font-serif font-semibold",
              l.posicao <= 3 ? cn("bg-gradient-to-br text-white", MEDALHAS[l.posicao - 1]) : "bg-secondary text-muted-foreground",
            )}
          >
            {l.posicao}
          </span>
          <p className="flex-1 font-medium">
            {l.nome}
            {l.eu && <span className="ml-2 text-xs text-primary">(tu)</span>}
          </p>
          <span className="inline-flex items-center gap-1 text-sm tabular-nums">
            <Coins className="h-4 w-4 text-primary" aria-hidden /> {l.pontos}
          </span>
        </div>
      ))}
    </Card>
  );
}

export function SeparadorClassificacao({ turmaId }: { turmaId: string }) {
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Trophy className="h-4 w-4 text-primary" aria-hidden /> Moedas ganhas na prática, nas respostas certas e nos desafios. Só aparece o primeiro nome.
      </p>
      <ListaClassificacao ambito={{ turmaId }} />
    </div>
  );
}
