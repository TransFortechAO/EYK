"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Lock, MessageSquareText, RotateCcw, Video } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/eyk";
import { useInstituicaoAtual } from "@/components/instituicao/contexto";
import { CarregarVideo, EtiquetaResposta, VideoLga } from "@/components/instituicao/lga";
import { acao, Carregando, dataCurta, ErroCarregar, haQuanto, Seletor, useCarregar } from "@/components/instituicao/ui";
import { apiLga } from "@/lib/instituicoes/lga";
import type { RespostaVideo, VideoAnexo } from "@/lib/instituicoes/tipos";

export function SeparadorRespostas({ turmaId, ensino }: { turmaId: string; ensino: boolean }) {
  const { instituicaoId } = useInstituicaoAtual();
  const [filtro, setFiltro] = useState<"por_rever" | "todas">("por_rever");
  const { dados, erro, aCarregar, recarregar } = useCarregar(async () => {
    const [respostas, aulas] = await Promise.all([apiLga.listarRespostas(instituicaoId, { turmaId }), apiLga.listarAulas(instituicaoId, turmaId)]);
    return { respostas, aulas };
  }, [instituicaoId, turmaId]);

  if (aCarregar && !dados) return <Carregando />;
  if (!dados) return <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />;

  const tituloAula = (id: string) => dados.aulas.find((a) => a.id === id)?.titulo ?? "Aula";
  const lista = ensino && filtro === "por_rever" ? dados.respostas.filter((r) => r.estado === "por_rever") : dados.respostas;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" aria-hidden /> Só o professor da turma, o aluno e a sua família vêem estes vídeos. São apagados no fim do ano letivo.
        </p>
        {ensino && (
          <Seletor aria-label="Filtrar respostas" className="w-44" value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
            <option value="por_rever">Por rever</option>
            <option value="todas">Todas</option>
          </Seletor>
        )}
      </div>
      {lista.length === 0 ? (
        <EmptyState
          icon={Video}
          title={ensino && filtro === "por_rever" ? "Nada por rever" : "Sem respostas"}
          description={ensino ? undefined : "Quando uma aula pedir uma resposta em vídeo, grava-a na página da aula."}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {lista.map((r) => (
            <CartaoResposta key={r.id} resposta={r} tituloAula={tituloAula(r.aulaId)} turmaId={turmaId} ensino={ensino} aoMudar={recarregar} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CartaoResposta({
  resposta: r,
  tituloAula,
  turmaId,
  ensino,
  aoMudar,
}: {
  resposta: RespostaVideo;
  tituloAula?: string;
  turmaId: string;
  ensino: boolean;
  aoMudar: () => void;
}) {
  const { instituicaoId, atualizarContadores } = useInstituicaoAtual();
  const [texto, setTexto] = useState("");
  const [videoFeedback, setVideoFeedback] = useState<VideoAnexo | null>(null);
  const [aEnviar, setAEnviar] = useState(false);

  const corrigir = async (estado: "correto" | "repetir") => {
    setAEnviar(true);
    const ok = await acao(
      () => apiLga.darFeedback(instituicaoId, r.id, { estado, texto, video: videoFeedback }),
      estado === "correto" ? "Marcado como correto." : "Pedido para repetir enviado.",
    );
    setAEnviar(false);
    if (ok) {
      atualizarContadores();
      aoMudar();
    }
  };

  return (
    <Card className="space-y-3 p-4 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{ensino ? r.alunoNome : tituloAula}</p>
          <p className="text-xs text-muted-foreground">
            {ensino && tituloAula ? (
              <Link href={`/instituicao/turmas/${turmaId}/aulas/${r.aulaId}`} className="hover:underline">
                {tituloAula}
              </Link>
            ) : null}
            {ensino && tituloAula ? " · " : ""}
            Tentativa {r.tentativa} · {haQuanto(r.enviadaEm)}
          </p>
        </div>
        <EtiquetaResposta estado={r.estado} />
      </div>

      <VideoLga video={r.video} glyph="🙋" motion="wave" titulo={`Resposta de ${r.alunoNome}`} />

      {r.feedback && (
        <div className="space-y-2 rounded-lg bg-surface p-3 text-sm">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <MessageSquareText className="h-3.5 w-3.5" aria-hidden /> {r.feedback.por}, {haQuanto(r.feedback.em)}
          </p>
          {r.feedback.texto && <p>{r.feedback.texto}</p>}
          {r.feedback.video && <VideoLga video={r.feedback.video} titulo="Feedback em vídeo" glyph="🧑‍🏫" />}
        </div>
      )}

      {ensino && r.estado === "por_rever" && (
        <div className="space-y-2 border-t border-border pt-3">
          <Textarea
            aria-label={`Comentário para ${r.alunoNome}`}
            rows={2}
            placeholder="Comentário para o aluno (obrigatório se pedires para repetir)"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <CarregarVideo id={`fb-${r.id}`} valor={videoFeedback} onChange={setVideoFeedback} captura="user" rotulo="Responder em vídeo (opcional)" />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-1.5" disabled={aEnviar} onClick={() => void corrigir("repetir")}>
              <RotateCcw className="h-4 w-4" /> Repetir
            </Button>
            <Button className="flex-1 gap-1.5" disabled={aEnviar} onClick={() => void corrigir("correto")}>
              <Check className="h-4 w-4" /> Correto
            </Button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">Apagado a {dataCurta(r.apagarEm)}.</p>
    </Card>
  );
}
