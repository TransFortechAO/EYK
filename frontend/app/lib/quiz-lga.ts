/**
 * Cliente da API do Quiz LGA (https://api-quiz-lga.onrender.com, FastAPI).
 *
 * A API é pública e aceita pedidos de qualquer origem (CORS "*"), por isso o
 * browser fala com ela diretamente. Para usar outra (ex: uma cópia local na
 * porta 8001), define NEXT_PUBLIC_QUIZ_API_URL.
 */

export const QUIZ_API_URL = (process.env.NEXT_PUBLIC_QUIZ_API_URL || "https://api-quiz-lga.onrender.com")
  .trim()
  .replace(/\/+$/, "");

export type QuizCategory = { name: string; question_count: number; source_note?: string | null };

export type QuizQuestion = {
  id: string;
  category: string;
  question: string;
  question_type: string;
  image_url: string;
  options: string[];
  validation_status?: string | null;
};

export type QuizAnswerResult = {
  question_id: string;
  is_correct: boolean;
  correct_answer: string;
  explanation?: string | null;
};

/** O alojamento gratuito adormece o serviço; o primeiro pedido pode levar até um minuto. */
const TEMPO_LIMITE_MS = 90_000;

export class QuizErro extends Error {}

function mensagemDoErro(payload: unknown, estado: number): string {
  const detail = (payload as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  // Erros de validação do FastAPI vêm como lista.
  if (Array.isArray(detail) && typeof detail[0]?.msg === "string") return detail[0].msg;
  return `O serviço do quiz respondeu com o estado ${estado}.`;
}

async function pedido<T>(caminho: string, init?: RequestInit): Promise<T> {
  const controlo = new AbortController();
  const limite = setTimeout(() => controlo.abort(), TEMPO_LIMITE_MS);
  try {
    const resposta = await fetch(`${QUIZ_API_URL}/api/v1/quiz${caminho}`, {
      ...init,
      cache: "no-store",
      signal: controlo.signal,
      headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    });
    if (!resposta.ok) {
      throw new QuizErro(mensagemDoErro(await resposta.json().catch(() => null), resposta.status));
    }
    return (await resposta.json()) as T;
  } catch (causa) {
    if (causa instanceof QuizErro) throw causa;
    if (causa instanceof DOMException && causa.name === "AbortError") {
      throw new QuizErro("O serviço do quiz demorou demasiado a responder. Tenta de novo daqui a pouco.");
    }
    throw new QuizErro("Sem ligação ao serviço do quiz. Verifica a internet e tenta de novo.");
  } finally {
    clearTimeout(limite);
  }
}

export const quizLga = {
  categorias: () => pedido<QuizCategory[]>("/categories"),
  perguntas: (categoria?: string) =>
    pedido<QuizQuestion[]>(`/questions${categoria ? `?category=${encodeURIComponent(categoria)}` : ""}`),
  responder: (questionId: string, resposta: string) =>
    pedido<QuizAnswerResult>("/answer", {
      method: "POST",
      body: JSON.stringify({ question_id: questionId, answer: resposta }),
    }),
};

/** As imagens vêm com caminho relativo ("/static/…"): ficam com o endereço da API. */
export function imagemDoQuiz(caminho: string): string {
  if (/^https?:\/\//i.test(caminho)) return caminho;
  return `${QUIZ_API_URL}/${caminho.replace(/^\/+/, "")}`;
}

/** Perguntas ainda não revistas por um especialista em LGA. */
export function porValidar(q: Pick<QuizQuestion, "validation_status">): boolean {
  return Boolean(q.validation_status && q.validation_status.startsWith("pendente"));
}
