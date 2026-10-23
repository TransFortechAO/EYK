"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenCheck, Hand, Plus, Video } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/eyk";
import { Exige, useInstituicaoAtual } from "@/components/instituicao/contexto";
import { Campo, Carregando, ErroCarregar, erroTexto, Etiqueta, Seletor, useCarregar } from "@/components/instituicao/ui";
import { apiLga } from "@/lib/instituicoes/lga";
import { DESCRICAO_PUBLICO_LGA, ROTULO_NIVEL_LGA, ROTULO_PUBLICO_LGA } from "@/lib/instituicoes/permissoes";
import type { NivelLga, PublicoTurmaLga } from "@/lib/instituicoes/tipos";
import { cn } from "@/lib/utils";

function anoLetivoAtual() {
  const d = new Date();
  const inicio = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${inicio}/${inicio + 1}`;
}

export default function TurmasLgaPage() {
  const { instituicaoId, pode, papel } = useInstituicaoAtual();
  const [nova, setNova] = useState(false);
  const { dados, erro, aCarregar, recarregar } = useCarregar(() => apiLga.listarTurmas(instituicaoId), [instituicaoId]);

  return (
    <Exige permitido={pode("ver_turmas_lga")}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-2xl font-semibold">Turmas LGA</h2>
            <p className="text-sm text-muted-foreground">
              {papel === "aluno"
                ? "As tuas turmas de Língua Gestual Angolana: aulas, trabalhos e a tua turma."
                : papel === "familia"
                  ? "As turmas de LGA da tua criança e as turmas para famílias."
                  : "Turmas dedicadas ao ensino da Língua Gestual Angolana: aulas sinalizadas, trabalhos com resposta em vídeo e progresso por competência."}
            </p>
          </div>
          {pode("gerir_turmas_lga") && (
            <Button className="gap-1.5" onClick={() => setNova(true)}>
              <Plus className="h-4 w-4" /> Abrir turma LGA
            </Button>
          )}
        </div>

        {aCarregar && !dados ? (
          <Carregando />
        ) : !dados ? (
          <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />
        ) : dados.length === 0 ? (
          <EmptyState
            icon={Hand}
            title="Ainda não há turmas LGA"
            description={pode("gerir_turmas_lga") ? "Abre a primeira turma e partilha o código com os alunos e as famílias." : "Quando entrares numa turma com um código, ela aparece aqui."}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dados.map((t) => (
              <Link key={t.id} href={`/instituicao/turmas/${t.id}`} className="group">
                <Card className="flex h-full flex-col gap-4 p-5 shadow-soft transition-shadow group-hover:shadow-elevated">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-gold text-primary-foreground shadow-gold">
                      <Hand className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="font-serif text-lg font-semibold leading-tight group-hover:underline underline-offset-2">{t.nome}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {ROTULO_PUBLICO_LGA[t.lga.publico]} · {ROTULO_NIVEL_LGA[t.lga.nivel]}
                      </p>
                    </div>
                  </div>
                  {t.lga.descricao && <p className="line-clamp-2 text-sm text-muted-foreground">{t.lga.descricao}</p>}
                  <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <Video className="h-4 w-4 text-muted-foreground" aria-hidden /> {t.aulas} aulas
                    </span>
                    <span className="text-muted-foreground">
                      {t.aprendizes} {t.lga.publico === "familias" ? "famílias" : t.lga.publico === "professores" ? "professores" : "alunos"}
                    </span>
                    {t.porRever > 0 && <Etiqueta tom="marca">{t.porRever} respostas por rever</Etiqueta>}
                    {t.pendentes > 0 && (
                      <Etiqueta tom="aviso">
                        <BookOpenCheck className="h-3 w-3" aria-hidden /> {t.pendentes} por fazer
                      </Etiqueta>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <NovaTurma aberto={nova} aoFechar={() => setNova(false)} />
      </div>
    </Exige>
  );
}

function NovaTurma({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const router = useRouter();
  const { instituicaoId } = useInstituicaoAtual();
  const [nome, setNome] = useState("");
  const [publico, setPublico] = useState<PublicoTurmaLga>("surdos_l1");
  const [nivel, setNivel] = useState<NivelLga>("iniciacao");
  const [ano, setAno] = useState(anoLetivoAtual());
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setAEnviar(true);
    try {
      const t = await apiLga.criarTurma(instituicaoId, { nome, publico, nivel, anoLetivo: ano, descricao });
      router.push(`/instituicao/turmas/${t.id}?separador=pessoas`);
    } catch (err) {
      setErro(erroTexto(err));
      setAEnviar(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div>
            <DialogTitle>Abrir turma LGA</DialogTitle>
            <DialogDescription>Recebes códigos para entregar aos alunos e às famílias, em papel ou por mensagem.</DialogDescription>
          </div>
        </DialogHeader>
        <form onSubmit={submeter} className="flex min-h-0 flex-col">
          <div className="space-y-4 overflow-y-auto p-5">
            <Campo id="nt-nome" rotulo="Nome da turma">
              <Input id="nt-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex: LGA Iniciação — 4.ª Classe B" required autoFocus />
            </Campo>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Para quem</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(ROTULO_PUBLICO_LGA) as PublicoTurmaLga[]).map((p) => (
                  <label
                    key={p}
                    className={cn(
                      "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition-colors",
                      publico === p ? "border-primary bg-primary/10" : "border-border hover:bg-surface",
                    )}
                  >
                    <input type="radio" name="publico" value={p} checked={publico === p} onChange={() => setPublico(p)} className="sr-only" />
                    <span className="font-medium">{ROTULO_PUBLICO_LGA[p]}</span>
                    <span className="text-xs text-muted-foreground">{DESCRICAO_PUBLICO_LGA[p]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="nt-nivel" rotulo="Nível">
                <Seletor id="nt-nivel" value={nivel} onChange={(e) => setNivel(e.target.value as NivelLga)}>
                  {(Object.keys(ROTULO_NIVEL_LGA) as NivelLga[]).map((n) => (
                    <option key={n} value={n}>
                      {ROTULO_NIVEL_LGA[n]}
                    </option>
                  ))}
                </Seletor>
              </Campo>
              <Campo id="nt-ano" rotulo="Ano letivo">
                <Input id="nt-ano" value={ano} onChange={(e) => setAno(e.target.value)} />
              </Campo>
            </div>
            <Campo id="nt-desc" rotulo="Descrição (opcional)">
              <Textarea id="nt-desc" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="O que esta turma vai aprender." />
            </Campo>
            {erro && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
          </div>
          <DialogFooter className="flex justify-end gap-2 space-y-0">
            <Button type="button" variant="outline" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={aEnviar}>
              {aEnviar ? "A abrir…" : "Abrir turma"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
