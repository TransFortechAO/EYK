"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardCheck, FileText, Link2, MessageSquare, RotateCcw, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/eyk";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/auth-gate";
import { CampoPesquisaPagina, usePesquisaPagina } from "@/components/pesquisa-pagina";
import {
  API_BASE_URL,
  api,
  mensagemDeErro,
  type AcaoCandidatura,
  type CandidaturaAdmin,
  type EstadoCandidatura,
  type ListaCandidaturas,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const ROTULO: Record<EstadoCandidatura, string> = {
  por_completar: "Por completar",
  submetida: "Submetida",
  em_analise: "Em análise",
  correcao_pedida: "Correção pedida",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
  suspensa: "Suspensa",
};

const TOM: Partial<Record<EstadoCandidatura, string>> = {
  submetida: "bg-primary/15 text-primary",
  em_analise: "bg-info/15 text-info",
  correcao_pedida: "bg-warning/15 text-warning",
  aprovada: "bg-success/15 text-success",
  rejeitada: "bg-destructive/15 text-destructive",
};

const FILTROS: { id: string; rotulo: string }[] = [
  { id: "pendentes", rotulo: "Por decidir" },
  { id: "correcao_pedida", rotulo: "Correção pedida" },
  { id: "aprovada", rotulo: "Aprovadas" },
  { id: "rejeitada", rotulo: "Rejeitadas" },
  { id: "todas", rotulo: "Todas" },
];

const DOCUMENTO: Record<string, string> = {
  diploma: "Diploma",
  certificado: "Certificado",
  video: "Vídeo de demonstração",
  portefolio: "Portefólio",
  outro: "Outra evidência",
};

const data = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-PT", { day: "numeric", month: "short", year: "numeric" }) : "—");

function Estado({ estado }: { estado: EstadoCandidatura }) {
  return <Badge className={cn("rounded-full border-0", TOM[estado] ?? "bg-secondary text-secondary-foreground")}>{ROTULO[estado]}</Badge>;
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <div className="whitespace-pre-line text-sm">{children}</div>
    </div>
  );
}

