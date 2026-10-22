"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, Plus, UsersRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/eyk";
import { useConfirm } from "@/components/confirm-dialog";
import { Exige, useInstituicaoAtual } from "@/components/instituicao/contexto";
import { acao, Campo, Carregando, ErroCarregar, erroTexto, Etiqueta, Seletor, useCarregar } from "@/components/instituicao/ui";
import { apiInstituicoes as api } from "@/lib/instituicoes/api";
import { ROTULO_TIPO_GRUPO } from "@/lib/instituicoes/permissoes";
import type { TipoGrupo } from "@/lib/instituicoes/tipos";

function anoLetivoAtual() {
  const d = new Date();
  const inicio = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${inicio}/${inicio + 1}`;
}

export default function GruposPage() {
  const { instituicaoId, pode, papel } = useInstituicaoAtual();
  const confirmar = useConfirm();
  const [arquivados, setArquivados] = useState(false);
  const [novo, setNovo] = useState(false);
  const gerir = pode("gerir_grupos");

  const { dados, erro, aCarregar, recarregar } = useCarregar(() => api.listarGrupos(instituicaoId, true), [instituicaoId]);

  const arquivar = async (id: string, nome: string, valor: boolean) => {
    if (valor) {
      const ok = await confirmar({
        title: `Arquivar «${nome}»?`,
        description: "O grupo sai das listas, mas os avisos, ficheiros e o histórico ficam guardados. Podes reativá-lo depois.",
        confirmLabel: "Arquivar",
      });
      if (!ok) return;
    }
    if (await acao(() => api.arquivarGrupo(instituicaoId, id, valor), valor ? "Grupo arquivado." : "Grupo reativado.")) await recarregar();
  };

  const lista = (dados ?? []).filter((g) => g.arquivado === arquivados);

  return (
    <Exige permitido={gerir || pode("ver_todos_grupos")}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-2xl font-semibold">Turmas e grupos</h2>
            <p className="text-sm text-muted-foreground">
              {papel === "educador" ? "Os grupos a que pertences." : "Turmas, grupos de apoio e grupos de famílias da instituição."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-1.5" onClick={() => setArquivados((v) => !v)}>
              <Archive className="h-4 w-4" /> {arquivados ? "Ver ativos" : "Arquivados"}
            </Button>
            {gerir && (
              <Button className="gap-1.5" onClick={() => setNovo(true)}>
                <Plus className="h-4 w-4" /> Novo grupo
              </Button>
            )}
          </div>
        </div>

        {aCarregar && !dados ? (
          <Carregando />
        ) : !dados ? (
          <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />
        ) : lista.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title={arquivados ? "Sem grupos arquivados" : "Ainda não há grupos"}
            description={arquivados ? undefined : "Cria uma turma ou um grupo para dirigir avisos, ficheiros e eventos."}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {lista.map((g) => (
              <Card key={g.id} className="flex flex-col gap-4 p-5 shadow-soft transition-shadow hover:shadow-elevated">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/instituicao/grupos/${g.id}`} className="font-serif text-lg font-semibold hover:underline underline-offset-2">
                      {g.nome}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {ROTULO_TIPO_GRUPO[g.tipo]} · {g.anoLetivo}
                    </p>
                  </div>
                  {g.arquivado && <Etiqueta>Arquivado</Etiqueta>}
                </div>
                <div className="flex gap-6 text-sm">
                  <p>
                    <span className="font-semibold tabular-nums">{g.membros}</span> <span className="text-muted-foreground">pessoas</span>
                  </p>
                  <p>
                    <span className="font-semibold tabular-nums">{g.alunos}</span> <span className="text-muted-foreground">crianças</span>
                  </p>
                </div>
                <div className="mt-auto flex gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/instituicao/grupos/${g.id}`}>Abrir</Link>
                  </Button>
                  {gerir && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => void arquivar(g.id, g.nome, !g.arquivado)}
                      title={g.arquivado ? "Reativar" : "Arquivar no fim do ano letivo"}
                    >
                      {g.arquivado ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      {g.arquivado ? "Reativar" : "Arquivar"}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        <NovoGrupo
          aberto={novo}
          aoFechar={() => setNovo(false)}
          aoCriar={async () => {
            setNovo(false);
            await recarregar();
          }}
        />
      </div>
    </Exige>
  );
}

function NovoGrupo({ aberto, aoFechar, aoCriar }: { aberto: boolean; aoFechar: () => void; aoCriar: () => void }) {
  const { instituicaoId } = useInstituicaoAtual();
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoGrupo>("turma");
  const [ano, setAno] = useState(anoLetivoAtual());
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    setAEnviar(true);
    setErro(null);
    try {
      await api.criarGrupo(instituicaoId, { nome, tipo, anoLetivo: ano });
      setNome("");
      aoCriar();
    } catch (err) {
      setErro(erroTexto(err));
    } finally {
      setAEnviar(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <div>
            <DialogTitle>Novo grupo</DialogTitle>
            <DialogDescription>Uma turma, um grupo de apoio ou um grupo de famílias.</DialogDescription>
          </div>
        </DialogHeader>
        <form onSubmit={submeter} className="flex min-h-0 flex-col">
          <div className="space-y-4 overflow-y-auto p-5">
            <Campo id="ng-nome" rotulo="Nome">
              <Input id="ng-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex: 3.ª Classe A" required autoFocus />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="ng-tipo" rotulo="Tipo">
                <Seletor id="ng-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoGrupo)}>
                  {(Object.keys(ROTULO_TIPO_GRUPO) as TipoGrupo[]).map((t) => (
                    <option key={t} value={t}>
                      {ROTULO_TIPO_GRUPO[t]}
                    </option>
                  ))}
                </Seletor>
              </Campo>
              <Campo id="ng-ano" rotulo="Ano letivo">
                <Input id="ng-ano" value={ano} onChange={(e) => setAno(e.target.value)} placeholder="2026/2027" />
              </Campo>
            </div>
            {erro && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
          </div>
          <DialogFooter className="flex justify-end gap-2 space-y-0">
            <Button type="button" variant="outline" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={aEnviar}>
              {aEnviar ? "A criar…" : "Criar grupo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
