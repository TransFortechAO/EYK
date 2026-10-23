"use client";

import { useMemo, useState, type FormEvent } from "react";
import { BadgeCheck, Hand, Plus, Search, ShieldQuestion, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/eyk";
import { Exige, useInstituicaoAtual } from "@/components/instituicao/contexto";
import { CarregarVideo, CartaoGesto } from "@/components/instituicao/lga";
import { acao, Campo, Carregando, ErroCarregar, erroTexto, Etiqueta, haQuanto, Seletor, useCarregar } from "@/components/instituicao/ui";
import { apiLga } from "@/lib/instituicoes/lga";
import { ROTULO_TEMA } from "@/lib/instituicoes/permissoes";
import type { Gesto, TemaGesto, VideoAnexo } from "@/lib/instituicoes/tipos";

const PROVINCIAS = [
  "Comum", "Bengo", "Benguela", "Bié", "Cabinda", "Cuando", "Cubango", "Cuanza Norte", "Cuanza Sul", "Cunene", "Huambo", "Huíla",
  "Icolo e Bengo", "Luanda", "Lunda Norte", "Lunda Sul", "Malanje", "Moxico", "Moxico Leste", "Namibe", "Uíge", "Zaire",
];

type Vista = "validados" | "por_validar" | "meus";

export default function GestuarioPage() {
  const { instituicaoId, pode, atual } = useInstituicaoAtual();
  const [vista, setVista] = useState<Vista>("validados");
  const [tema, setTema] = useState<TemaGesto | "">("");
  const [variante, setVariante] = useState("");
  const [pesquisa, setPesquisa] = useState("");
  const [propor, setPropor] = useState(false);
  const [aRever, setARever] = useState<Gesto | null>(null);
  const { dados, erro, aCarregar, recarregar } = useCarregar(() => apiLga.listarGestos(instituicaoId), [instituicaoId]);

  const lista = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase();
    return (dados ?? []).filter((g) => {
      if (vista === "validados" && g.estado !== "validado") return false;
      if (vista === "por_validar" && g.estado !== "proposto") return false;
      if (vista === "meus" && g.propostoPor !== atual.membro.nome) return false;
      return (!tema || g.tema === tema) && (!variante || g.variante === variante) && (!termo || g.palavra.toLowerCase().includes(termo));
    });
  }, [dados, vista, tema, variante, pesquisa, atual]);

  const porValidar = (dados ?? []).filter((g) => g.estado === "proposto").length;
  const variantes = Array.from(new Set((dados ?? []).map((g) => g.variante))).sort();

  return (
    <Exige permitido={pode("praticar") || pode("propor_gestos")}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-2xl font-semibold">Gestuário</h2>
            <p className="text-sm text-muted-foreground">
              Os gestos da LGA em vídeo, por tema e com as variantes de cada província. Cada gesto é validado por um formador surdo ou
              pela coordenação antes de ficar visível a todos — e passa a servir também a Biblioteca LGA.
            </p>
          </div>
          {pode("propor_gestos") && (
            <Button className="gap-1.5" onClick={() => setPropor(true)}>
              <Plus className="h-4 w-4" /> Propor gesto
            </Button>
          )}
        </div>

        <Tabs value={vista} onValueChange={(v) => setVista(v as Vista)}>
          <TabsList className="h-auto flex-wrap bg-surface py-1">
            <TabsTrigger value="validados">Validados</TabsTrigger>
            {pode("validar_gestos") && <TabsTrigger value="por_validar">Por validar {porValidar > 0 && `(${porValidar})`}</TabsTrigger>}
            {pode("propor_gestos") && <TabsTrigger value="meus">Os que propus</TabsTrigger>}
          </TabsList>
        </Tabs>

        <div className="grid gap-2 sm:grid-cols-[1fr_12rem_12rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input aria-label="Pesquisar gestos" placeholder="Pesquisar palavra ou frase" className="pl-9" value={pesquisa} onChange={(e) => setPesquisa(e.target.value)} />
          </div>
          <Seletor aria-label="Tema" value={tema} onChange={(e) => setTema(e.target.value as TemaGesto | "")}>
            <option value="">Todos os temas</option>
            {(Object.keys(ROTULO_TEMA) as TemaGesto[]).map((t) => (
              <option key={t} value={t}>
                {ROTULO_TEMA[t]}
              </option>
            ))}
          </Seletor>
          <Seletor aria-label="Variante" value={variante} onChange={(e) => setVariante(e.target.value)}>
            <option value="">Todas as variantes</option>
            {variantes.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Seletor>
        </div>

        {aCarregar && !dados ? (
          <Carregando />
        ) : !dados ? (
          <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />
        ) : lista.length === 0 ? (
          <EmptyState icon={Hand} title={vista === "por_validar" ? "Nada por validar" : "Nenhum gesto encontrado"} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {lista.map((g) => (
              <CartaoGesto key={g.id} gesto={g}>
                {g.estado === "proposto" && (
                  <>
                    <p className="text-[11px] text-muted-foreground">
                      Proposto por {g.propostoPor}, {haQuanto(g.propostoEm)}
                    </p>
                    {pode("validar_gestos") && g.propostoPor !== atual.membro.nome ? (
                      <Button size="sm" className="mt-1 w-full gap-1.5" onClick={() => setARever(g)}>
                        <ShieldQuestion className="h-4 w-4" /> Rever
                      </Button>
                    ) : (
                      <Etiqueta tom="aviso">À espera de validação</Etiqueta>
                    )}
                  </>
                )}
                {g.estado === "rejeitado" && (
                  <div className="space-y-1">
                    <Etiqueta tom="perigo">Rejeitado</Etiqueta>
                    {g.validacao?.nota && <p className="text-[11px] text-muted-foreground">«{g.validacao.nota}» — {g.validacao.por}</p>}
                  </div>
                )}
                {g.estado === "validado" && g.instituicaoId && (
                  <p className="inline-flex items-center gap-1 text-[11px] text-success">
                    <BadgeCheck className="h-3 w-3" aria-hidden /> Contributo da escola
                  </p>
                )}
              </CartaoGesto>
            ))}
          </div>
        )}

        <ProporGesto
          aberto={propor}
          aoFechar={() => setPropor(false)}
          aoPropor={async () => {
            setPropor(false);
            setVista("meus");
            await recarregar();
          }}
        />
        <ReverGesto gesto={aRever} aoFechar={() => setARever(null)} aoRever={async () => {
          setARever(null);
          await recarregar();
        }} />
      </div>
    </Exige>
  );
}

