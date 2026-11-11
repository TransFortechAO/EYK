"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Printer, UserMinus, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useInstituicaoAtual } from "@/components/instituicao/contexto";
import { acao, dataCurta, EtiquetaPapel, Seletor } from "@/components/instituicao/ui";
import { apiInstituicoes } from "@/lib/instituicoes/api";
import type { apiLga } from "@/lib/instituicoes/lga";
import { PAPEIS, ROTULO_PAPEL, ROTULO_PUBLICO_LGA } from "@/lib/instituicoes/permissoes";
import type { Convite, Membro } from "@/lib/instituicoes/tipos";

type DadosTurma = Awaited<ReturnType<typeof apiLga.obterTurma>>;

function escapar(texto: string) {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Abre uma página simples com o código em letra grande, para imprimir e entregar em papel. */
function imprimirCodigo(escola: string, turma: string, convite: Convite) {
  const janela = window.open("", "_blank", "width=600,height=700");
  if (!janela) return;
  const para = convite.papel === "familia" ? "Famílias" : ROTULO_PAPEL[convite.papel] + "s";
  janela.document.write(`<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>Código ${escapar(convite.codigo)}</title>
<style>body{font-family:system-ui,sans-serif;text-align:center;padding:48px 24px;color:#111}h1{font-size:22px;margin:0 0 4px}
p{margin:6px 0;font-size:16px}.codigo{font-family:monospace;font-size:56px;font-weight:700;letter-spacing:.3em;margin:28px 0;padding:16px;border:3px dashed #ad7a14;border-radius:16px}
ol{text-align:left;max-width:420px;margin:24px auto;font-size:16px;line-height:1.6}</style></head><body>
<h1>${escapar(escola)}</h1><p>${escapar(turma)}</p><p><strong>Para: ${escapar(para)}</strong></p>
<div class="codigo">${escapar(convite.codigo)}</div>
<ol><li>Entra no EYK (ou cria conta).</li><li>Abre <strong>Instituição → Tenho um código</strong>.</li><li>Escreve o código acima.</li></ol>
<p>Válido até ${escapar(dataCurta(convite.expiraEm))}.</p></body></html>`);
  janela.document.close();
  janela.focus();
  janela.print();
}

function CartaoCodigo({ titulo, convite, turmaNome }: { titulo: string; convite: Convite | null; turmaNome: string }) {
  const { atual } = useInstituicaoAtual();
  const [copiado, setCopiado] = useState(false);
  if (!convite) return null;
  return (
    <Card className="space-y-3 p-5 shadow-soft">
      <p className="text-sm font-medium">{titulo}</p>
      <p className="font-mono text-3xl font-bold tracking-[0.3em] text-primary">{convite.codigo}</p>
      <p className="text-xs text-muted-foreground">
        {convite.usos} de {convite.usosMax} utilizações · válido até {dataCurta(convite.expiraEm)}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(convite.codigo);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 1500);
            } catch {
              /* o código está visível */
            }
          }}
        >
          {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copiar
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => imprimirCodigo(atual.instituicao.nome, turmaNome, convite)}>
          <Printer className="h-4 w-4" /> Imprimir para entregar
        </Button>
      </div>
    </Card>
  );
}

