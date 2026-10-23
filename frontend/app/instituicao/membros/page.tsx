"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Info, Search, Ticket, UserMinus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/confirm-dialog";
import { Exige, useInstituicaoAtual } from "@/components/instituicao/contexto";
import { acao, Carregando, celula, ErroCarregar, Etiqueta, EtiquetaPapel, haQuanto, Seletor, Tabela, useCarregar } from "@/components/instituicao/ui";
import { apiInstituicoes as api } from "@/lib/instituicoes/api";
import { DESCRICAO_PAPEL, PAPEIS, ROTULO_PAPEL } from "@/lib/instituicoes/permissoes";
import type { Papel } from "@/lib/instituicoes/tipos";

export default function MembrosPage() {
  const { instituicaoId, papel, pode, atual, recarregar: recarregarPertencas } = useInstituicaoAtual();
  const confirmar = useConfirm();
  const [pesquisa, setPesquisa] = useState("");
  const [filtroPapel, setFiltroPapel] = useState<Papel | "">("");
  const gerir = pode("gerir_membros");

  const { dados, erro, aCarregar, recarregar } = useCarregar(async () => {
    const [membros, grupos] = await Promise.all([api.listarMembros(instituicaoId), api.listarGrupos(instituicaoId, true)]);
    return { membros, grupos };
  }, [instituicaoId]);

  const visiveis = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase();
    return (dados?.membros ?? [])
      .filter((m) => !filtroPapel || m.papel === filtroPapel)
      .filter((m) => !termo || m.nome.toLowerCase().includes(termo) || m.email.toLowerCase().includes(termo))
      .sort((a, b) => PAPEIS.indexOf(a.papel) - PAPEIS.indexOf(b.papel) || a.nome.localeCompare(b.nome));
  }, [dados, pesquisa, filtroPapel]);

  const permitido = ["administrador", "coordenador", "educador", "formador"].includes(papel);

  const mudarPapel = async (membroId: string, nome: string, novo: Papel) => {
    const ok = await confirmar({
      title: `Mudar o papel de ${nome}?`,
      description: `Passa a ser ${ROTULO_PAPEL[novo]}: ${DESCRICAO_PAPEL[novo]}`,
      confirmLabel: "Mudar papel",
    });
    if (!ok) return;
    if (await acao(() => api.alterarPapel(instituicaoId, membroId, novo), "Papel alterado.")) {
      await recarregar();
      if (membroId === atual.membro.id) await recarregarPertencas();
    }
  };

  const remover = async (membroId: string, nome: string) => {
    const ok = await confirmar({
      title: `Remover ${nome} da instituição?`,
      description: "Perde o acesso a esta instituição e deixa de ser tutor de qualquer criança. O histórico fica na auditoria.",
      confirmLabel: "Remover",
      destructive: true,
    });
    if (!ok) return;
    if (await acao(() => api.removerMembro(instituicaoId, membroId), `${nome} foi removido.`)) await recarregar();
  };

  return (
    <Exige permitido={permitido}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-2xl font-semibold">Membros e papéis</h2>
            <p className="text-sm text-muted-foreground">
              {gerir
                ? "Cada pessoa tem um papel nesta instituição. A mesma pessoa pode ter papéis diferentes noutras instituições."
                : papel === "educador"
                  ? "As pessoas dos teus grupos."
                  : "Quem faz parte da instituição."}
            </p>
          </div>
          {pode("convidar") && (
            <Button asChild className="gap-1.5">
              <Link href="/instituicao/convites">
                <Ticket className="h-4 w-4" /> Convidar
              </Link>
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              aria-label="Pesquisar membros"
              placeholder="Pesquisar por nome ou email"
              className="pl-9"
              value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)}
            />
          </div>
          <Seletor aria-label="Filtrar por papel" className="sm:w-56" value={filtroPapel} onChange={(e) => setFiltroPapel(e.target.value as Papel | "")}>
            <option value="">Todos os papéis</option>
            {PAPEIS.map((p) => (
              <option key={p} value={p}>
                {ROTULO_PAPEL[p]}
              </option>
            ))}
          </Seletor>
        </div>

        {aCarregar && !dados ? (
          <Carregando />
        ) : !dados ? (
          <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />
        ) : (
          <Card className="p-5 shadow-soft">
            <p className="mb-2 text-xs text-muted-foreground">
              {visiveis.length} de {dados.membros.length} pessoas
            </p>
            <Tabela cabecalho={["Pessoa", "Papel", "Grupos", "Último acesso", ...(gerir ? [""] : [])]}>
              {visiveis.map((m) => {
                const grupos = dados.grupos.filter((g) => m.gruposIds.includes(g.id)).map((g) => g.nome);
                return (
                  <tr key={m.id}>
                    <td className={celula}>
                      <p className="font-medium">
                        {m.nome}
                        {m.id === atual.membro.id && <span className="ml-1.5 text-xs text-muted-foreground">(tu)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </td>
                    <td className={celula}>
                      {gerir ? (
                        <Seletor
                          aria-label={`Papel de ${m.nome}`}
                          className="h-8 w-44 text-xs"
                          value={m.papel}
                          onChange={(e) => void mudarPapel(m.id, m.nome, e.target.value as Papel)}
                        >
                          {PAPEIS.map((p) => (
                            <option key={p} value={p}>
                              {ROTULO_PAPEL[p]}
                            </option>
                          ))}
                        </Seletor>
                      ) : (
                        <EtiquetaPapel papel={m.papel} />
                      )}
                      {m.estado === "pendente" && (
                        <span className="ml-2">
                          <Etiqueta tom="aviso">Convite por aceitar</Etiqueta>
                        </span>
                      )}
                    </td>
                    <td className={celula}>
                      <span className="text-xs text-muted-foreground">{grupos.length ? grupos.join(", ") : "—"}</span>
                    </td>
                    <td className={`${celula} whitespace-nowrap text-xs text-muted-foreground`}>{haQuanto(m.ultimoAcesso)}</td>
                    {gerir && (
                      <td className={`${celula} text-right`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remover ${m.nome}`}
                          title="Remover da instituição"
                          onClick={() => void remover(m.id, m.nome)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </Tabela>
            {visiveis.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Ninguém corresponde à pesquisa.</p>}
          </Card>
        )}

        <Card className="p-5 shadow-soft">
          <p className="mb-3 flex items-center gap-2 font-medium">
            <Info className="h-4 w-4 text-muted-foreground" aria-hidden /> O que cada papel pode fazer
          </p>
          <dl className="grid gap-3 sm:grid-cols-2">
            {PAPEIS.map((p) => (
              <div key={p} className="rounded-lg bg-surface/60 p-3">
                <dt>
                  <EtiquetaPapel papel={p} />
                </dt>
                <dd className="mt-1.5 text-sm text-muted-foreground">{DESCRICAO_PAPEL[p]}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">A instituição tem sempre pelo menos um administrador.</p>
        </Card>
      </div>
    </Exige>
  );
}