/** A candidatura aberta: dados, documentos, histórico, notas internas e as decisões. */
function Detalhe({ id, aoFechar, aoMudar }: { id: number; aoFechar: () => void; aoMudar: () => void }) {
  const [c, setC] = useState<CandidaturaAdmin | null>(null);
  const [acao, setAcao] = useState<AcaoCandidatura | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [nota, setNota] = useState("");
  const [aEnviar, setAEnviar] = useState(false);

  useEffect(() => {
    void api.admin.candidaturas.obter(id).then(setC).catch((err) => toast.error(mensagemDeErro(err, "Não foi possível abrir a candidatura.")));
  }, [id]);

  const decidir = async (escolhida: AcaoCandidatura, texto = "") => {
    setAEnviar(true);
    try {
      const novo = await api.admin.candidaturas.decidir(id, escolhida, texto);
      setC(novo);
      setAcao(null);
      setMensagem("");
      aoMudar();
      toast.success(
        { aprovar: "Candidatura aprovada. O candidato já é professor.", rejeitar: "Candidatura rejeitada.", corrigir: "Pedido de correção enviado.", em_analise: "Marcada como em análise." }[escolhida],
      );
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível guardar a decisão."));
    } finally {
      setAEnviar(false);
    }
  };

  const guardarNota = async () => {
    setAEnviar(true);
    try {
      setC(await api.admin.candidaturas.nota(id, nota));
      setNota("");
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível guardar a nota."));
    } finally {
      setAEnviar(false);
    }
  };

  const porDecidir = c && (c.estado === "submetida" || c.estado === "em_analise");

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[92dvh] sm:max-w-3xl">
        <DialogHeader>
          <div>
            <DialogTitle>{c ? c.nome : "A carregar…"}</DialogTitle>
            {c && (
              <DialogDescription>
                {c.email} · candidatura de {data(c.criadaEm)}
              </DialogDescription>
            )}
          </div>
        </DialogHeader>
        {c && (
          <div className="space-y-6 overflow-y-auto p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Estado estado={c.estado} />
              {c.submetidaEm && <span className="text-xs text-muted-foreground">Enviada a {data(c.submetidaEm)}</span>}
              {c.decididaPor && (
                <span className="text-xs text-muted-foreground">
                  · Decidida por {c.decididaPor} a {data(c.decididaEm)}
                </span>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Área">{c.area || "—"}</Campo>
              <Campo rotulo="Qualificação">
                {c.tipoQualificacao === "formal" ? "Formal (diploma ou certificado)" : c.tipoQualificacao === "competencia" ? "Competência demonstrada" : "—"}
              </Campo>
              <Campo rotulo="Telefone">{c.telefone || "—"}</Campo>
              <Campo rotulo="Portefólio">
                {c.portefolioUrl ? (
                  <a href={c.portefolioUrl} target="_blank" rel="noopener noreferrer" className="break-all text-primary hover:underline">
                    {c.portefolioUrl}
                  </a>
                ) : (
                  "—"
                )}
              </Campo>
            </div>
            {c.apresentacao && <Campo rotulo="Apresentação">{c.apresentacao}</Campo>}
            {c.experiencia && <Campo rotulo="Experiência">{c.experiencia}</Campo>}

            <section className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Documentos e evidências</p>
              {c.documentos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem documentos.</p>
              ) : (
                <ul className="space-y-2">
                  {c.documentos.map((d) => {
                    const href = d.link ?? (d.url ? `${API_BASE_URL}${d.url}` : null);
                    return (
                      <li key={d.id} className="flex items-center gap-3 rounded-xl bg-surface p-3 text-sm">
                        {d.link ? <Link2 className="h-4 w-4 shrink-0 text-primary" aria-hidden /> : <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">{DOCUMENTO[d.tipo] ?? d.tipo}</span>
                          <span className="block truncate text-xs text-muted-foreground">{d.titulo || d.nome || d.link}</span>
                        </span>
                        {href && (
                          <Button asChild size="sm" variant="outline">
                            <a href={href} target="_blank" rel="noopener noreferrer">
                              Abrir
                            </a>
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Decisões: só quando a candidatura está à espera de uma. */}
            {porDecidir && (
              <section className="space-y-3 rounded-2xl border border-border p-4">
                <p className="text-sm font-medium">Decisão</p>
                {acao === "rejeitar" || acao === "corrigir" ? (
                  <div className="space-y-2">
                    <Textarea
                      autoFocus
                      rows={3}
                      maxLength={2000}
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                      placeholder={acao === "rejeitar" ? "Motivo da rejeição (o candidato vai recebê-lo)" : "O que o candidato deve completar ou corrigir"}
                      aria-label={acao === "rejeitar" ? "Motivo da rejeição" : "O que corrigir"}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setAcao(null)}>
                        Cancelar
                      </Button>
                      <Button
                        variant={acao === "rejeitar" ? "destructive" : "default"}
                        disabled={aEnviar || !mensagem.trim()}
                        onClick={() => void decidir(acao, mensagem.trim())}
                      >
                        {acao === "rejeitar" ? "Rejeitar candidatura" : "Pedir correção"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button className="gap-1.5" disabled={aEnviar} onClick={() => void decidir("aprovar")}>
                      <CheckCircle2 className="h-4 w-4" /> Aprovar
                    </Button>
                    <Button variant="outline" className="gap-1.5" disabled={aEnviar} onClick={() => setAcao("corrigir")}>
                      <RotateCcw className="h-4 w-4" /> Pedir correção
                    </Button>
                    <Button variant="outline" className="gap-1.5 text-destructive" disabled={aEnviar} onClick={() => setAcao("rejeitar")}>
                      <XCircle className="h-4 w-4" /> Rejeitar
                    </Button>
                    {c.estado === "submetida" && (
                      <Button variant="ghost" disabled={aEnviar} onClick={() => void decidir("em_analise")}>
                        Marcar em análise
                      </Button>
                    )}
                  </div>
                )}
              </section>
            )}

            <section className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" aria-hidden /> Notas internas (o candidato não as vê)
              </p>
              {c.notas.map((n) => (
                <div key={n.id} className="rounded-xl bg-surface p-3 text-sm">
                  <p className="whitespace-pre-line">{n.texto}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {n.autor} · {data(n.em)}
                  </p>
                </div>
              ))}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Textarea rows={2} maxLength={4000} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex: parecer de um especialista externo" aria-label="Nova nota interna" />
                <Button variant="outline" className="sm:self-end" disabled={aEnviar || !nota.trim()} onClick={() => void guardarNota()}>
                  Guardar nota
                </Button>
              </div>
            </section>

            {c.historico.length > 0 && (
              <section className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Histórico</p>
                <ol className="space-y-2 border-l border-border pl-4">
                  {c.historico.map((h, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-medium">{ROTULO[h.para]}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {h.por} · {data(h.em)}
                      </span>
                      {h.mensagem && <p className="whitespace-pre-line text-xs text-muted-foreground">{h.mensagem}</p>}
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function CandidaturasPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [q] = usePesquisaPagina();
  const [estado, setEstado] = useState("pendentes");
  const [area, setArea] = useState("");
  const [dados, setDados] = useState<ListaCandidaturas | null>(null);
  const [aberta, setAberta] = useState<number | null>(null);

  useEffect(() => {
    if (user && !user.isStaff) router.replace("/inicio");
  }, [user, router]);

  const carregar = useCallback(async () => {
    try {
      setDados(await api.admin.candidaturas.listar({ estado, area, q: q.trim() }));
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível carregar as candidaturas."));
    }
  }, [estado, area, q]);

  useEffect(() => {
    if (!user?.isStaff) return;
    const t = setTimeout(() => void carregar(), 250);
    return () => clearTimeout(t);
  }, [carregar, user]);

  if (!user?.isStaff) return null;
  const contagem = (id: string) => (id === "todas" ? undefined : dados?.contagens[id]);

  return (
    <div className="space-y-8">
      <PageHeader title="Candidaturas a professor" description="Analisa as candidaturas, decide e o candidato é avisado na app e por email." />
      <CampoPesquisaPagina className="computador:hidden" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={estado} onValueChange={setEstado}>
          <TabsList className="h-auto flex-wrap justify-start bg-surface p-1">
            {FILTROS.map((f) => (
              <TabsTrigger key={f.id} value={f.id} className="gap-1.5 text-xs sm:text-sm">
                {f.rotulo}
                {contagem(f.id) ? <span className="tabular-nums text-muted-foreground">{contagem(f.id)}</span> : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <select
          aria-label="Filtrar por área"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="h-10 rounded-full border border-input bg-card px-4 text-sm"
        >
          <option value="">Todas as áreas</option>
          {(dados?.areas ?? []).map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {!dados ? (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      ) : dados.candidaturas.length === 0 ? (
        <EmptyState
          icon={q || area ? Search : ClipboardCheck}
          title={q || area ? "Nada encontrado" : estado === "pendentes" ? "Nenhuma candidatura por decidir" : "Sem candidaturas aqui"}
          description={estado === "pendentes" ? "Quando alguém enviar uma candidatura, aparece aqui." : undefined}
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {dados.candidaturas.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setAberta(c.id)} className="w-full text-left">
                <Card className="flex items-start justify-between gap-3 p-4 shadow-soft transition-shadow hover:shadow-elevated">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.area || "Sem área"} · {c.tipoQualificacao === "formal" ? "Formal" : c.tipoQualificacao === "competencia" ? "Competência" : "—"} · {c.documentos} documento{c.documentos === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Enviada a {data(c.submetidaEm)}</p>
                  </div>
                  <Estado estado={c.estado} />
                </Card>
              </button>
            </li>
          ))}
        </ul>
      )}

      {aberta !== null && <Detalhe id={aberta} aoFechar={() => setAberta(null)} aoMudar={() => void carregar()} />}
    </div>
  );
}
