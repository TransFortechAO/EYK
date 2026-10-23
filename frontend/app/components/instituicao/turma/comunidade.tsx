"use client";

import { useEffect, useState } from "react";
import { EyeOff, Flag, Hand, Eye, Send, ShieldCheck, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/eyk";
import { useConfirm } from "@/components/confirm-dialog";
import { useInstituicaoAtual } from "@/components/instituicao/contexto";
import { EscolherGestos } from "@/components/instituicao/lga";
import { LgaSign } from "@/components/lga-sign";
import { acao, Carregando, ErroCarregar, Etiqueta, EtiquetaPapel, haQuanto, useCarregar } from "@/components/instituicao/ui";
import { apiLga } from "@/lib/instituicoes/lga";
import type { Gesto } from "@/lib/instituicoes/tipos";

export function SeparadorComunidade({ turmaId, ensino }: { turmaId: string; ensino: boolean }) {
  const { instituicaoId, pode, atual } = useInstituicaoAtual();
  const confirmar = useConfirm();
  const [texto, setTexto] = useState("");
  const [gesto, setGesto] = useState<string[]>([]);
  const [comGesto, setComGesto] = useState(false);
  const [gestos, setGestos] = useState<Gesto[]>([]);
  const [aEnviar, setAEnviar] = useState(false);
  const podePublicar = pode("publicar_na_turma") && atual.membro.gruposIds.includes(turmaId);
  const moderador = ensino || pode("gerir_membros");

  const { dados, erro, aCarregar, recarregar } = useCarregar(() => apiLga.listarPostsTurma(instituicaoId, turmaId), [instituicaoId, turmaId]);

  useEffect(() => {
    void apiLga.listarGestos(instituicaoId).then(setGestos);
  }, [instituicaoId]);

  const publicar = async () => {
    setAEnviar(true);
    const ok = await acao(() => apiLga.publicarPostTurma(instituicaoId, turmaId, { texto, gestoId: gesto[0] ?? null }));
    setAEnviar(false);
    if (ok) {
      setTexto("");
      setGesto([]);
      setComGesto(false);
      await recarregar();
    }
  };

  const moderar = async (id: string, visivel: boolean) => {
    if (await acao(() => apiLga.moderarPostTurma(instituicaoId, id, visivel), visivel ? "Publicação visível." : "Publicação escondida.")) await recarregar();
  };

  const denunciar = async (id: string) => {
    const ok = await confirmar({ title: "Denunciar esta publicação?", description: "Deixa de aparecer na turma até o professor a rever.", confirmLabel: "Denunciar" });
    if (ok && (await acao(() => apiLga.denunciarPostTurma(instituicaoId, id), "Obrigado. O professor vai rever."))) await recarregar();
  };

  if (aCarregar && !dados) return <Carregando />;
  if (!dados) return <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />;

  const porGesto = (id: string | null) => (id ? gestos.find((g) => g.id === id) : undefined);

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Só os membros desta turma vêem estas publicações. Quem ensina na turma modera; qualquer pessoa pode denunciar.
      </p>

      {podePublicar ? (
        <Card className="space-y-3 p-4 shadow-soft">
          <Textarea
            aria-label="Nova publicação na turma"
            rows={3}
            maxLength={500}
            placeholder="O que aprendeste hoje? Partilha com a turma…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          {comGesto && <EscolherGestos gestos={gestos} valor={gesto} onChange={setGesto} multiplo={false} />}
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => setComGesto((v) => !v)}>
              <Hand className="h-4 w-4" /> {comGesto ? "Sem gesto" : "Juntar um gesto"}
            </Button>
            <Button className="gap-1.5" disabled={!texto.trim() || aEnviar} onClick={() => void publicar()}>
              <Send className="h-4 w-4" /> Publicar
            </Button>
          </div>
        </Card>
      ) : (
        <p className="rounded-lg bg-surface p-3 text-sm text-muted-foreground">As famílias acompanham a turma, mas não publicam aqui.</p>
      )}

      {dados.length === 0 ? (
        <EmptyState icon={Users} title="Ainda não há publicações" />
      ) : (
        <div className="space-y-3">
          {dados.map((p) => {
            const g = porGesto(p.gestoId);
            return (
              <Card key={p.id} className={`space-y-2 p-4 shadow-soft ${p.estado !== "visivel" ? "border-dashed opacity-70" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.autorNome.split(" ")[0]}</span>
                    <EtiquetaPapel papel={p.papel} />
                    <span className="text-xs text-muted-foreground">{haQuanto(p.criadoEm)}</span>
                  </div>
                  {p.estado === "oculto" && <Etiqueta tom="neutro">Escondida</Etiqueta>}
                  {p.estado === "denunciado" && <Etiqueta tom="perigo">Denunciada — por rever</Etiqueta>}
                </div>
                <p className="whitespace-pre-line text-sm">{p.texto}</p>
                {g && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm">
                    <LgaSign glyph={g.glyph} motion={g.motion} hoverPlay className="text-xl" label={g.palavra} />
                    <span>{g.palavra}</span>
                  </div>
                )}
                <div className="flex justify-end gap-1">
                  {moderador ? (
                    p.estado === "visivel" ? (
                      <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => void moderar(p.id, false)}>
                        <EyeOff className="h-3.5 w-3.5" /> Esconder
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => void moderar(p.id, true)}>
                        <Eye className="h-3.5 w-3.5" /> Mostrar
                      </Button>
                    )
                  ) : (
                    p.estado === "visivel" &&
                    p.autorId !== atual.membro.id && (
                      <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => void denunciar(p.id)}>
                        <Flag className="h-3.5 w-3.5" /> Denunciar
                      </Button>
                    )
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
