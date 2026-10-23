"use client";

// A escola nas páginas principais da EYK (Início, Cursos, Vídeos, Comunidade,
// Leaderboard, Gamificação, Biblioteca), com o contexto global da escola
// (components/providers.tsx). Sem escola (ou com a área desligada) mostra só
// o conteúdo público, exatamente como antes. O aluno de uma escola vê só a
// escola, a não ser que escolha ver também a plataforma geral.
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Building2,
  CalendarDays,
  Camera,
  Captions,
  Hand,
  Lock,
  Megaphone,
  MessageSquareText,
  PlayCircle,
  RotateCcw,
  Video,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionHeader } from "@/components/eyk";
import { useInstituicao, useInstituicaoOpcional } from "@/components/instituicao/contexto";
import { ListaDesafios } from "@/components/instituicao/desafios";
import { CartaoGesto } from "@/components/instituicao/lga";
import { ListaClassificacao } from "@/components/instituicao/turma/classificacao";
import { SeparadorComunidade } from "@/components/instituicao/turma/comunidade";
import { dataHora, Etiqueta, haQuanto } from "@/components/instituicao/ui";
import { INSTITUICOES_ATIVAS } from "@/lib/instituicoes/ativo";
import { apiLga, type TurmaLga } from "@/lib/instituicoes/lga";
import { ROTULO_TEMA } from "@/lib/instituicoes/permissoes";
import type { ConteudoEscola, Gesto } from "@/lib/instituicoes/tipos";
import { cn } from "@/lib/utils";

/** Mostra `children` quando há contexto da escola (área ativa); senão, o conteúdo de sempre. */
function ComEscola({ children, semEscola = null }: { children: ReactNode; semEscola?: ReactNode }) {
  const ctx = useInstituicaoOpcional();
  if (!INSTITUICOES_ATIVAS || !ctx) return <>{semEscola}</>;
  return <>{children}</>;
}

/** Aluno que escolheu ver só a escola (a opção por omissão para alunos de uma escola parceira). */
function soEscola(ctx: ReturnType<typeof useInstituicao>): boolean {
  return !!ctx.atual && ctx.atual.membro.papel === "aluno" && !ctx.verGeral;
}

