"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { EyeOff, Flag, Hand, Eye, ImagePlus, MessageCircle, Send, ShieldCheck, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/eyk";
import { BotaoSalvar } from "@/components/ds/botao-salvar";
import { useConfirm } from "@/components/confirm-dialog";
import { useInstituicaoAtual } from "@/components/instituicao/contexto";
import { EscolherGestos } from "@/components/instituicao/lga";
import { LgaSign } from "@/components/lga-sign";
import { acao, Carregando, ErroCarregar, Etiqueta, EtiquetaPapel, haQuanto, tamanho, useCarregar } from "@/components/instituicao/ui";
import { apiLga } from "@/lib/instituicoes/lga";
import { enderecoApi, PREFIXO_SERVIDOR } from "@/lib/instituicoes/servidor";
import type { Gesto, PostTurma } from "@/lib/instituicoes/tipos";
import { cn } from "@/lib/utils";

const FOTO_MAX_MB = 5;

function Avatar({ nome }: { nome: string }) {
  return (
    <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-gold text-sm font-semibold text-primary-foreground">
      {nome.charAt(0).toUpperCase()}
    </span>
  );
}

/** Comentários num modal, como na Comunidade. */
function Comentarios({
  post,
  moderador,
  podeComentar,
  aoFechar,
  aoMudar,
}: {
  post: PostTurma;
  moderador: boolean;
  podeComentar: boolean;
  aoFechar: () => void;
  aoMudar: () => void;
}) {
  const { instituicaoId, atual } = useInstituicaoAtual();
  const confirmar = useConfirm();
  const [texto, setTexto] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const { dados, erro, aCarregar, recarregar } = useCarregar(() => apiLga.listarComentariosTurma(instituicaoId, post.id), [instituicaoId, post.id]);

  const depois = async () => {
    await recarregar();
    aoMudar();
  };

  const comentar = async (e: FormEvent) => {
    e.preventDefault();
    setAEnviar(true);
    const ok = await acao(() => apiLga.comentarPostTurma(instituicaoId, post.id, texto));
    setAEnviar(false);
    if (ok) {
      setTexto("");
      await depois();
    }
  };

  const denunciar = async (id: string) => {
    const ok = await confirmar({ title: "Denunciar este comentário?", description: "Deixa de aparecer na turma até o professor o rever.", confirmLabel: "Denunciar" });
    if (ok && (await acao(() => apiLga.denunciarComentarioTurma(instituicaoId, id), "Obrigado. O professor vai rever."))) await depois();
  };

  const moderar = async (id: string, visivel: boolean) => {
    if (await acao(() => apiLga.moderarComentarioTurma(instituicaoId, id, visivel), visivel ? "Comentário visível." : "Comentário escondido.")) await depois();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <div>
            <DialogTitle>Comentários</DialogTitle>
            <DialogDescription>Publicação de {post.autorNome.split(" ")[0]}. Só a turma vê.</DialogDescription>
          </div>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto p-5">
          {aCarregar && !dados ? (
            <Carregando />
          ) : !dados ? (
            <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />
          ) : dados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há comentários.</p>
          ) : (
            <ul className="space-y-3">
              {dados.map((c) => (
                <li key={c.id} className={cn("flex gap-3", c.estado !== "visivel" && "opacity-70")}>
                  <Avatar nome={c.autorNome} />
                  <div className="min-w-0 flex-1 rounded-xl bg-surface p-3">
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{c.autorNome.split(" ")[0]}</span>
                      <span className="text-xs text-muted-foreground">{haQuanto(c.criadoEm)}</span>
                      {c.estado === "oculto" && <Etiqueta tom="neutro">Escondido</Etiqueta>}
                      {c.estado === "denunciado" && <Etiqueta tom="perigo">Denunciado</Etiqueta>}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm">{c.texto}</p>
                    <div className="mt-1 flex justify-end">
                      {moderador ? (
                        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => void moderar(c.id, c.estado !== "visivel")}>
                          {c.estado === "visivel" ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          {c.estado === "visivel" ? "Esconder" : "Mostrar"}
                        </Button>
                      ) : (
                        c.estado === "visivel" &&
                        c.autorId !== atual.membro.id && (
                          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => void denunciar(c.id)}>
                            <Flag className="h-3.5 w-3.5" /> Denunciar
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {podeComentar ? (
            <form onSubmit={comentar} className="space-y-2">
              <Textarea aria-label="Escrever um comentário" rows={2} maxLength={300} placeholder="Escreve um comentário…" value={texto} onChange={(e) => setTexto(e.target.value)} />
              <div className="flex justify-end">
                <Button type="submit" size="sm" className="gap-1.5" disabled={!texto.trim() || aEnviar}>
                  <Send className="h-3.5 w-3.5" /> Comentar
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-xs text-muted-foreground">As famílias acompanham a turma, mas não comentam aqui.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SeparadorComunidade({ turmaId, ensino }: { turmaId: string; ensino: boolean }) {
  const { instituicaoId, pode, atual } = useInstituicaoAtual();
  const confirmar = useConfirm();
  const [texto, setTexto] = useState("");
  const [gesto, setGesto] = useState<string[]>([]);
  const [comGesto, setComGesto] = useState(false);
  const [gestos, setGestos] = useState<Gesto[]>([]);
  const [aEnviar, setAEnviar] = useState(false);
  const [compor, setCompor] = useState(false);
  const [foto, setFoto] = useState<File | null>(null);
  const [temCriancas, setTemCriancas] = useState(true);
  const [comentariosDe, setComentariosDe] = useState<PostTurma | null>(null);
  const entradaFoto = useRef<HTMLInputElement>(null);
  // Fotos só de quem ensina: é quem responde pelo consentimento das crianças que aparecem.
  const podeFoto = ensino && instituicaoId.startsWith(PREFIXO_SERVIDOR);
  const podePublicar = pode("publicar_na_turma") && atual.membro.gruposIds.includes(turmaId);
  const moderador = ensino || pode("gerir_membros");

  const { dados, erro, aCarregar, recarregar } = useCarregar(() => apiLga.listarPostsTurma(instituicaoId, turmaId), [instituicaoId, turmaId]);

  useEffect(() => {
    void apiLga.listarGestos(instituicaoId).then(setGestos);
  }, [instituicaoId]);

  const publicar = async () => {
    setAEnviar(true);
    const ok = await acao(() => apiLga.publicarPostTurma(instituicaoId, turmaId, { texto, gestoId: gesto[0] ?? null, foto, temCriancas: !!foto && temCriancas }));
    setAEnviar(false);
    if (ok) {
      setTexto("");
      setGesto([]);
      setComGesto(false);
      setCompor(false);
      setFoto(null);
      setTemCriancas(true);
      await recarregar();
    }
  };

  const escolherFoto = (f: File | undefined) => {
    if (entradaFoto.current) entradaFoto.current.value = "";
    if (!f) return;
    if (f.size > FOTO_MAX_MB * 1024 * 1024) {
      toast.error(`A fotografia pode ter até ${FOTO_MAX_MB} MB.`);
      return;
    }
    setFoto(f);
  };

  const gostar = async (id: string) => {
    if (await acao(() => apiLga.gostarPostTurma(instituicaoId, id))) await recarregar();
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
      <Dialog open={compor} onOpenChange={setCompor}>
        <DialogContent>
          <DialogHeader>
            <div>
              <DialogTitle>Nova publicação</DialogTitle>
              <DialogDescription>Só os membros desta turma vêem esta publicação.</DialogDescription>
            </div>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto p-5">
            <Textarea
              aria-label="Nova publicação na turma"
              rows={4}
              maxLength={500}
              placeholder="Partilha com a turma…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            {comGesto && <EscolherGestos gestos={gestos} valor={gesto} onChange={setGesto} multiplo={false} />}
            {foto && (
              <div className="space-y-2 rounded-lg bg-surface p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {foto.name} · {tamanho(foto.size)}
                  </span>
                  <Button type="button" variant="ghost" size="icon" aria-label="Tirar a fotografia" onClick={() => setFoto(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" className="mt-0.5" checked={temCriancas} onChange={(e) => setTemCriancas(e.target.checked)} />
                  Aparecem crianças. Só publica se todas as crianças da turma tiverem consentimento para fotografias.
                </label>
              </div>
            )}
            <input ref={entradaFoto} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Escolher fotografia" className="sr-only" onChange={(e) => escolherFoto(e.target.files?.[0])} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1">
                <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => setComGesto((v) => !v)}>
                  <Hand className="h-4 w-4" /> {comGesto ? "Sem gesto" : "Juntar um gesto"}
                </Button>
                {podeFoto && !foto && (
                  <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => entradaFoto.current?.click()}>
                    <ImagePlus className="h-4 w-4" /> Fotografia
                  </Button>
                )}
                {podeFoto && !foto && <span className="text-xs text-muted-foreground">Máx. {FOTO_MAX_MB} MB</span>}
              </div>
              <Button className="gap-1.5" disabled={(!texto.trim() && !foto) || aEnviar} onClick={() => void publicar()}>
                <Send className="h-4 w-4" /> Publicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {comentariosDe && (
        <Comentarios post={comentariosDe} moderador={moderador} podeComentar={podePublicar} aoFechar={() => setComentariosDe(null)} aoMudar={() => void recarregar()} />
      )}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Só os membros desta turma vêem estas publicações. Quem ensina na turma modera; qualquer pessoa pode denunciar.
      </p>

      {podePublicar ? (
        <Card className="flex items-center gap-3 p-3 shadow-soft">
          <Avatar nome={atual.membro.nome} />
          <button
            type="button"
            onClick={() => setCompor(true)}
            className="min-h-10 flex-1 rounded-full bg-surface px-4 text-left text-sm text-muted-foreground transition-colors hover:bg-accent"
          >
            O que aprendeste hoje?
          </button>
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
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar nome={p.autorNome} />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{p.autorNome.split(" ")[0]}</span>
                        <EtiquetaPapel papel={p.papel} />
                      </p>
                      <p className="text-xs text-muted-foreground">{haQuanto(p.criadoEm)}</p>
                    </div>
                  </div>
                  {p.estado === "oculto" && <Etiqueta tom="neutro">Escondida</Etiqueta>}
                  {p.estado === "denunciado" && <Etiqueta tom="perigo">Denunciada — por rever</Etiqueta>}
                </div>
                {p.texto && <p className="whitespace-pre-line text-sm">{p.texto}</p>}
                {p.foto?.url && (
                  // eslint-disable-next-line @next/next/no-img-element -- endereço protegido, servido pela API
                  <img src={enderecoApi(p.foto.url)} alt={`Fotografia publicada por ${p.autorNome.split(" ")[0]}`} className="max-h-[28rem] w-full rounded-xl object-cover" />
                )}
                {g && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm">
                    <LgaSign glyph={g.glyph} motion={g.motion} hoverPlay className="text-xl" label={g.palavra} />
                    <span>{g.palavra}</span>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-1 border-t border-border/60 pt-2">
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn("gap-2 text-xs sm:text-sm", p.gostei && "text-primary")}
                      aria-label={p.gostei ? "Retirar reação" : "Reagir"}
                      onClick={() => void gostar(p.id)}
                    >
                      <Hand className={cn("h-4 w-4", p.gostei && "fill-primary")} />
                      <span className="hidden sm:inline">Reações</span>
                      <span className="tabular-nums">{p.gostos}</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-2 text-xs sm:text-sm" aria-label={`Ver comentários (${p.comentarios})`} onClick={() => setComentariosDe(p)}>
                      <MessageCircle className="h-4 w-4" />
                      <span className="hidden sm:inline">Comentários</span>
                      <span className="tabular-nums">{p.comentarios}</span>
                    </Button>
                    <BotaoSalvar tipo="post_turma" id={p.id} variante="acao" />
                  </div>
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
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
