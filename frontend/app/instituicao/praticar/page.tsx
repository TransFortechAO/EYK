"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Coins, Dumbbell, Target, X } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/eyk";
import { Exige, useInstituicaoAtual } from "@/components/instituicao/contexto";
import { BarraMestria } from "@/components/instituicao/lga";
import { ListaDesafios } from "@/components/instituicao/desafios";
import { Carregando, ErroCarregar, Etiqueta, Seletor, useCarregar } from "@/components/instituicao/ui";
import { LgaSign } from "@/components/lga-sign";
import { gerarExercicio, ROTULO_NIVEL_MESTRIA, type Exercicio } from "@/lib/instituicoes/exercicios";
import { apiLga, PONTOS_ACERTO } from "@/lib/instituicoes/lga";
import { ROTULO_COMPETENCIA, ROTULO_TEMA } from "@/lib/instituicoes/permissoes";
import type { Competencia, Gesto, TemaGesto } from "@/lib/instituicoes/tipos";
import { cn } from "@/lib/utils";

const COMPETENCIAS: { id: Competencia; descricao: string }[] = [
  { id: "alfabeto", descricao: "Letras e palavras soletradas com o alfabeto manual." },
  { id: "numeros", descricao: "Contar e reconhecer números em LGA." },
  { id: "vocabulario", descricao: "Gestos por tema: escola, família, emoções, quotidiano." },
  { id: "frases", descricao: "Frases do dia a dia na sala de aula e em casa." },
];
const TEMAS_VOCABULARIO: TemaGesto[] = ["saudacoes", "escola", "familia", "emocoes", "quotidiano"];

