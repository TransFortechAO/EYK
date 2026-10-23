"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Hand } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInstituicaoAtual } from "@/components/instituicao/contexto";
import { Carregando, ErroCarregar, Etiqueta, useCarregar } from "@/components/instituicao/ui";
import { SeparadorAulas } from "@/components/instituicao/turma/aulas";
import { SeparadorRespostas } from "@/components/instituicao/turma/respostas";
import { SeparadorProgresso } from "@/components/instituicao/turma/progresso";
import { SeparadorComunidade } from "@/components/instituicao/turma/comunidade";
import { SeparadorClassificacao } from "@/components/instituicao/turma/classificacao";
import { SeparadorPessoas } from "@/components/instituicao/turma/pessoas";
import { apiLga } from "@/lib/instituicoes/lga";
import { pode as podeFazer, ROTULO_NIVEL_LGA, ROTULO_PUBLICO_LGA } from "@/lib/instituicoes/permissoes";

export default function TurmaLgaPage() {
  return (
    <Suspense fallback={<Carregando />}>
      <TurmaLga />
    </Suspense>
  );
}

function TurmaLga() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { instituicaoId, papel, atual } = useInstituicaoAtual();
  const { dados, erro, aCarregar, recarregar } = useCarregar(() => apiLga.obterTurma(instituicaoId, id), [instituicaoId, id]);

  if (aCarregar && !dados) return <Carregando />;
  if (!dados) return <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />;

  const { turma, ensino } = dados;
  const gestao = ensino || podeFazer(papel, "gerir_membros");
  const separadores = [
    { id: "aulas", titulo: "Aulas" },
    ...(ensino || papel === "aluno" || papel === "familia" ? [{ id: "respostas", titulo: ensino ? "Respostas" : papel === "aluno" ? "As minhas respostas" : "Respostas da criança" }] : []),
    ...(ensino || podeFazer(papel, "ver_todos_grupos") ? [{ id: "progresso", titulo: "Progresso" }] : []),
    { id: "comunidade", titulo: "Comunidade" },
    ...(atual.instituicao.escola.rankingVisivel ? [{ id: "classificacao", titulo: "Classificação" }] : []),
    ...(gestao || papel === "coordenador" ? [{ id: "pessoas", titulo: "Pessoas e códigos" }] : []),
  ];
  const pedido = params.get("separador");
  const separador = separadores.some((s) => s.id === pedido) ? pedido! : "aulas";

  return (
    <div className="space-y-6">
      <Link href="/instituicao/turmas" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Turmas LGA
      </Link>

      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-gold text-primary-foreground shadow-gold">
          <Hand className="h-6 w-6" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 className="font-serif text-2xl font-semibold">{turma.nome}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Etiqueta tom="marca">{ROTULO_PUBLICO_LGA[turma.lga.publico]}</Etiqueta>
            <Etiqueta>{ROTULO_NIVEL_LGA[turma.lga.nivel]}</Etiqueta>
            <span>{turma.anoLetivo}</span>
          </div>
          {turma.lga.descricao && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{turma.lga.descricao}</p>}
        </div>
      </div>

      <Tabs value={separador} onValueChange={(v) => router.replace(`/instituicao/turmas/${id}?separador=${v}`, { scroll: false })}>
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <TabsList className="h-auto w-max bg-surface py-1">
            {separadores.map((s) => (
              <TabsTrigger key={s.id} value={s.id}>
                {s.titulo}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="aulas" className="mt-6">
          <SeparadorAulas turma={turma} ensino={ensino} />
        </TabsContent>
        <TabsContent value="respostas" className="mt-6">
          <SeparadorRespostas turmaId={turma.id} ensino={ensino} />
        </TabsContent>
        <TabsContent value="progresso" className="mt-6">
          <SeparadorProgresso turmaId={turma.id} />
        </TabsContent>
        <TabsContent value="comunidade" className="mt-6">
          <SeparadorComunidade turmaId={turma.id} ensino={ensino} />
        </TabsContent>
        <TabsContent value="classificacao" className="mt-6">
          <SeparadorClassificacao turmaId={turma.id} />
        </TabsContent>
        <TabsContent value="pessoas" className="mt-6">
          <SeparadorPessoas dados={dados} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
