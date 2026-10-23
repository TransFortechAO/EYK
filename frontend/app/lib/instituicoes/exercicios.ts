// Exercícios de prática de LGA e cálculo de mestria por competência.
// Funções puras: recebem os gestos validados e um gerador de números
// aleatórios (injetável nos testes).
import { competenciaDoTema } from "./permissoes";
import type { Competencia, Gesto, ProgressoCompetencia, TemaGesto } from "./tipos";

/** Quantas respostas recentes contam para a mestria. */
export const JANELA_MESTRIA = 10;

export type TipoExercicio = "reconhecer" | "escolher_gesto" | "soletrar";

export type Exercicio = {
  id: string;
  competencia: Competencia;
  tema: TemaGesto;
  tipo: TipoExercicio;
  enunciado: string;
  /** O que se mostra: gestos (reconhecer, soletrar) ou uma palavra (escolher o gesto). */
  gestos: Gesto[];
  palavra: string | null;
  opcoes: { id: string; rotulo: string; gesto: Gesto | null }[];
  respostaId: string;
};

type Aleatorio = () => number;

function baralhar<T>(lista: T[], rand: Aleatorio): T[] {
  const r = [...lista];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function escolher<T>(lista: T[], rand: Aleatorio): T {
  return lista[Math.floor(rand() * lista.length)];
}

/** Sem acentos, só letras A–Z (para soletrar com o alfabeto manual). */
export function paraSoletrar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

const PALAVRAS_SOLETRAR = ["ANGOLA", "LUANDA", "ESCOLA", "CASA", "LIVRO", "KIESSE", "NZINGA", "AMIGO", "AGUA", "MAE", "PAI", "SOL", "LGA"];

/** Representação visível de uma sequência de gestos (para garantir opções distintas). */
function assinatura(gestos: Gesto[]): string {
  return gestos.map((g) => g.glyph).join("");
}

/**
 * Distratores com representação diferente da resposta (na demonstração, letras
 * como A, M, N e S partilham o mesmo emoji — com vídeos reais isto deixa de ser preciso).
 */
function distratores(alvo: Gesto, candidatos: Gesto[], n: number, rand: Aleatorio): Gesto[] {
  const vistos = new Set([alvo.glyph]);
  const r: Gesto[] = [];
  for (const g of baralhar(candidatos, rand)) {
    if (g.id === alvo.id || vistos.has(g.glyph)) continue;
    vistos.add(g.glyph);
    r.push(g);
    if (r.length === n) break;
  }
  return r;
}

export function gestosDaCompetencia(gestos: Gesto[], competencia: Competencia, tema?: TemaGesto | null): Gesto[] {
  return gestos.filter(
    (g) => g.estado === "validado" && competenciaDoTema(g.tema) === competencia && (!tema || g.tema === tema),
  );
}

/**
 * Gera um exercício para a competência. Devolve null se não houver gestos
 * validados suficientes (são precisas pelo menos 4 opções distintas).
 */
export function gerarExercicio(
  gestos: Gesto[],
  competencia: Competencia,
  opcoes: { tema?: TemaGesto | null; rand?: Aleatorio } = {},
): Exercicio | null {
  const rand = opcoes.rand ?? Math.random;
  const id = `ex-${Math.floor(rand() * 1e9)}`;

  if (competencia === "alfabeto") {
    const letras = new Map(gestosDaCompetencia(gestos, "alfabeto").map((g) => [g.palavra, g]));
    const soletraveis = PALAVRAS_SOLETRAR.filter((p) => [...p].every((l) => letras.has(l)));
    // Metade das vezes soletrar uma palavra; na outra metade reconhecer uma letra.
    if (soletraveis.length >= 4 && rand() < 0.5) {
      const palavra = escolher(soletraveis, rand);
      const seq = [...palavra].map((l) => letras.get(l)!);
      const alvo = assinatura(seq);
      const outras: string[] = [];
      const vistas = new Set([alvo]);
      for (const p of baralhar(soletraveis, rand)) {
        const a = assinatura([...p].map((l) => letras.get(l)!));
        if (p === palavra || vistas.has(a)) continue;
        vistas.add(a);
        outras.push(p);
        if (outras.length === 3) break;
      }
      if (outras.length === 3) {
        return {
          id,
          competencia,
          tema: "alfabeto",
          tipo: "soletrar",
          enunciado: "Que palavra está a ser soletrada?",
          gestos: seq,
          palavra: null,
          opcoes: baralhar([palavra, ...outras], rand).map((p) => ({ id: p, rotulo: p, gesto: null })),
          respostaId: palavra,
        };
      }
    }
  }

  const pool = gestosDaCompetencia(gestos, competencia, opcoes.tema);
  if (pool.length < 4) return null;
  const alvo = escolher(pool, rand);
  const outros = distratores(alvo, pool, 3, rand);
  if (outros.length < 3) return null;
  const todos = baralhar([alvo, ...outros], rand);

  // Vocabulário e frases alternam: ver o gesto e escolher a palavra, ou ver a palavra e escolher o gesto.
  if ((competencia === "vocabulario" || competencia === "frases") && rand() < 0.5) {
    return {
      id,
      competencia,
      tema: alvo.tema,
      tipo: "escolher_gesto",
      enunciado: "Qual é o gesto desta palavra?",
      gestos: [],
      palavra: alvo.palavra,
      opcoes: todos.map((g) => ({ id: g.id, rotulo: g.palavra, gesto: g })),
      respostaId: alvo.id,
    };
  }

  return {
    id,
    competencia,
    tema: alvo.tema,
    tipo: "reconhecer",
    enunciado: competencia === "alfabeto" ? "Que letra é esta?" : competencia === "numeros" ? "Que número é este?" : "O que significa este gesto?",
    gestos: [alvo],
    palavra: null,
    opcoes: todos.map((g) => ({ id: g.id, rotulo: g.palavra, gesto: null })),
    respostaId: alvo.id,
  };
}

/** Atualiza o progresso de uma competência com uma resposta. */
export function registarNoProgresso(p: ProgressoCompetencia | undefined, certo: boolean): ProgressoCompetencia {
  const base = p ?? { tentativas: 0, acertos: 0, recentes: [] };
  return {
    tentativas: base.tentativas + 1,
    acertos: base.acertos + (certo ? 1 : 0),
    recentes: [...base.recentes, certo].slice(-JANELA_MESTRIA),
  };
}

/** Mestria (0–100): percentagem de acertos nas respostas recentes. */
export function mestria(p: ProgressoCompetencia | undefined): number {
  if (!p || p.recentes.length === 0) return 0;
  return Math.round((p.recentes.filter(Boolean).length / p.recentes.length) * 100);
}

export type NivelMestria = "por_comecar" | "a_comecar" | "a_progredir" | "dominado";

/** Só conta como dominado com respostas suficientes (não basta acertar uma vez). */
export function nivelMestria(p: ProgressoCompetencia | undefined): NivelMestria {
  if (!p || p.tentativas === 0) return "por_comecar";
  const m = mestria(p);
  if (m >= 80 && p.recentes.length >= JANELA_MESTRIA) return "dominado";
  if (m >= 50) return "a_progredir";
  return "a_comecar";
}

export const ROTULO_NIVEL_MESTRIA: Record<NivelMestria, string> = {
  por_comecar: "Por começar",
  a_comecar: "A começar",
  a_progredir: "A progredir",
  dominado: "Dominado",
};