function ListaPessoas({ titulo, pessoas, aoRetirar }: { titulo: string; pessoas: Membro[]; aoRetirar?: (m: Membro) => void }) {
  return (
    <Card className="p-5 shadow-soft">
      <p className="mb-2 font-medium">
        {titulo} ({pessoas.length})
      </p>
      {pessoas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ninguém ainda.</p>
      ) : (
        <ul className="divide-y divide-border">
          {pessoas.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0 truncate">{p.nome}</span>
              <span className="flex shrink-0 items-center gap-1">
                <EtiquetaPapel papel={p.papel} />
                {aoRetirar && (
                  <Button variant="ghost" size="icon" aria-label={`Retirar ${p.nome} da turma`} className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => aoRetirar(p)}>
                    <UserMinus className="h-3.5 w-3.5" />
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** A administração (e quem gere grupos) põe professores, alunos e famílias da escola nesta turma. */
function AdicionarATurma({ turmaId, jaNaTurma, aoMudar }: { turmaId: string; jaNaTurma: Set<string>; aoMudar: () => void }) {
  const { instituicaoId } = useInstituicaoAtual();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [escolhido, setEscolhido] = useState("");

  useEffect(() => {
    void apiInstituicoes
      .listarMembros(instituicaoId)
      .then((m) => setMembros(m.filter((x) => x.estado === "ativo")))
      .catch(() => setMembros([]));
  }, [instituicaoId]);

  const disponiveis = membros.filter((m) => !jaNaTurma.has(m.id)).sort((a, b) => PAPEIS.indexOf(a.papel) - PAPEIS.indexOf(b.papel) || a.nome.localeCompare(b.nome));
  const adicionar = async () => {
    if (await acao(() => apiInstituicoes.definirMembroNoGrupo(instituicaoId, turmaId, escolhido, true), "Adicionado à turma.")) {
      setEscolhido("");
      aoMudar();
    }
  };

  return (
    <Card className="space-y-3 p-5 shadow-soft">
      <p className="flex items-center gap-2 font-medium">
        <UserPlus className="h-4 w-4 text-primary" aria-hidden /> Adicionar à turma
      </p>
      <p className="text-xs text-muted-foreground">Escolhe quem leciona (educadores) ou quem aprende. Para pessoas que ainda não estão na escola, usa os códigos.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Seletor aria-label="Pessoa a adicionar" value={escolhido} onChange={(e) => setEscolhido(e.target.value)}>
          <option value="">Escolhe uma pessoa da escola…</option>
          {disponiveis.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome} · {ROTULO_PAPEL[m.papel]}
            </option>
          ))}
        </Seletor>
        <Button disabled={!escolhido} onClick={() => void adicionar()} className="gap-1.5">
          <UserPlus className="h-4 w-4" /> Adicionar
        </Button>
      </div>
    </Card>
  );
}

export function SeparadorPessoas({ dados, aoMudar }: { dados: DadosTurma; aoMudar: () => void }) {
  const { instituicaoId, pode } = useInstituicaoAtual();
  const { turma, professores, aprendizes, familias, codigos } = dados;
  const publico = turma.lga.publico;
  const gerir = pode("gerir_grupos");
  const naTurma = new Set([...professores, ...aprendizes, ...familias].map((m) => m.id));

  const retirar = async (m: Membro) => {
    if (await acao(() => apiInstituicoes.definirMembroNoGrupo(instituicaoId, turma.id, m.id, false), `${m.nome} saiu da turma.`)) aoMudar();
  };

  return (
    <div className="space-y-6">
      {gerir && <AdicionarATurma turmaId={turma.id} jaNaTurma={naTurma} aoMudar={aoMudar} />}
      {(codigos.alunos || codigos.familias) && (
        <div className="grid gap-4 md:grid-cols-2">
          <CartaoCodigo titulo={publico === "professores" ? "Código para professores" : "Código para alunos"} convite={codigos.alunos} turmaNome={turma.nome} />
          <CartaoCodigo titulo="Código para famílias" convite={codigos.familias} turmaNome={turma.nome} />
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Quem entra com o código fica nesta turma ({ROTULO_PUBLICO_LGA[publico]}). Se a escola aprovar pedidos por código, aparecem em Convites → Pedidos de adesão.
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        <ListaPessoas titulo="Quem ensina" pessoas={professores} aoRetirar={gerir ? retirar : undefined} />
        <ListaPessoas
          titulo={publico === "familias" ? "Famílias" : publico === "professores" ? "Professores em formação" : "Alunos"}
          pessoas={aprendizes}
          aoRetirar={gerir ? retirar : undefined}
        />
        {publico !== "familias" && publico !== "professores" && (
          <ListaPessoas titulo="Famílias que acompanham" pessoas={familias} aoRetirar={gerir ? retirar : undefined} />
        )}
      </div>
    </div>
  );
}