/** Barra que explica o que o aluno está a ver e deixa mudar. */
export function AvisoPlataformaGeral() {
  const ctx = useInstituicaoOpcional();
  const [aMudar, setAMudar] = useState(false);
  if (!ctx?.atual || ctx.atual.membro.papel !== "aluno") return null;
  const mudar = async () => {
    setAMudar(true);
    try {
      await ctx.definirVerGeral(!ctx.verGeral);
    } finally {
      setAMudar(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface/60 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2 text-muted-foreground">
        <Building2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        {ctx.verGeral
          ? `Estás a ver a ${ctx.atual.instituicao.nome} e a plataforma geral da EYK.`
          : `Estás a ver só a ${ctx.atual.instituicao.nome}.`}
      </p>
      <Button variant="outline" size="sm" disabled={aMudar} onClick={() => void mudar()}>
        {ctx.verGeral ? "Ver só a minha escola" : "Ver também a plataforma geral"}
      </Button>
    </div>
  );
}

/** Esconde conteúdo da plataforma geral ao aluno que escolheu ver só a escola. */
export function SoPlataformaGeral({ children }: { children: ReactNode }) {
  const ctx = useInstituicaoOpcional();
  if (ctx && soEscola(ctx)) return null;
  return <>{children}</>;
}

// ── Cartão de conteúdo da escola ──

export function CartaoConteudoEscola({ conteudo: c, turma }: { conteudo: ConteudoEscola; turma?: string | null }) {
  return (
    <Link href={`/instituicao/conteudos/${c.id}`} className="group block h-full">
      <Card className="flex h-full flex-col overflow-hidden shadow-soft transition-shadow group-hover:shadow-elevated">
        <div className="relative grid aspect-video place-items-center bg-gradient-to-br from-primary/15 via-surface to-primary/5">
          {c.tipo === "curso" ? <BookOpen className="h-10 w-10 text-primary" aria-hidden /> : <PlayCircle className="h-10 w-10 text-primary" aria-hidden />}
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium backdrop-blur">
            <Building2 className="h-3 w-3" aria-hidden /> {c.ambito.tipo === "turma" ? turma ?? "Da turma" : "Da escola"}
          </span>
          {c.emLga && (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
              <Hand className="h-3 w-3" aria-hidden /> Em LGA
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-4">
          <p className="font-medium leading-snug group-hover:underline underline-offset-2">{c.titulo}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{c.descricao}</p>
          <p className="mt-auto flex flex-wrap items-center gap-x-2 pt-2 text-xs text-muted-foreground">
            <span>{c.autor}</span>
            <span aria-hidden>·</span>
            <span>{c.tipo === "curso" ? `${c.aulas} lições · ${c.duracaoMin} min` : `${c.duracaoMin} min`}</span>
            {c.temLegendas && (
              <span className="inline-flex items-center gap-0.5">
                <Captions className="h-3 w-3" aria-hidden /> PT
              </span>
            )}
          </p>
        </div>
      </Card>
    </Link>
  );
}

// ── Cursos e Vídeos: "Da minha escola" + público ──

type Origem = "todos" | "escola" | "publico";

function ConteudosComEscolaInterno({ tipo, children }: { tipo: ConteudoEscola["tipo"]; children: ReactNode }) {
  const ctx = useInstituicao();
  const { atual, aCarregar } = ctx;
  const [escolhida, setOrigem] = useState<Origem>("todos");
  const [conteudos, setConteudos] = useState<ConteudoEscola[] | null>(null);
  const [turmas, setTurmas] = useState<TurmaLga[]>([]);
  const instituicaoId = atual?.instituicao.id;

  useEffect(() => {
    if (!instituicaoId) return;
    let vivo = true;
    void Promise.all([apiLga.listarConteudos(instituicaoId, tipo), apiLga.listarTurmas(instituicaoId).catch(() => [])]).then(([c, t]) => {
      if (!vivo) return;
      setConteudos(c);
      setTurmas(t);
    });
    return () => {
      vivo = false;
    };
  }, [instituicaoId, tipo]);

  // Enquanto carrega, não mostra o catálogo geral (o aluno pode ter escolhido ver só a escola).
  if (aCarregar && !atual) return null;
  if (!atual) return <>{children}</>;
  const so = soEscola(ctx);
  const origem: Origem = so ? "escola" : escolhida;
  const nomeTurma = (c: ConteudoEscola) => (c.ambito.tipo === "turma" ? turmas.find((t) => t.id === (c.ambito as { turmaId: string }).turmaId)?.nome ?? null : null);

  return (
    <div className="space-y-8">
      <AvisoPlataformaGeral />
      {!so && (
        <Tabs value={origem} onValueChange={(v) => setOrigem(v as Origem)}>
          <TabsList className="h-auto flex-wrap bg-surface py-1">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="escola" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" aria-hidden /> Da minha escola
            </TabsTrigger>
            <TabsTrigger value="publico">Públicos</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {origem !== "publico" && (
        <section>
          <SectionHeader title={atual.instituicao.nome} href="/instituicao/conteudos" cta="Ver todos da escola" />
          <p className="-mt-2 mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" aria-hidden /> Só os membros da escola (ou da turma) vêem estes {tipo === "curso" ? "cursos" : "vídeos"}.
          </p>
          {conteudos === null ? (
            <p className="text-sm text-muted-foreground">A carregar…</p>
          ) : conteudos.length === 0 ? (
            <p className="rounded-xl bg-surface/60 p-4 text-sm text-muted-foreground">A escola ainda não publicou {tipo === "curso" ? "cursos" : "vídeos"}.</p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {conteudos.map((c) => (
                <CartaoConteudoEscola key={c.id} conteudo={c} turma={nomeTurma(c)} />
              ))}
            </div>
          )}
        </section>
      )}

      {origem !== "escola" && (
        <div className="space-y-4">
          {origem === "todos" && <h2 className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">Catálogo EYK</h2>}
          {children}
        </div>
      )}
    </div>
  );
}

export function ConteudosComEscola({ tipo, children }: { tipo: ConteudoEscola["tipo"]; children: ReactNode }) {
  return (
    <ComEscola semEscola={children}>
      <ConteudosComEscolaInterno tipo={tipo}>{children}</ConteudosComEscolaInterno>
    </ComEscola>
  );
}

// ── Início: "Da tua escola" ──

function InicioEscolaInterno() {
  const { atual } = useInstituicao();
  const [resumo, setResumo] = useState<Awaited<ReturnType<typeof apiLga.resumoEscola>> | null>(null);
  const instituicaoId = atual?.instituicao.id;

  useEffect(() => {
    if (!instituicaoId) return;
    let vivo = true;
    void apiLga
      .resumoEscola(instituicaoId)
      .then((r) => vivo && setResumo(r))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [instituicaoId]);

  if (!atual || !resumo) return null;
  const vazio =
    !resumo.tarefas.length && !resumo.aulasNovas.length && !resumo.porRever && !resumo.feedbackNovo.length && !resumo.desafios.length && !resumo.avisosPorLer && !resumo.proximoEvento;
  if (vazio) return null;

  return (
    <section className="space-y-4">
      <SectionHeader title={`Da tua escola · ${atual.instituicao.nome}`} href="/instituicao" cta="Abrir a escola" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-3 p-5 shadow-soft lg:col-span-2">
          {resumo.tarefas.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Camera className="h-4 w-4 text-primary" aria-hidden /> Trabalhos de LGA por fazer
              </p>
              <ul className="space-y-1.5">
                {resumo.tarefas.slice(0, 4).map(({ aula, turma, estado }) => (
                  <li key={aula.id}>
                    <Link
                      href={`/instituicao/turmas/${aula.turmaId}/aulas/${aula.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg bg-surface/60 px-3 py-2 text-sm transition-colors hover:bg-surface"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{aula.titulo}</span>
                        <span className="text-xs text-muted-foreground">
                          {turma}
                          {aula.prazo ? ` · até ${dataHora(aula.prazo)}` : ""}
                        </span>
                      </span>
                      {estado === "repetir" ? (
                        <Etiqueta tom="aviso">
                          <RotateCcw className="h-3 w-3" aria-hidden /> Repetir
                        </Etiqueta>
                      ) : (
                        <Etiqueta tom="marca">Gravar</Etiqueta>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {resumo.porRever > 0 && (
            <Link href="/instituicao/turmas" className="flex items-center justify-between gap-3 rounded-lg bg-primary/10 px-3 py-2.5 text-sm">
              <span className="flex items-center gap-2">
                <Video className="h-4 w-4 text-primary" aria-hidden /> {resumo.porRever} respostas em vídeo à espera da tua correção
              </span>
              <ArrowRight className="h-4 w-4 text-primary" aria-hidden />
            </Link>
          )}
          {resumo.feedbackNovo.length > 0 && (
            <div className="space-y-1.5">
              <p className="flex items-center gap-2 text-sm font-medium">
                <MessageSquareText className="h-4 w-4 text-primary" aria-hidden /> O professor respondeu
              </p>
              {resumo.feedbackNovo.slice(0, 2).map((r) => (
                <Link key={r.id} href={`/instituicao/turmas/${r.turmaId}/aulas/${r.aulaId}`} className="block rounded-lg bg-surface/60 px-3 py-2 text-sm hover:bg-surface">
                  <span className="font-medium">{r.estado === "correto" ? "Correto!" : "Para repetir"}</span>
                  {r.feedback?.texto && <span className="text-muted-foreground"> — {r.feedback.texto}</span>}
                </Link>
              ))}
            </div>
          )}
          {resumo.aulasNovas.length > 0 && (
            <div className="space-y-1.5">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Hand className="h-4 w-4 text-primary" aria-hidden /> Aulas novas esta semana
              </p>
              <div className="flex flex-wrap gap-2">
                {resumo.aulasNovas.slice(0, 4).map(({ aula, turma }) => (
                  <Link
                    key={aula.id}
                    href={`/instituicao/turmas/${aula.turmaId}/aulas/${aula.id}`}
                    className="rounded-full bg-secondary px-3 py-1.5 text-xs hover:bg-secondary/80"
                    title={turma}
                  >
                    {aula.titulo}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          {(resumo.avisosPorLer > 0 || resumo.proximoEvento) && (
            <Card className="space-y-2 p-5 shadow-soft">
              {resumo.avisosPorLer > 0 && (
                <Link href="/instituicao/avisos" className="flex items-center gap-2 text-sm hover:underline">
                  <Megaphone className="h-4 w-4 text-primary" aria-hidden /> {resumo.avisosPorLer} aviso{resumo.avisosPorLer === 1 ? "" : "s"} por ler
                </Link>
              )}
              {resumo.proximoEvento && (
                <Link href="/instituicao/agenda" className="flex items-start gap-2 text-sm hover:underline">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span>
                    {resumo.proximoEvento.titulo}
                    <span className="block text-xs text-muted-foreground">{dataHora(resumo.proximoEvento.inicio)}</span>
                  </span>
                </Link>
              )}
            </Card>
          )}
          {resumo.desafios[0] && (
            <Link href="/instituicao/praticar" className="block">
              <Card className="space-y-2 p-5 shadow-soft transition-shadow hover:shadow-elevated">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Desafio da escola</p>
                <p className="font-medium">{resumo.desafios[0].titulo}</p>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((resumo.desafios[0].progresso / resumo.desafios[0].meta) * 100)}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {resumo.desafios[0].progresso} de {resumo.desafios[0].meta} · termina {haQuanto(resumo.desafios[0].terminaEm)}
                </p>
              </Card>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

/** No Início do aluno que vê só a escola: os cursos e vídeos da escola no lugar dos do catálogo geral. */
function ConteudosEscolaInicio() {
  const ctx = useInstituicao();
  const [conteudos, setConteudos] = useState<ConteudoEscola[]>([]);
  const so = soEscola(ctx);
  const instituicaoId = ctx.atual?.instituicao.id;
  useEffect(() => {
    if (!instituicaoId || !so) return;
    void apiLga.listarConteudos(instituicaoId).then(setConteudos).catch(() => setConteudos([]));
  }, [instituicaoId, so]);
  if (!so || conteudos.length === 0) return null;
  return (
    <section>
      <SectionHeader title="Cursos e vídeos da tua escola" href="/cursos" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {conteudos.slice(0, 6).map((c) => (
          <CartaoConteudoEscola key={c.id} conteudo={c} />
        ))}
      </div>
    </section>
  );
}

export function InicioEscola() {
  return (
    <ComEscola>
      <AvisoPlataformaGeral />
      <InicioEscolaInterno />
      <ConteudosEscolaInicio />
    </ComEscola>
  );
}

// ── Comunidade: pública + turma ──

function ComunidadeComEscolaInterno({ children }: { children: ReactNode }) {
  const ctx = useInstituicao();
  const { atual, aCarregar } = ctx;
  const [turmas, setTurmas] = useState<TurmaLga[] | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const instituicaoId = atual?.instituicao.id;

  useEffect(() => {
    if (!instituicaoId) return;
    void apiLga
      .listarTurmas(instituicaoId)
      .then((t) => setTurmas(t.filter((x) => atual?.membro.gruposIds.includes(x.id))))
      .catch(() => setTurmas([]));
  }, [instituicaoId, atual]);

  if (aCarregar && !atual) return null;
  if (!atual) return <>{children}</>;
  if (turmas === null) return null;
  const aluno = atual.membro.papel === "aluno";
  const publicaDesligada = aluno && !atual.instituicao.escola.comunidadePublicaParaAlunos;
  const semPublica = publicaDesligada || soEscola(ctx);

  // Sem turmas: a comunidade pública, se o aluno a puder ver.
  if (turmas.length === 0) {
    if (!semPublica) return <>{children}</>;
    return (
      <div className="space-y-4">
        <AvisoPlataformaGeral />
        <Card className="space-y-2 p-6 text-center shadow-soft">
          <Lock className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
          <p className="font-medium">Ainda não estás em nenhuma turma</p>
          <p className="text-sm text-muted-foreground">Quando entrares numa turma, a comunidade da turma aparece aqui.</p>
        </Card>
      </div>
    );
  }

  const efetiva = vista ?? (semPublica ? turmas[0].id : "publica");
  const turma = turmas.find((t) => t.id === efetiva);

  return (
    <div className="space-y-6">
      {aluno && !publicaDesligada && <AvisoPlataformaGeral />}
      <Tabs value={efetiva} onValueChange={setVista}>
        <TabsList className="h-auto flex-wrap bg-surface py-1">
          {!semPublica && <TabsTrigger value="publica">Comunidade EYK</TabsTrigger>}
          {turmas.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
              <Hand className="h-3.5 w-3.5" aria-hidden /> {t.nome}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {publicaDesligada && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" aria-hidden /> Para proteger os alunos, a {atual.instituicao.nome} usa só a comunidade das turmas.
        </p>
      )}
      {turma ? (
        <SeparadorComunidade turmaId={turma.id} ensino={["educador", "formador"].includes(atual.membro.papel) && atual.membro.gruposIds.includes(turma.id)} />
      ) : (
        children
      )}
    </div>
  );
}

export function ComunidadeComEscola({ children }: { children: ReactNode }) {
  return (
    <ComEscola semEscola={children}>
      <ComunidadeComEscolaInterno>{children}</ComunidadeComEscolaInterno>
    </ComEscola>
  );
}

// ── Leaderboard: nacional, escola, turma ──

function LeaderboardComEscolaInterno({ children }: { children: ReactNode }) {
  const ctx = useInstituicao();
  const { atual, aCarregar } = ctx;
  const [turmas, setTurmas] = useState<TurmaLga[]>([]);
  const [vista, setVista] = useState<string | null>(null);
  const instituicaoId = atual?.instituicao.id;

  useEffect(() => {
    if (!instituicaoId) return;
    void apiLga
      .listarTurmas(instituicaoId)
      .then((t) => setTurmas(t.filter((x) => atual?.membro.gruposIds.includes(x.id))))
      .catch(() => setTurmas([]));
  }, [instituicaoId, atual]);

  if (aCarregar && !atual) return null;
  if (!atual || !atual.instituicao.escola.rankingVisivel) return <>{children}</>;
  // O aluno que vê só a escola não vê a classificação nacional.
  const so = soEscola(ctx);
  const efetiva = vista ?? (so ? "escola" : "nacional");

  return (
    <div className="space-y-6">
      <AvisoPlataformaGeral />
      <Tabs value={efetiva} onValueChange={setVista}>
        <TabsList className="h-auto flex-wrap bg-surface py-1">
          {!so && <TabsTrigger value="nacional">Nacional</TabsTrigger>}
          <TabsTrigger value="escola" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" aria-hidden /> A minha escola
          </TabsTrigger>
          {turmas.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.nome}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {efetiva === "nacional" && !so ? (
        children
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Moedas ganhas na escola: prática de LGA, respostas certas e desafios. Só aparece o primeiro nome.
          </p>
          <ListaClassificacao key={efetiva} ambito={efetiva === "escola" || efetiva === "nacional" ? "escola" : { turmaId: efetiva }} />
        </div>
      )}
    </div>
  );
}

export function LeaderboardComEscola({ children }: { children: ReactNode }) {
  return (
    <ComEscola semEscola={children}>
      <LeaderboardComEscolaInterno>{children}</LeaderboardComEscolaInterno>
    </ComEscola>
  );
}

// ── Gamificação: desafios da escola ──

function DesafiosEscolaInterno() {
  const { atual } = useInstituicao();
  const [desafios, setDesafios] = useState<Awaited<ReturnType<typeof apiLga.listarDesafios>>>([]);
  const instituicaoId = atual?.instituicao.id;
  useEffect(() => {
    if (!instituicaoId) return;
    void apiLga.listarDesafios(instituicaoId).then(setDesafios).catch(() => setDesafios([]));
  }, [instituicaoId]);
  if (!atual || desafios.length === 0) return null;
  return (
    <div className="space-y-2">
      <ListaDesafios desafios={desafios} titulo={`Desafios da ${atual.instituicao.nome}`} />
      <Button asChild variant="link" className="px-0">
        <Link href="/instituicao/praticar">Praticar LGA para completar os desafios</Link>
      </Button>
    </div>
  );
}

export function DesafiosEscola() {
  return (
    <ComEscola>
      <DesafiosEscolaInterno />
    </ComEscola>
  );
}

// ── Biblioteca LGA: gestos em vídeo validados pelas escolas ──

export function GestosValidadosBiblioteca({ pesquisa }: { pesquisa: string }) {
  const [gestos, setGestos] = useState<Gesto[]>([]);
  useEffect(() => {
    if (!INSTITUICOES_ATIVAS) return;
    void apiLga.listarGestos(null).then((g) => setGestos(g.filter((x) => x.instituicaoId || x.variante !== "Comum" || x.tema === "numeros" || x.tema === "frases")));
  }, []);
  const termo = pesquisa.trim().toLowerCase();
  const lista = gestos.filter((g) => !termo || g.palavra.toLowerCase().includes(termo));
  if (!INSTITUICOES_ATIVAS || lista.length === 0) return null;
  return (
    <section className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 font-serif text-xl font-semibold">
          <BadgeCheck className="h-5 w-5 text-primary" aria-hidden /> Gestuário validado
        </h2>
        <p className="text-sm text-muted-foreground">
          Números, frases e contributos das escolas parceiras, validados por formadores surdos. Inclui variantes regionais.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {lista.slice(0, 20).map((g) => (
          <CartaoGesto key={g.id} gesto={g} compacto>
            <p className={cn("text-[11px] text-muted-foreground")}>{g.instituicaoId ? "Contributo de escola parceira" : ROTULO_TEMA[g.tema]}</p>
          </CartaoGesto>
        ))}
      </div>
    </section>
  );
}