export default function PraticarPage() {
  const { instituicaoId, pode } = useInstituicaoAtual();
  const [competencia, setCompetencia] = useState<Competencia | null>(null);
  const { dados, erro, aCarregar, recarregar } = useCarregar(async () => {
    const [progresso, desafios, gestos] = await Promise.all([
      apiLga.meuProgresso(instituicaoId),
      apiLga.listarDesafios(instituicaoId),
      apiLga.listarGestos(instituicaoId),
    ]);
    return { progresso, desafios, gestos };
  }, [instituicaoId]);

  return (
    <Exige permitido={pode("praticar")}>
      {aCarregar && !dados ? (
        <Carregando />
      ) : !dados ? (
        <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />
      ) : competencia ? (
        <Sessao
          competencia={competencia}
          gestos={dados.gestos}
          aoSair={() => {
            setCompetencia(null);
            void recarregar();
          }}
        />
      ) : (
        <div className="space-y-8">
          <div>
            <h2 className="font-serif text-2xl font-semibold">Praticar LGA</h2>
            <p className="text-sm text-muted-foreground">
              Exercícios curtos com os gestos validados do gestuário. A mestria conta as tuas últimas 10 respostas em cada competência.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {COMPETENCIAS.map((c) => {
              const p = dados.progresso.competencias[c.id];
              return (
                <Card key={c.id} className="flex flex-col gap-3 p-5 shadow-soft">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-serif text-lg font-semibold">{ROTULO_COMPETENCIA[c.id]}</p>
                      <p className="text-xs text-muted-foreground">{c.descricao}</p>
                    </div>
                    <Etiqueta tom={p.nivel === "dominado" ? "sucesso" : p.nivel === "a_progredir" ? "marca" : "neutro"}>{ROTULO_NIVEL_MESTRIA[p.nivel]}</Etiqueta>
                  </div>
                  <BarraMestria valor={p.mestria} rotulo={`Mestria em ${ROTULO_COMPETENCIA[c.id]}`} />
                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{p.tentativas} respostas</span>
                    <Button size="sm" className="gap-1.5" onClick={() => setCompetencia(c.id)}>
                      <Dumbbell className="h-4 w-4" /> Praticar
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={Coins} label="Moedas da escola" value={dados.progresso.pontos} hint={`+${PONTOS_ACERTO} por cada acerto`} tone="gold" />
            <StatCard
              icon={Target}
              label="Desafios ativos"
              value={dados.desafios.filter((d) => !d.concluido).length}
              hint={`${dados.desafios.filter((d) => d.concluido).length} concluídos`}
            />
            <StatCard
              icon={Check}
              label="Competências dominadas"
              value={Object.values(dados.progresso.competencias).filter((p) => p.nivel === "dominado").length}
              hint="de 4"
              tone="success"
            />
          </div>

          {dados.desafios.length > 0 && <ListaDesafios desafios={dados.desafios} />}
        </div>
      )}
    </Exige>
  );
}

function Estimulo({ ex }: { ex: Exercicio }) {
  const [play, setPlay] = useState(true);
  useEffect(() => {
    setPlay(true);
    const t = setTimeout(() => setPlay(false), 1300);
    return () => clearTimeout(t);
  }, [ex.id]);

  if (ex.palavra) {
    return <p className="py-8 text-center font-serif text-4xl font-semibold sm:text-5xl">{ex.palavra}</p>;
  }
  return (
    <button
      type="button"
      onClick={() => {
        setPlay(true);
        setTimeout(() => setPlay(false), 1300);
      }}
      className="flex w-full flex-wrap items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-surface to-primary/10 px-4 py-10"
      aria-label="Ver o gesto outra vez"
    >
      {ex.gestos.map((g, i) => (
        <LgaSign key={`${g.id}-${i}`} glyph={g.glyph} motion={g.motion} play={play} className={ex.gestos.length > 1 ? "text-5xl sm:text-6xl" : "text-8xl"} label={`gesto ${i + 1}`} />
      ))}
    </button>
  );
}

function Sessao({ competencia, gestos, aoSair }: { competencia: Competencia; gestos: Gesto[]; aoSair: () => void }) {
  const { instituicaoId } = useInstituicaoAtual();
  const [tema, setTema] = useState<TemaGesto | "">("");
  const [ex, setEx] = useState<Exercicio | null>(null);
  const [escolha, setEscolha] = useState<string | null>(null);
  const [contagem, setContagem] = useState({ certos: 0, total: 0 });

  const proximo = useCallback(() => {
    setEscolha(null);
    setEx(gerarExercicio(gestos, competencia, { tema: tema || null }));
  }, [gestos, competencia, tema]);

  useEffect(() => {
    proximo();
  }, [proximo]);

  const responder = async (id: string) => {
    if (!ex || escolha) return;
    setEscolha(id);
    const certo = id === ex.respostaId;
    setContagem((c) => ({ certos: c.certos + (certo ? 1 : 0), total: c.total + 1 }));
    try {
      const r = await apiLga.registarPratica(instituicaoId, { competencia, tema: ex.tema, certo });
      for (const d of r.desafiosConcluidos) toast.success(`Desafio concluído: ${d.titulo}`, { description: `+${d.recompensa} moedas da escola` });
    } catch {
      /* a prática conta localmente na mesma */
    }
  };

  const certo = ex && escolha === ex.respostaId;
  const resposta = ex?.opcoes.find((o) => o.id === ex.respostaId);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={aoSair}>
          <ArrowLeft className="h-4 w-4" /> Terminar
        </Button>
        <p className="text-sm tabular-nums text-muted-foreground">
          {contagem.certos} certas de {contagem.total}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-2xl font-semibold">{ROTULO_COMPETENCIA[competencia]}</h2>
        {competencia === "vocabulario" && (
          <Seletor aria-label="Tema" className="w-44" value={tema} onChange={(e) => setTema(e.target.value as TemaGesto | "")}>
            <option value="">Todos os temas</option>
            {TEMAS_VOCABULARIO.map((t) => (
              <option key={t} value={t}>
                {ROTULO_TEMA[t]}
              </option>
            ))}
          </Seletor>
        )}
      </div>

      {!ex ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Ainda não há gestos validados suficientes neste tema.</Card>
      ) : (
        <Card className="space-y-5 p-5 shadow-soft">
          <p className="text-center font-medium">{ex.enunciado}</p>
          <Estimulo ex={ex} />
          <div className={cn("grid gap-2", ex.tipo === "escolher_gesto" ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")} role="group" aria-label="Opções">
            {ex.opcoes.map((o) => {
              const eCerta = o.id === ex.respostaId;
              const escolhida = o.id === escolha;
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={!!escolha}
                  onClick={() => void responder(o.id)}
                  className={cn(
                    "flex min-h-14 items-center justify-center gap-2 rounded-xl border p-3 text-base font-medium transition-colors",
                    !escolha && "hover:border-primary hover:bg-primary/5",
                    escolha && eCerta && "border-success bg-success/15 text-success",
                    escolhida && !eCerta && "border-destructive bg-destructive/10 text-destructive",
                  )}
                >
                  {o.gesto ? (
                    <LgaSign glyph={o.gesto.glyph} motion={o.gesto.motion} hoverPlay className="text-5xl" label={`opção`} />
                  ) : (
                    o.rotulo
                  )}
                  {escolha && eCerta && <Check className="h-5 w-5" aria-hidden />}
                  {escolhida && !eCerta && <X className="h-5 w-5" aria-hidden />}
                </button>
              );
            })}
          </div>
          {escolha && (
            <div className="flex flex-col items-center gap-3 text-center" aria-live="polite">
              <p className={cn("font-medium", certo ? "text-success" : "text-destructive")}>
                {certo ? `Certo! +${PONTOS_ACERTO} moedas` : `A resposta certa era «${resposta?.rotulo}».`}
              </p>
              {ex.gestos[0]?.descricao && ex.tipo !== "soletrar" && <p className="text-xs text-muted-foreground">{ex.gestos[0].descricao}</p>}
              <Button className="gap-1.5" onClick={proximo} autoFocus>
                Próximo <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
