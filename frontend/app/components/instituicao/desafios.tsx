"use client";

import { Flag } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BarraMestria } from "@/components/instituicao/lga";
import { Etiqueta, haQuanto } from "@/components/instituicao/ui";
import type { DesafioComProgresso } from "@/lib/instituicoes/lga";

export function ListaDesafios({ desafios, titulo = "Desafios da escola" }: { desafios: DesafioComProgresso[]; titulo?: string }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 font-serif text-lg font-semibold">
        <Flag className="h-5 w-5 text-primary" aria-hidden /> {titulo}
      </h3>
      <div className="grid gap-3 md:grid-cols-2">
        {desafios.map((d) => (
          <Card key={d.id} className="space-y-2 p-4 shadow-soft">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{d.titulo}</p>
                <p className="text-xs text-muted-foreground">
                  {d.turmaNome ?? "Toda a escola"} · termina {haQuanto(d.terminaEm)}
                </p>
              </div>
              {d.concluido ? <Etiqueta tom="sucesso">Concluído</Etiqueta> : <Etiqueta tom="marca">+{d.recompensa} moedas</Etiqueta>}
            </div>
            <p className="text-sm text-muted-foreground">{d.descricao}</p>
            <BarraMestria valor={Math.round((d.progresso / d.meta) * 100)} rotulo={`${d.titulo}: ${d.progresso} de ${d.meta}`} />
            <p className="text-xs tabular-nums text-muted-foreground">
              {d.progresso} de {d.meta}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}
