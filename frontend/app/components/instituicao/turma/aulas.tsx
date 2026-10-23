"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { BookOpen, CalendarClock, Camera, ChevronRight, Hand, Paperclip, Plus, Video } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/eyk";
import { useInstituicaoAtual } from "@/components/instituicao/contexto";
import { CarregarVideo, EscolherGestos, EtiquetaResposta } from "@/components/instituicao/lga";
import { Caixa, Campo, Carregando, dataCurta, deInputLuanda, ErroCarregar, erroTexto, Etiqueta, haQuanto, Seletor, tamanho, useCarregar } from "@/components/instituicao/ui";
import { api } from "@/lib/api";
import { apiLga, duracao, type TurmaLga } from "@/lib/instituicoes/lga";
import type { Aula, ConteudoAtribuido, Gesto, RecursoAula, VideoAnexo } from "@/lib/instituicoes/tipos";
import { cn } from "@/lib/utils";

export function SeparadorAulas({ turma, ensino }: { turma: TurmaLga; ensino: boolean }) {
  const { instituicaoId, pode, papel } = useInstituicaoAtual();
  const [nova, setNova] = useState(false);
  const podePublicar = pode("publicar_aulas") && (ensino || pode("gerir_membros"));
  const { dados, erro, aCarregar, recarregar } = useCarregar(() => apiLga.listarAulas(instituicaoId, turma.id), [instituicaoId, turma.id]);

  if (aCarregar && !dados) return <Carregando />;
  if (!dados) return <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />;

  return (
    <div className="space-y-4">
      {podePublicar && (
        <div className="flex justify-end">
          <Button className="gap-1.5" onClick={() => setNova(true)}>
            <Plus className="h-4 w-4" /> Nova aula
          </Button>
        </div>
      )}
      {dados.length === 0 ? (
        <EmptyState icon={Video} title="Ainda não há aulas" description={podePublicar ? "Publica a primeira aula sinalizada ou atribui um curso que já existe." : undefined} />
      ) : (
        <ul className="space-y-3">
          {dados.map((a) => {
            const atrasada = a.prazo && new Date(a.prazo).getTime() < Date.now();
            return (
              <li key={a.id}>
                <Link href={`/instituicao/turmas/${turma.id}/aulas/${a.id}`} className="group block">
                  <Card className="flex items-center gap-4 p-4 shadow-soft transition-shadow group-hover:shadow-elevated">
                    <div
                      className={cn(
                        "grid h-12 w-12 shrink-0 place-items-center rounded-xl",
                        a.tipo === "aula" ? "bg-primary/15 text-primary" : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {a.tipo === "aula" ? <Hand className="h-5 w-5" aria-hidden /> : <BookOpen className="h-5 w-5" aria-hidden />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium group-hover:underline underline-offset-2">{a.titulo}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span>{a.tipo === "aula" ? `Aula sinalizada · ${duracao(a.video?.duracaoSeg)}` : `Atribuído: ${a.conteudo?.titulo}`}</span>
                        <span aria-hidden>·</span>
                        <span>
                          {a.autor}, {haQuanto(a.publicadaEm)}
                        </span>
                        {a.gestosIds.length > 0 && (
                          <>
                            <span aria-hidden>·</span>
                            <span>{a.gestosIds.length} gestos</span>
                          </>
                        )}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {a.prazo && (
                          <Etiqueta tom={atrasada ? "neutro" : "aviso"}>
                            <CalendarClock className="h-3 w-3" aria-hidden /> {atrasada ? "Prazo terminou" : `Até ${dataCurta(a.prazo)}`}
                          </Etiqueta>
                        )}
                        {a.pedeResposta && papel === "aluno" &&
                          (a.minhaResposta ? (
                            <EtiquetaResposta estado={a.minhaResposta.estado} />
                          ) : (
                            <Etiqueta tom="marca">
                              <Camera className="h-3 w-3" aria-hidden /> Gravar resposta
                            </Etiqueta>
                          ))}
                        {a.pedeResposta && a.respostas && (
                          <Etiqueta tom={a.respostas.porRever ? "marca" : "neutro"}>
                            {a.respostas.total} responderam{a.respostas.porRever ? ` · ${a.respostas.porRever} por rever` : ""}
                          </Etiqueta>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {podePublicar && (
        <NovaAula
          turma={turma}
          aberto={nova}
          aoFechar={() => setNova(false)}
          aoPublicar={async () => {
            setNova(false);
            await recarregar();
          }}
        />
      )}
    </div>
  );
}

type OpcaoConteudo = ConteudoAtribuido & { detalhe: string };

function NovaAula({ turma, aberto, aoFechar, aoPublicar }: { turma: TurmaLga; aberto: boolean; aoFechar: () => void; aoPublicar: () => void }) {
  const { instituicaoId } = useInstituicaoAtual();
  const [tipo, setTipo] = useState<Aula["tipo"]>("aula");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [video, setVideo] = useState<VideoAnexo | null>(null);
  const [legenda, setLegenda] = useState(true);
  const [gestosIds, setGestosIds] = useState<string[]>([]);
  const [recursos, setRecursos] = useState<RecursoAula[]>([]);
  const [conteudo, setConteudo] = useState("");
  const [prazo, setPrazo] = useState("");
  const [pedeResposta, setPedeResposta] = useState(false);
  const [enunciado, setEnunciado] = useState("");
  const [gestos, setGestos] = useState<Gesto[]>([]);
  const [opcoes, setOpcoes] = useState<OpcaoConteudo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    void (async () => {
      const [g, daEscola, cursos, videos] = await Promise.all([
        apiLga.listarGestos(instituicaoId),
        apiLga.listarConteudos(instituicaoId),
        // Catálogo público da EYK (API real); sem ligação ao Django, fica só o da escola.
        api.getCursos().catch(() => []),
        api.getVideos("recent").catch(() => []),
      ]);
      if (!vivo) return;
      setGestos(g);
      setOpcoes([
        ...daEscola.map<OpcaoConteudo>((c) => ({ origem: "escola", tipo: c.tipo, id: c.id, titulo: c.titulo, detalhe: c.ambito.tipo === "turma" ? "da turma" : "da escola" })),
        ...cursos.map<OpcaoConteudo>((c) => ({ origem: "publico", tipo: "curso", id: String(c.id), titulo: c.title, detalhe: "catálogo público" })),
        ...videos.map<OpcaoConteudo>((v) => ({ origem: "publico", tipo: "video", id: String(v.id), titulo: v.title, detalhe: "catálogo público" })),
      ]);
    })();
    return () => {
      vivo = false;
    };
  }, [aberto, instituicaoId]);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setAEnviar(true);
    try {
      const escolhido = opcoes.find((o) => `${o.origem}:${o.tipo}:${o.id}` === conteudo) ?? null;
      await apiLga.publicarAula(instituicaoId, turma.id, {
        tipo,
        titulo,
        descricao,
        video: tipo === "aula" ? video : null,
        legendaPt: tipo === "aula" && legenda,
        gestosIds,
        recursos,
        conteudo: tipo === "atribuicao" && escolhido ? { origem: escolhido.origem, tipo: escolhido.tipo, id: escolhido.id, titulo: escolhido.titulo } : null,
        prazo: prazo ? deInputLuanda(`${prazo}T23:59`) : null,
        pedeResposta,
        enunciado,
      });
      setTitulo("");
      setDescricao("");
      setVideo(null);
      setGestosIds([]);
      setRecursos([]);
      setConteudo("");
      setPrazo("");
      setPedeResposta(false);
      setEnunciado("");
      aoPublicar();
    } catch (err) {
      setErro(erroTexto(err));
    } finally {
      setAEnviar(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div>
            <DialogTitle>Nova aula · {turma.nome}</DialogTitle>
            <DialogDescription>Os alunos e as famílias da turma vêem-na logo.</DialogDescription>
          </div>
        </DialogHeader>
        <form onSubmit={submeter} className="flex min-h-0 flex-col">
          <div className="space-y-4 overflow-y-auto p-5">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo">
              {(
                [
                  ["aula", "Aula sinalizada", "Carrega o vídeo da aula em LGA.", Hand],
                  ["atribuicao", "Atribuir conteúdo", "Um curso ou vídeo que já existe na EYK.", BookOpen],
                ] as const
              ).map(([valor, rotulo, ajuda, Icone]) => (
                <label
                  key={valor}
                  className={cn("flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm", tipo === valor ? "border-primary bg-primary/10" : "border-border")}
                >
                  <input type="radio" name="tipo-aula" className="sr-only" checked={tipo === valor} onChange={() => setTipo(valor)} />
                  <span className="flex items-center gap-1.5 font-medium">
                    <Icone className="h-4 w-4" aria-hidden /> {rotulo}
                  </span>
                  <span className="text-xs text-muted-foreground">{ajuda}</span>
                </label>
              ))}
            </div>

            <Campo id="na-titulo" rotulo="Título">
              <Input id="na-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="ex: Cores em LGA" required />
            </Campo>
            <Campo id="na-desc" rotulo="Descrição">
              <Textarea id="na-desc" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </Campo>

            {tipo === "aula" ? (
              <>
                <Campo id="na-video" rotulo="Vídeo sinalizado">
                  <CarregarVideo id="na-video" valor={video} onChange={setVideo} rotulo="Escolher o vídeo da aula" />
                </Campo>
                <Caixa id="na-legenda" checked={legenda} onChange={setLegenda} descricao="Ajuda famílias e professores ouvintes a acompanhar.">
                  O vídeo tem legenda em português
                </Caixa>
              </>
            ) : (
              <Campo id="na-conteudo" rotulo="Conteúdo a atribuir">
                <Seletor id="na-conteudo" value={conteudo} onChange={(e) => setConteudo(e.target.value)} required>
                  <option value="">Escolhe…</option>
                  {opcoes.map((o) => (
                    <option key={`${o.origem}:${o.tipo}:${o.id}`} value={`${o.origem}:${o.tipo}:${o.id}`}>
                      {o.tipo === "curso" ? "Curso" : "Vídeo"} · {o.titulo} ({o.detalhe})
                    </option>
                  ))}
                </Seletor>
              </Campo>
            )}

            <div className="space-y-1.5">
              <p className="text-sm font-medium">Gestos desta aula</p>
              <p className="text-xs text-muted-foreground">Ficam ligados ao gestuário para os alunos reverem e praticarem.</p>
              <EscolherGestos gestos={gestos} valor={gestosIds} onChange={setGestosIds} />
            </div>

            <Campo id="na-recursos" rotulo="Recursos (fichas, imagens)">
              <input
                id="na-recursos"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,image/*"
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium"
                onChange={(e) => setRecursos(Array.from(e.target.files ?? []).map((f) => ({ nome: f.name, tamanhoBytes: f.size })))}
              />
            </Campo>
            {recursos.length > 0 && (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {recursos.map((r) => (
                  <li key={r.nome} className="flex items-center gap-1.5">
                    <Paperclip className="h-3 w-3" aria-hidden /> {r.nome} · {tamanho(r.tamanhoBytes)}
                  </li>
                ))}
              </ul>
            )}

            <Campo id="na-prazo" rotulo="Prazo (opcional)">
              <Input id="na-prazo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </Campo>

            <Caixa id="na-resposta" checked={pedeResposta} onChange={setPedeResposta} descricao="O aluno grava-se com o telemóvel e tu corriges.">
              Pedir uma resposta em vídeo
            </Caixa>
            {pedeResposta && (
              <Campo id="na-enunciado" rotulo="O que o aluno deve gravar">
                <Input id="na-enunciado" value={enunciado} onChange={(e) => setEnunciado(e.target.value)} placeholder="ex: Apresenta-te em LGA" required />
              </Campo>
            )}
            {erro && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
          </div>
          <DialogFooter className="flex justify-end gap-2 space-y-0">
            <Button type="button" variant="outline" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={aEnviar}>
              {aEnviar ? "A publicar…" : "Publicar aula"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
