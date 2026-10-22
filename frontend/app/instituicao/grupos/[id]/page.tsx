"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Baby, Ticket, UserMinus, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Exige, useInstituicaoAtual } from "@/components/instituicao/contexto";
import { acao, Carregando, ErroCarregar, Etiqueta, EtiquetaPapel, Seletor, useCarregar } from "@/components/instituicao/ui";
import { apiInstituicoes as api } from "@/lib/instituicoes/api";
import { PAPEIS, ROTULO_PAPEL, ROTULO_TIPO_GRUPO } from "@/lib/instituicoes/permissoes";

export default function GrupoPage() {
  const { id } = useParams<{ id: string }>();
  const { instituicaoId, pode } = useInstituicaoAtual();
  const gerir = pode("gerir_grupos");
  const [aAdicionar, setAAdicionar] = useState("");

  const { dados, erro, aCarregar, recarregar } = useCarregar(async () => {
    const [grupos, membros, alunos] = await Promise.all([
      api.listarGrupos(instituicaoId, true),
      api.listarMembros(instituicaoId),
      api.listarAlunos(instituicaoId),
    ]);
    return { grupo: grupos.find((g) => g.id === id) ?? null, membros, alunos };
  }, [instituicaoId, id]);

  if (aCarregar && !dados) return <Carregando />;
  if (!dados) return <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />;
  if (!dados.grupo) {
    return (
      <Exige permitido={false}>
        <span />
      </Exige>
    );
  }

  const { grupo } = dados;
  const noGrupo = dados.membros.filter((m) => m.estado === "ativo" && m.gruposIds.includes(grupo.id));
  const foraDoGrupo = dados.membros.filter((m) => m.estado === "ativo" && !m.gruposIds.includes(grupo.id) && m.papel !== "observador");
  const criancas = dados.alunos.filter((a) => a.grupoId === grupo.id);

  const mudar = async (membroId: string, dentro: boolean) => {
    if (await acao(() => api.definirMembroNoGrupo(instituicaoId, grupo.id, membroId, dentro), dentro ? "Adicionado ao grupo." : "Retirado do grupo.")) {
      setAAdicionar("");
      await recarregar();
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/instituicao/grupos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Grupos
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold">{grupo.nome}</h2>
          <p className="text-sm text-muted-foreground">
            {ROTULO_TIPO_GRUPO[grupo.tipo]} · {grupo.anoLetivo}
            {grupo.arquivado && " · arquivado"}
          </p>
        </div>
        {pode("convidar") && !grupo.arquivado && (
          <Button asChild variant="outline" className="gap-1.5">
            <Link href="/instituicao/convites">
              <Ticket className="h-4 w-4" /> Convidar para o grupo
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card className="p-5 shadow-soft">
          <p className="mb-3 font-medium">Pessoas ({noGrupo.length})</p>
          {gerir && !grupo.arquivado && foraDoGrupo.length > 0 && (
            <div className="mb-4 flex gap-2">
              <Seletor aria-label="Adicionar pessoa ao grupo" value={aAdicionar} onChange={(e) => setAAdicionar(e.target.value)}>
                <option value="">Adicionar uma pessoa da instituição…</option>
                {foraDoGrupo.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome} · {ROTULO_PAPEL[m.papel]}
                  </option>
                ))}
              </Seletor>
              <Button disabled={!aAdicionar} onClick={() => void mudar(aAdicionar, true)} className="gap-1.5">
                <UserPlus className="h-4 w-4" /> Adicionar
              </Button>
            </div>
          )}
          <ul className="divide-y divide-border">
            {[...noGrupo]
              .sort((a, b) => PAPEIS.indexOf(a.papel) - PAPEIS.indexOf(b.papel) || a.nome.localeCompare(b.nome))
              .map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.nome}</p>
                    <EtiquetaPapel papel={m.papel} className="mt-0.5" />
                  </div>
                  {gerir && !grupo.arquivado && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Retirar ${m.nome} do grupo`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => void mudar(m.id, false)}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            {noGrupo.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Ainda ninguém neste grupo.</li>}
          </ul>
        </Card>

        <Card className="p-5 shadow-soft">
          <p className="mb-3 flex items-center gap-2 font-medium">
            <Baby className="h-4 w-4 text-muted-foreground" aria-hidden /> Crianças ({criancas.length})
          </p>
          <ul className="divide-y divide-border">
            {criancas.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="font-medium">{a.nome}</span>
                {a.estado === "ativo" ? (
                  <Etiqueta tom="sucesso">{a.tutoresIds.length} tutor{a.tutoresIds.length === 1 ? "" : "es"}</Etiqueta>
                ) : a.estado === "aguarda_consentimento" ? (
                  <Etiqueta tom="aviso">À espera de consentimento</Etiqueta>
                ) : (
                  <Etiqueta tom="neutro">Consentimento retirado</Etiqueta>
                )}
              </li>
            ))}
            {criancas.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Sem crianças neste grupo.</li>}
          </ul>
          <Button asChild variant="link" className="mt-2 px-0">
            <Link href="/instituicao/alunos">Gerir perfis e tutores</Link>
          </Button>
        </Card>
      </div>
    </div>
  );
}
