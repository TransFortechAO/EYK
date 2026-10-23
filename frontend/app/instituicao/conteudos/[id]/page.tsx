"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, Captions, Eye, Hand, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useInstituicaoAtual } from "@/components/instituicao/contexto";
import { VideoLga } from "@/components/instituicao/lga";
import { Carregando, dataCurta, ErroCarregar, Etiqueta, useCarregar } from "@/components/instituicao/ui";
import { apiLga } from "@/lib/instituicoes/lga";

export default function ConteudoEscolaPage() {
  const { id } = useParams<{ id: string }>();
  const { instituicaoId, atual } = useInstituicaoAtual();
  const { dados, erro, aCarregar, recarregar } = useCarregar(async () => {
    const conteudo = await apiLga.obterConteudo(instituicaoId, id);
    const turmas = await apiLga.listarTurmas(instituicaoId).catch(() => []);
    return { conteudo, turmas };
  }, [instituicaoId, id]);

  if (aCarregar && !dados) return <Carregando />;
  if (!dados) return <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />;

  const c = dados.conteudo;
  const turma = c.ambito.tipo === "turma" ? dados.turmas.find((t) => t.id === (c.ambito as { turmaId: string }).turmaId) : null;

  return (
    <div className="space-y-6">
      <Link href="/instituicao/conteudos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Conteúdos da escola
      </Link>
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          <VideoLga video={c.video ?? null} glyph={c.tipo === "curso" ? "📚" : "🤟"} titulo={c.titulo} />
          <div>
            <h2 className="font-serif text-2xl font-semibold">{c.titulo}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {c.autor} · {dataCurta(c.publicadoEm)}
            </p>
          </div>
          {c.descricao && <p className="text-sm">{c.descricao}</p>}
        </div>
        <Card className="h-fit space-y-3 p-5 shadow-soft">
          <div className="flex flex-wrap gap-2">
            <Etiqueta tom="marca">
              <Building2 className="h-3 w-3" aria-hidden /> {c.ambito.tipo === "turma" ? `Turma ${turma?.nome ?? ""}` : atual.instituicao.nome}
            </Etiqueta>
            {c.emLga && (
              <Etiqueta>
                <Hand className="h-3 w-3" aria-hidden /> Em LGA
              </Etiqueta>
            )}
            {c.temLegendas && (
              <Etiqueta>
                <Captions className="h-3 w-3" aria-hidden /> Legendas PT
              </Etiqueta>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Tipo</dt>
              <dd>{c.tipo === "curso" ? `Curso · ${c.aulas} lições` : "Vídeo"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Duração</dt>
              <dd>{c.duracaoMin} min</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Visualizações</dt>
              <dd className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" aria-hidden /> {c.vistas}
              </dd>
            </div>
          </dl>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {c.ambito.tipo === "turma" ? "Só os membros desta turma o vêem." : "Só os membros da escola o vêem."}
            {c.propostaPublica === "pendente" && " Foi proposto ao catálogo público da EYK."}
          </p>
          <p className="text-xs text-muted-foreground">Demonstração: as lições e o vídeo completo não estão incluídos.</p>
        </Card>
      </div>
    </div>
  );
}
