"use client";

import { useState, type FormEvent } from "react";
import { Globe, Library, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/eyk";
import { Exige, useInstituicaoAtual } from "@/components/instituicao/contexto";
import { CartaoConteudoEscola } from "@/components/instituicao/escola";
import { CarregarVideo } from "@/components/instituicao/lga";
import { acao, Caixa, Campo, Carregando, ErroCarregar, erroTexto, Etiqueta, Seletor, useCarregar } from "@/components/instituicao/ui";
import { apiLga, type TurmaLga } from "@/lib/instituicoes/lga";
import type { ConteudoEscola, VideoAnexo } from "@/lib/instituicoes/tipos";

export default function ConteudosEscolaPage() {
  const { instituicaoId, pode, atual } = useInstituicaoAtual();
  const [tipo, setTipo] = useState<"" | ConteudoEscola["tipo"]>("");
  const [ambito, setAmbito] = useState<"" | "instituicao" | "turma">("");
  const [novo, setNovo] = useState(false);
  const { dados, erro, aCarregar, recarregar } = useCarregar(async () => {
    const [conteudos, turmas] = await Promise.all([apiLga.listarConteudos(instituicaoId), apiLga.listarTurmas(instituicaoId).catch(() => [])]);
    return { conteudos, turmas };
  }, [instituicaoId]);

  const propor = async (c: ConteudoEscola) => {
    if (await acao(() => apiLga.proporPublico(instituicaoId, c.id), "Proposto ao catálogo público. A equipa EYK vai rever.")) await recarregar();
  };

  if (aCarregar && !dados) return <Carregando />;
  if (!dados) return <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />;

  const lista = dados.conteudos.filter((c) => (!tipo || c.tipo === tipo) && (!ambito || c.ambito.tipo === ambito));
  const nomeTurma = (c: ConteudoEscola) => (c.ambito.tipo === "turma" ? dados.turmas.find((t) => t.id === (c.ambito as { turmaId: string }).turmaId)?.nome ?? null : null);
  const podeProporEste = (c: ConteudoEscola) => pode("publicar_conteudos") && (c.autorId === atual.membro.id || pode("gerir_membros"));

  return (
    <Exige permitido={pode("ver_turmas_lga")}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-2xl font-semibold">Conteúdos da escola</h2>
            <p className="text-sm text-muted-foreground">
              Cursos e vídeos que os professores publicaram só para a escola ou para uma turma. Aparecem também em Cursos e Vídeos, em «Da minha escola», ao lado do catálogo público da EYK.
            </p>
          </div>
          {pode("publicar_conteudos") && (
            <Button className="gap-1.5" onClick={() => setNovo(true)}>
              <Plus className="h-4 w-4" /> Publicar
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Seletor aria-label="Tipo" className="w-40" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
            <option value="">Cursos e vídeos</option>
            <option value="curso">Cursos</option>
            <option value="video">Vídeos</option>
          </Seletor>
          <Seletor aria-label="Para quem" className="w-48" value={ambito} onChange={(e) => setAmbito(e.target.value as typeof ambito)}>
            <option value="">Escola e turmas</option>
            <option value="instituicao">Toda a escola</option>
            <option value="turma">Só uma turma</option>
          </Seletor>
        </div>

        {lista.length === 0 ? (
          <EmptyState icon={Library} title="Sem conteúdos" description={pode("publicar_conteudos") ? "Publica um curso ou vídeo para a escola ou para uma turma." : undefined} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {lista.map((c) => (
              <div key={c.id} className="flex flex-col gap-2">
                <CartaoConteudoEscola conteudo={c} turma={nomeTurma(c)} />
                <div className="flex items-center justify-between gap-2 px-1">
                  <span className="text-xs text-muted-foreground">{c.vistas} visualizações</span>
                  {c.propostaPublica === "pendente" ? (
                    <Etiqueta tom="aviso">Proposto ao catálogo</Etiqueta>
                  ) : c.propostaPublica === "aceite" ? (
                    <Etiqueta tom="sucesso">No catálogo público</Etiqueta>
                  ) : (
                    podeProporEste(c) && (
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => void propor(c)}>
                        <Globe className="h-3.5 w-3.5" /> Propor ao catálogo público
                      </Button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {pode("publicar_conteudos") && (
          <PublicarConteudo
            aberto={novo}
            turmas={dados.turmas.filter((t) => atual.membro.gruposIds.includes(t.id) || pode("gerir_membros"))}
            aoFechar={() => setNovo(false)}
            aoPublicar={async () => {
              setNovo(false);
              await recarregar();
            }}
          />
        )}
      </div>
    </Exige>
  );
}

function PublicarConteudo({ aberto, turmas, aoFechar, aoPublicar }: { aberto: boolean; turmas: TurmaLga[]; aoFechar: () => void; aoPublicar: () => void }) {
  const { instituicaoId } = useInstituicaoAtual();
  const [tipo, setTipo] = useState<ConteudoEscola["tipo"]>("video");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [para, setPara] = useState("instituicao");
  const [video, setVideo] = useState<VideoAnexo | null>(null);
  const [aulas, setAulas] = useState(5);
  const [duracaoMin, setDuracaoMin] = useState(5);
  const [legendas, setLegendas] = useState(true);
  const [emLga, setEmLga] = useState(true);
  const [tambemGeral, setTambemGeral] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      const publicado = await apiLga.publicarConteudo(instituicaoId, {
        tipo,
        titulo,
        descricao,
        ambito: para === "instituicao" ? { tipo: "instituicao", instituicaoId } : { tipo: "turma", instituicaoId, turmaId: para },
        duracaoMin: video?.duracaoSeg ? Math.max(1, Math.round(video.duracaoSeg / 60)) : duracaoMin,
        aulas: tipo === "curso" ? aulas : 0,
        temLegendas: legendas,
        emLga,
        video: tipo === "video" ? video : null,
      });
      // Também na plataforma geral: fica já na escola e segue como proposta para a equipa EYK aprovar.
      if (tambemGeral) await apiLga.proporPublico(instituicaoId, publicado.id);
      setTambemGeral(false);
      setTitulo("");
      setDescricao("");
      setVideo(null);
      aoPublicar();
    } catch (err) {
      setErro(erroTexto(err));
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <div>
            <DialogTitle>Publicar curso ou vídeo</DialogTitle>
            <DialogDescription>Para as tuas turmas ou para toda a escola, sem aprovação. Se quiseres, também para a plataforma geral.</DialogDescription>
          </div>
        </DialogHeader>
        <form onSubmit={submeter} className="flex min-h-0 flex-col">
          <div className="space-y-4 overflow-y-auto p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="pc-tipo" rotulo="Tipo">
                <Seletor id="pc-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as ConteudoEscola["tipo"])}>
                  <option value="video">Vídeo</option>
                  <option value="curso">Curso</option>
                </Seletor>
              </Campo>
              <Campo id="pc-para" rotulo="Para quem">
                <Seletor id="pc-para" value={para} onChange={(e) => setPara(e.target.value)}>
                  <option value="instituicao">Toda a escola</option>
                  {turmas.map((t) => (
                    <option key={t.id} value={t.id}>
                      Só a turma {t.nome}
                    </option>
                  ))}
                </Seletor>
              </Campo>
            </div>
            <Campo id="pc-titulo" rotulo="Título">
              <Input id="pc-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
            </Campo>
            <Campo id="pc-desc" rotulo="Descrição">
              <Textarea id="pc-desc" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </Campo>
            {tipo === "video" ? (
              <Campo id="pc-video" rotulo="Vídeo">
                <CarregarVideo id="pc-video" valor={video} onChange={setVideo} />
              </Campo>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo id="pc-aulas" rotulo="Número de lições">
                  <Input id="pc-aulas" type="number" min={1} value={aulas} onChange={(e) => setAulas(Number(e.target.value))} />
                </Campo>
                <Campo id="pc-dur" rotulo="Duração total (min)">
                  <Input id="pc-dur" type="number" min={1} value={duracaoMin} onChange={(e) => setDuracaoMin(Number(e.target.value))} />
                </Campo>
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <Caixa id="pc-lga" checked={emLga} onChange={setEmLga}>
                Sinalizado em LGA
              </Caixa>
              <Caixa id="pc-leg" checked={legendas} onChange={setLegendas}>
                Com legendas em português
              </Caixa>
            </div>
            <Caixa
              id="pc-geral"
              checked={tambemGeral}
              onChange={setTambemGeral}
              descricao="Fica já disponível para a escola ou turma. Na plataforma geral aparece a todos os utilizadores da EYK depois de a equipa EYK aprovar."
            >
              Publicar também na plataforma geral
            </Caixa>
            {erro && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
          </div>
          <DialogFooter className="flex justify-end gap-2 space-y-0">
            <Button type="button" variant="outline" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit">Publicar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
