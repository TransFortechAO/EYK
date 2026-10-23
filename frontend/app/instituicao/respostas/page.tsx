"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, Video } from "lucide-react";
import { EmptyState } from "@/components/eyk";
import { Exige, useInstituicaoAtual } from "@/components/instituicao/contexto";
import { CartaoResposta } from "@/components/instituicao/turma/respostas";
import { Carregando, ErroCarregar, Seletor, useCarregar } from "@/components/instituicao/ui";
import { apiLga } from "@/lib/instituicoes/lga";
import { pode } from "@/lib/instituicoes/permissoes";

/** Todas as respostas em vídeo por corrigir, das turmas onde a pessoa ensina. */
export default function RespostasPorReverPage() {
  const { instituicaoId, papel, atual, atualizarContadores } = useInstituicaoAtual();
  const [filtro, setFiltro] = useState<"por_rever" | "todas">("por_rever");
  const { dados, erro, aCarregar, recarregar } = useCarregar(async () => {
    const [respostas, turmas] = await Promise.all([apiLga.listarRespostas(instituicaoId, {}), apiLga.listarTurmas(instituicaoId)]);
    const minhas = turmas.filter((t) => atual.membro.gruposIds.includes(t.id));
    const aulas = (await Promise.all(minhas.map((t) => apiLga.listarAulas(instituicaoId, t.id)))).flat();
    return { respostas: respostas.filter((r) => minhas.some((t) => t.id === r.turmaId)), turmas: minhas, aulas };
  }, [instituicaoId]);

  const aoMudar = async () => {
    await recarregar();
    atualizarContadores();
  };

  return (
    <Exige permitido={pode(papel, "rever_respostas")}>
      {aCarregar && !dados ? (
        <Carregando />
      ) : !dados ? (
        <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-serif text-2xl font-semibold">Respostas em vídeo</h2>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Lock className="h-3.5 w-3.5" aria-hidden /> Das turmas onde ensinas. Só tu, o aluno e a família vêem estes vídeos.
              </p>
            </div>
            <Seletor aria-label="Filtrar respostas" className="w-44" value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
              <option value="por_rever">Por rever</option>
              <option value="todas">Todas</option>
            </Seletor>
          </div>

          {dados.turmas.map((t) => {
            const lista = dados.respostas.filter((r) => r.turmaId === t.id && (filtro === "todas" || r.estado === "por_rever"));
            if (lista.length === 0) return null;
            return (
              <section key={t.id} className="space-y-3">
                <h3 className="font-serif text-lg font-semibold">
                  <Link href={`/instituicao/turmas/${t.id}?separador=respostas`} className="hover:underline underline-offset-2">
                    {t.nome}
                  </Link>{" "}
                  <span className="text-sm font-normal text-muted-foreground">({lista.length})</span>
                </h3>
                <div className="grid gap-4 lg:grid-cols-2">
                  {lista.map((r) => (
                    <CartaoResposta
                      key={r.id}
                      resposta={r}
                      turmaId={t.id}
                      ensino
                      tituloAula={dados.aulas.find((a) => a.id === r.aulaId)?.titulo}
                      aoMudar={() => void aoMudar()}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {dados.respostas.filter((r) => filtro === "todas" || r.estado === "por_rever").length === 0 && (
            <EmptyState icon={Video} title={filtro === "por_rever" ? "Nada por rever" : "Ainda não há respostas"} description="Quando um aluno enviar uma resposta em vídeo, aparece aqui." />
          )}
        </div>
      )}
    </Exige>
  );
}
