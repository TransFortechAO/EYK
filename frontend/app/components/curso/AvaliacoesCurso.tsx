"use client";

import { useEffect, useState } from "react";
import { Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/UserAvatar";
import { useConfirm } from "@/components/confirm-dialog";
import { BotaoDenunciar } from "@/components/moderacao/denunciar";
import { cn } from "@/lib/utils";
import { api, mensagemDeErro, type AvaliacoesCurso as Dados, type ResumoAvaliacoes } from "@/lib/api";

const ROTULOS = ["", "Fraco", "Razoável", "Bom", "Muito bom", "Excelente"];

/** Estrelas só de leitura (aceita meias estrelas pela largura do preenchimento). */
export function Estrelas({ valor, tamanho = "h-4 w-4" }: { valor: number; tamanho?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${valor.toFixed(1)} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const preenchido = Math.max(0, Math.min(1, valor - (n - 1)));
        return (
          <span key={n} className={cn("relative inline-block", tamanho)}>
            <Star className={cn("absolute inset-0 text-muted-foreground/30", tamanho)} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${preenchido * 100}%` }}>
              <Star className={cn("fill-primary text-primary", tamanho)} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function SeletorEstrelas({ valor, onChange, disabled }: { valor: number; onChange: (n: number) => void; disabled?: boolean }) {
  const [hover, setHover] = useState(0);
  const mostrado = hover || valor;
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Número de estrelas" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={valor === n}
            aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
            disabled={disabled}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
            className="rounded-md p-0.5 transition hover:scale-110 disabled:opacity-60"
          >
            <Star className={cn("h-7 w-7", n <= mostrado ? "fill-primary text-primary" : "text-muted-foreground/40")} />
          </button>
        ))}
      </div>
      {mostrado > 0 && <span className="text-sm text-muted-foreground">{ROTULOS[mostrado]}</span>}
    </div>
  );
}

function Resumo({ resumo }: { resumo: ResumoAvaliacoes }) {
  return (
    <Card className="grid gap-5 rounded-2xl border-border/70 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
      <div className="text-center sm:pr-4">
        <p className="font-serif text-4xl font-semibold tabular-nums">{resumo.media?.toFixed(1) ?? "—"}</p>
        <Estrelas valor={resumo.media ?? 0} />
        <p className="mt-1 text-xs text-muted-foreground">
          {resumo.total} avaliaç{resumo.total === 1 ? "ão" : "ões"}
        </p>
      </div>
      <div className="space-y-1.5">
        {[5, 4, 3, 2, 1].map((n) => {
          const qtd = resumo.distribuicao[String(n)] ?? 0;
          const pct = resumo.total ? (qtd / resumo.total) * 100 : 0;
          return (
            <div key={n} className="flex items-center gap-2 text-xs">
              <span className="w-3 tabular-nums text-muted-foreground">{n}</span>
              <Star className="h-3 w-3 fill-primary text-primary" />
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-6 text-right tabular-nums text-muted-foreground">{qtd}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function AvaliacoesCurso({
  cursoId,
  onResumoAlterado,
}: {
  cursoId: string | number;
  /** Para o pai atualizar a média mostrada no cabeçalho do curso. */
  onResumoAlterado?: (resumo: ResumoAvaliacoes) => void;
}) {
  const confirm = useConfirm();
  const [dados, setDados] = useState<Dados | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [estrelas, setEstrelas] = useState(0);
  const [comentario, setComentario] = useState("");
  const [aEditar, setAEditar] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);

  const carregar = async () => {
    try {
      const res = await api.avaliacoes.listar(cursoId);
      setDados(res);
      setEstrelas(res.minha?.estrelas ?? 0);
      setComentario(res.minha?.comentario ?? "");
    } catch {
      setDados(null);
    } finally {
      setACarregar(false);
    }
  };

  useEffect(() => {
    setACarregar(true);
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursoId]);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (estrelas < 1) {
      toast.info("Escolhe de 1 a 5 estrelas.");
      return;
    }
    setAGuardar(true);
    try {
      const { resumo } = await api.avaliacoes.avaliar(cursoId, estrelas, comentario);
      onResumoAlterado?.(resumo);
      toast.success("Obrigado pela tua avaliação!");
      setAEditar(false);
      await carregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível guardar a avaliação."));
    } finally {
      setAGuardar(false);
    }
  };

  const apagar = async () => {
    const ok = await confirm({
      title: "Apagar a tua avaliação?",
      description: "A tua nota e comentário deixam de aparecer neste curso.",
      confirmLabel: "Apagar",
      destructive: true,
    });
    if (!ok) return;
    try {
      const { resumo } = await api.avaliacoes.apagar(cursoId);
      onResumoAlterado?.(resumo);
      await carregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível apagar a avaliação."));
    }
  };

  if (aCarregar) {
    return <p className="py-6 text-center text-sm text-muted-foreground">A carregar avaliações…</p>;
  }
  if (!dados) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Não foi possível carregar as avaliações.</p>;
  }

  const mostrarFormulario = dados.podeAvaliar && (!dados.minha || aEditar);

  return (
    <div className="space-y-4">
      {dados.resumo.total > 0 && <Resumo resumo={dados.resumo} />}

      {mostrarFormulario && (
        <Card className="rounded-2xl border-border/70 p-5">
          <form onSubmit={(e) => void guardar(e)} className="space-y-4">
            <div>
              <p className="text-sm font-medium">{dados.minha ? "Editar a tua avaliação" : "Avalia este curso"}</p>
              <p className="text-xs text-muted-foreground">A tua opinião ajuda outros alunos a escolher.</p>
            </div>
            <SeletorEstrelas valor={estrelas} onChange={setEstrelas} disabled={aGuardar} />
            <Textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="O que achaste das aulas? (opcional)"
              maxLength={2000}
              rows={3}
              disabled={aGuardar}
              data-video-shortcuts-disabled
            />
            <div className="flex justify-end gap-2">
              {dados.minha && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setAEditar(false)} disabled={aGuardar}>
                  Cancelar
                </Button>
              )}
              <Button
                type="submit"
                size="sm"
                disabled={aGuardar || estrelas < 1}
                className="bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-95"
              >
                {aGuardar ? "A guardar…" : dados.minha ? "Guardar alterações" : "Publicar avaliação"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {!dados.podeAvaliar && dados.resumo.total === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Este curso ainda não tem avaliações. Inscreve-te para seres o primeiro a avaliar.
        </p>
      )}

      {dados.avaliacoes.length > 0 && (
        <ul className="space-y-3">
          {dados.avaliacoes.map((a) => (
            <li key={a.id} className="flex gap-3 rounded-2xl border border-border/70 p-4">
              <Avatar className="h-9 w-9 shrink-0">
                <UserAvatar name={a.autorNome} userId={a.autorUserId ?? 0} foto={a.autorFoto} size={36} />
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <p className="text-sm font-medium">{a.minha ? "Tu" : a.autorNome}</p>
                  <Estrelas valor={a.estrelas} tamanho="h-3.5 w-3.5" />
                  <span className="text-xs text-muted-foreground">
                    {a.tempo}
                    {a.oculto && " · oculta pela moderação (só tu a vês)"}
                  </span>
                </div>
                {a.comentario && (
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{a.comentario}</p>
                )}
                {a.minha && !aEditar && (
                  <div className="mt-2 flex gap-3 text-xs">
                    <button type="button" onClick={() => setAEditar(true)} className="font-medium text-primary hover:underline">
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void apagar()}
                      className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" /> Apagar
                    </button>
                  </div>
                )}
                {!a.minha && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    <BotaoDenunciar tipo="avaliacao" id={a.id} autorId={a.autorUserId} variante="texto" className="-ml-1.5" />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
