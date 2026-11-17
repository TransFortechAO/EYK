"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Hand, LoaderCircle, RotateCcw, Sparkles, XCircle } from "lucide-react";
import { PageHeader } from "@/components/eyk";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type QuizCategory = { name: string; question_count: number; source_note?: string | null };
type QuizQuestion = {
  id: string;
  category: string;
  question: string;
  question_type: string;
  image_url: string;
  options: string[];
  validation_status?: string | null;
};
type AnswerResult = {
  question_id: string;
  is_correct: boolean;
  correct_answer: string;
};

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

async function quizRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/quiz-api${path}`, {
    ...options,
    cache: "no-store",
    headers: { ...(options?.body ? { "Content-Type": "application/json" } : {}), ...options?.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(payload?.detail || `A API respondeu com o estado ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

function imagemUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return path.replace(/^\/static\//, "/quiz-static/").replace(/^static\//, "/quiz-static/");
}

export default function QuizLgaPage() {
  const [categories, setCategories] = useState<QuizCategory[]>([]);
  const [category, setCategory] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSequence = useRef("");

  const loadQuiz = useCallback(async (selectedCategory = "") => {
    setLoading(true);
    setError(null);
    try {
      const [availableCategories, availableQuestions] = await Promise.all([
        quizRequest<QuizCategory[]>("/categories"),
        quizRequest<QuizQuestion[]>(`/questions${selectedCategory ? `?category=${encodeURIComponent(selectedCategory)}` : ""}`),
      ]);
      setCategories(availableCategories);
      setCategory(selectedCategory || availableCategories[0]?.name || "");
      // Uma pergunta por gesto/ID nesta sessão; baralha perguntas e alternativas
      // sem mover a resposta correta para o payload de perguntas.
      const uniqueQuestions = Array.from(new Map(availableQuestions.map((item) => [item.id, item])).values());
      let sequence = shuffle(uniqueQuestions);
      const sequenceKey = (items: QuizQuestion[]) => items.map((item) => item.id).join("|");
      if (sequence.length > 1 && sequenceKey(sequence) === lastSequence.current) {
        sequence = [...sequence.slice(1), sequence[0]];
      }
      lastSequence.current = sequenceKey(sequence);
      setQuestions(sequence.map((item) => ({ ...item, options: shuffle(item.options) })));
      setIndex(0);
      setChoice(null);
      setResult(null);
      setScore(0);
      setCorrectCount(0);
      setIncorrectCount(0);
      setCompleted(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o quiz.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadQuiz(); }, [loadQuiz]);

  const question = questions[index];

  async function submitAnswer() {
    if (!question || !choice || sending || result) return;
    setSending(true);
    setError(null);
    try {
      const answer = await quizRequest<AnswerResult>("/answer", {
        method: "POST",
        body: JSON.stringify({ question_id: question.id, answer: choice }),
      });
      setResult(answer);
      if (answer.is_correct) {
        setScore((value) => value + 10);
        setCorrectCount((value) => value + 1);
      } else {
        setIncorrectCount((value) => value + 1);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível validar a resposta.");
    } finally {
      setSending(false);
    }
  }

  function nextQuestion() {
    if (index + 1 >= questions.length) {
      setCompleted(true);
      return;
    }
    setIndex((value) => value + 1);
    setChoice(null);
    setResult(null);
    setError(null);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Quiz de LGA" description="Observa o gesto, escolhe a letra e confirma a tua resposta." />

      {categories.length > 0 && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-sm font-medium">
              Categoria
              <select
                className="min-h-10 rounded-lg border border-border bg-background px-3"
                value={category}
                onChange={(event) => void loadQuiz(event.target.value)}
                disabled={loading}
              >
                {categories.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
              </select>
            </label>
            {categories.find((item) => item.name === category)?.source_note && (
              <p className="text-xs text-muted-foreground" role="note">
                Referência: {categories.find((item) => item.name === category)?.source_note}
              </p>
            )}
          </div>
          {question && <Badge variant="secondary">Pergunta {index + 1} de {questions.length} · {score} pontos</Badge>}
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="flex-1"><p className="font-medium">Não foi possível comunicar com o Quiz LGA.</p><p className="mt-1 text-muted-foreground">{error}</p></div>
          <Button variant="outline" size="sm" onClick={() => void loadQuiz(category)}>Tentar de novo</Button>
        </div>
      )}

      {loading ? (
        <Card className="grid min-h-64 place-items-center p-8 text-muted-foreground"><span className="flex items-center gap-2"><LoaderCircle className="h-5 w-5 animate-spin" />A carregar perguntas…</span></Card>
      ) : question && !completed ? (
        <Card className="overflow-hidden shadow-soft">
          <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
            <div className="flex min-h-72 items-center justify-center bg-muted/50 p-6 sm:p-10">
              <Image
                src={imagemUrl(question.image_url)}
                alt="Gesto da pergunta de Língua Gestual Angolana"
                width={512}
                height={512}
                unoptimized
                className="max-h-80 w-auto max-w-full rounded-xl object-contain"
                priority
              />
            </div>
            <div className="flex flex-col p-6 sm:p-8">
              <div className="mb-5 flex items-center gap-2 text-sm text-muted-foreground"><Hand className="h-4 w-4" />{question.category}</div>
              <h2 className="font-serif text-2xl font-semibold">{question.question}</h2>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {question.options.map((option) => {
                  const isCorrect = result?.correct_answer === option;
                  const isWrongChoice = result && choice === option && !result.is_correct;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => !result && setChoice(option)}
                      disabled={!!result || sending}
                      aria-pressed={choice === option}
                      className={`min-h-14 rounded-xl border px-4 text-lg font-semibold transition-colors ${
                        isCorrect ? "border-emerald-600 bg-emerald-500/10 text-emerald-700" :
                        isWrongChoice ? "border-destructive bg-destructive/10 text-destructive" :
                        choice === option ? "border-primary bg-primary/10 text-primary" :
                        "border-border bg-background hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >{option}</button>
                  );
                })}
              </div>

              {result && (
                <div className={`mt-5 rounded-xl border p-4 ${result.is_correct ? "border-emerald-600/30 bg-emerald-500/5" : "border-amber-600/30 bg-amber-500/5"}`} aria-live="polite">
                  <p className="flex items-center gap-2 font-semibold">
                    {result.is_correct ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-amber-600" />}
                    {result.is_correct ? "Resposta certa!" : `A resposta correta é ${result.correct_answer}.`}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {result.is_correct ? "+10 pontos." : "0 pontos nesta pergunta."}
                  </p>
                </div>
              )}

              <div className="mt-auto flex justify-end pt-6">
                {result ? (
                  <Button onClick={nextQuestion} className="gap-2">{index + 1 === questions.length ? "Ver resultado" : "Próxima pergunta"}<ArrowRight className="h-4 w-4" /></Button>
                ) : (
                  <Button onClick={() => void submitAnswer()} disabled={!choice || sending} className="gap-2">
                    {sending && <LoaderCircle className="h-4 w-4 animate-spin" />}{sending ? "A validar…" : "Confirmar resposta"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      ) : completed ? (
        <Card className="flex flex-col items-center p-8 text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary"><Sparkles className="h-6 w-6" /></div>
          <h2 className="font-serif text-2xl font-semibold">Quiz concluído!</h2>
          <p className="mt-2 text-4xl font-bold tabular-nums text-primary">{score} pontos</p>
          <div className="mt-5 grid w-full max-w-lg grid-cols-2 gap-3 text-left sm:grid-cols-4">
            <div className="rounded-xl bg-muted/60 p-3"><p className="text-xs text-muted-foreground">Perguntas</p><p className="text-xl font-semibold">{questions.length}</p></div>
            <div className="rounded-xl bg-emerald-500/10 p-3"><p className="text-xs text-muted-foreground">Certas</p><p className="text-xl font-semibold">{correctCount}</p></div>
            <div className="rounded-xl bg-destructive/5 p-3"><p className="text-xs text-muted-foreground">Erradas</p><p className="text-xl font-semibold">{incorrectCount}</p></div>
            <div className="rounded-xl bg-primary/10 p-3"><p className="text-xs text-muted-foreground">Aproveitamento</p><p className="text-xl font-semibold">{questions.length ? Math.round((correctCount / questions.length) * 100) : 0}%</p></div>
          </div>
          <Button variant="outline" onClick={() => void loadQuiz(category)} className="mt-5 gap-2"><RotateCcw className="h-4 w-4" />Repetir o Quiz</Button>
        </Card>
      ) : !loading && !error && questions.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Não há perguntas disponíveis nesta categoria.</Card>
      ) : null}
    </div>
  );
}