function ProporGesto({ aberto, aoFechar, aoPropor }: { aberto: boolean; aoFechar: () => void; aoPropor: () => void }) {
  const { instituicaoId, atual } = useInstituicaoAtual();
  const [palavra, setPalavra] = useState("");
  const [tema, setTema] = useState<TemaGesto>("escola");
  const [variante, setVariante] = useState("Comum");
  const [descricao, setDescricao] = useState("");
  const [video, setVideo] = useState<VideoAnexo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await apiLga.proporGesto(instituicaoId, { palavra, tema, variante, descricao, video });
      setPalavra("");
      setDescricao("");
      setVideo(null);
      aoPropor();
    } catch (err) {
      setErro(erroTexto(err));
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <div>
            <DialogTitle>Propor um gesto</DialogTitle>
            <DialogDescription>Outra pessoa (formador surdo ou coordenação) valida antes de ficar visível a todos.</DialogDescription>
          </div>
        </DialogHeader>
        <form onSubmit={submeter} className="flex min-h-0 flex-col">
          <div className="space-y-4 overflow-y-auto p-5">
            <Campo id="pg-palavra" rotulo="Palavra ou frase">
              <Input id="pg-palavra" value={palavra} onChange={(e) => setPalavra(e.target.value)} required autoFocus />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="pg-tema" rotulo="Tema">
                <Seletor id="pg-tema" value={tema} onChange={(e) => setTema(e.target.value as TemaGesto)}>
                  {(Object.keys(ROTULO_TEMA) as TemaGesto[]).map((t) => (
                    <option key={t} value={t}>
                      {ROTULO_TEMA[t]}
                    </option>
                  ))}
                </Seletor>
              </Campo>
              <Campo id="pg-variante" rotulo="Variante" ajuda={`Onde se usa. A escola é de ${atual.instituicao.provincia}.`}>
                <Seletor id="pg-variante" value={variante} onChange={(e) => setVariante(e.target.value)}>
                  {PROVINCIAS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Seletor>
              </Campo>
            </div>
            <Campo id="pg-video" rotulo="Vídeo do gesto">
              <CarregarVideo id="pg-video" valor={video} onChange={setVideo} captura="user" rotulo="Gravar ou escolher o vídeo" />
            </Campo>
            <Campo id="pg-desc" rotulo="Descrição" ajuda="Configuração da mão, movimento e expressão facial.">
              <Textarea id="pg-desc" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </Campo>
            {erro && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
          </div>
          <DialogFooter className="flex justify-end gap-2 space-y-0">
            <Button type="button" variant="outline" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit">Propor</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReverGesto({ gesto, aoFechar, aoRever }: { gesto: Gesto | null; aoFechar: () => void; aoRever: () => void }) {
  const { instituicaoId } = useInstituicaoAtual();
  const [nota, setNota] = useState("");

  const decidir = async (aprovar: boolean) => {
    if (!gesto) return;
    const ok = await acao(() => apiLga.validarGesto(instituicaoId, gesto.id, aprovar, nota), aprovar ? "Gesto validado." : "Gesto rejeitado.");
    if (ok) {
      setNota("");
      aoRever();
    }
  };

  return (
    <Dialog open={!!gesto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <div>
            <DialogTitle>Rever «{gesto?.palavra}»</DialogTitle>
            <DialogDescription>
              {gesto?.variante} · proposto por {gesto?.propostoPor}
            </DialogDescription>
          </div>
        </DialogHeader>
        {gesto && (
          <div className="space-y-4 overflow-y-auto p-5">
            <div className="mx-auto max-w-56">
              <CartaoGesto gesto={gesto} />
            </div>
            <Campo id="rg-nota" rotulo="Nota" ajuda="Obrigatória para rejeitar: explica o que corrigir.">
              <Textarea id="rg-nota" rows={2} value={nota} onChange={(e) => setNota(e.target.value)} />
            </Campo>
          </div>
        )}
        <DialogFooter className="flex justify-end gap-2 space-y-0">
          <Button variant="outline" className="gap-1.5" onClick={() => void decidir(false)}>
            <X className="h-4 w-4" /> Rejeitar
          </Button>
          <Button className="gap-1.5" onClick={() => void decidir(true)}>
            <BadgeCheck className="h-4 w-4" /> Validar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
