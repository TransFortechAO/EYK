"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertOctagon, Bot, CheckCircle2, ExternalLink, EyeOff, Flag, Gavel, History, Inbox, Plus, Scale, Trash2, Type,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  api,
  mensagemDeErro,
  tempoRelativo,
  type AcaoModeracaoRegisto,
  type ContestacaoAdmin,
  type ItemFilaModeracao,
  type PalavraProibida,
} from "@/lib/api";
import { useAuth } from "@/components/auth-gate";
import { PageHeader, EmptyState } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DialogoDecisao, type Decisao } from "@/components/moderacao/dialogo-decisao";

const GRAVIDADE = {
  3: { label: "Grave", classes: "bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30" },
  2: { label: "Média", classes: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  1: { label: "Baixa", classes: "bg-muted text-muted-foreground" },
} as const;

export default function ModeracaoPage() {
  return (
    <Suspense fallback={null}>
      <Moderacao />
    </Suspense>
  );
}

function Moderacao() {
  const router = useRouter();
  const { user } = useAuth();
  const tabInicial = useSearchParams().get("tab");
  const [tab, setTab] = useState(
    tabInicial && ["fila", "contestacoes", "registo", "palavras"].includes(tabInicial) ? tabInicial : "fila",
  );
  const [contadores, setContadores] = useState({ pendentes: 0, contestacoes: 0 });

  useEffect(() => {
    if (user && !user.isStaff) router.replace("/inicio");
  }, [user, router]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Moderação"
        description="Denúncias da comunidade, contestações de decisões e regras automáticas."
      />
      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList className="w-max bg-surface">
            <TabsTrigger value="fila" className="gap-2">
              <Inbox className="h-4 w-4" /> Denúncias
              {contadores.pendentes > 0 && <Badge className="ml-1 h-5 px-1.5 text-[10px]">{contadores.pendentes}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="contestacoes" className="gap-2">
              <Scale className="h-4 w-4" /> Contestações
              {contadores.contestacoes > 0 && <Badge className="ml-1 h-5 px-1.5 text-[10px]">{contadores.contestacoes}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="registo" className="gap-2">
              <History className="h-4 w-4" /> Registo
            </TabsTrigger>
            <TabsTrigger value="palavras" className="gap-2">
              <Type className="h-4 w-4" /> Palavras proibidas
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="mt-6">
          <TabsContent value="fila">
            <Fila onContadores={setContadores} />
          </TabsContent>
          <TabsContent value="contestacoes">
            <Contestacoes />
          </TabsContent>
          <TabsContent value="registo">
            <Registo />
          </TabsContent>
          <TabsContent value="palavras">
            <Palavras />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ── Fila de denúncias ────────────────────────────────────────────────────────

function Fila({ onContadores }: { onContadores: (c: { pendentes: number; contestacoes: number }) => void }) {
  const [estado, setEstado] = useState<"pendente" | "resolvida" | "rejeitada">("pendente");
  const [itens, setItens] = useState<ItemFilaModeracao[] | null>(null);
  const [aDecidir, setADecidir] = useState<ItemFilaModeracao | null>(null);

  const carregar = useCallback(() => {
    setItens(null);
    api.admin
      .filaModeracao(estado)
      .then((res) => {
        setItens(res.itens);
        onContadores(res.contadores);
      })
      .catch(() => setItens([]));
  }, [estado, onContadores]);
  useEffect(carregar, [carregar]);

  const decidir = async (item: ItemFilaModeracao, d: Decisao): Promise<boolean> => {
    try {
      const res = await api.admin.resolverDenuncias({
        tipo: item.tipo,
        objetoId: item.objetoId,
        conteudo: d.conteudo,
        sancao: d.sancao === "levantar" ? null : d.sancao,
        motivo: d.motivo,
        dias: d.dias,
      });
      toast.success(
        res.rejeitadas
          ? `Denúncias rejeitadas (${res.denunciasResolvidas}).`
          : `Decisão aplicada a ${res.denunciasResolvidas} denúncia(s).`,
      );
      carregar();
      return true;
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível aplicar a decisão."));
      return false;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["pendente", "resolvida", "rejeitada"] as const).map((e) => (
          <Button key={e} size="sm" variant={estado === e ? "default" : "outline"} onClick={() => setEstado(e)}>
            {e === "pendente" ? "Por analisar" : e === "resolvida" ? "Resolvidas" : "Rejeitadas"}
          </Button>
        ))}
      </div>

      {itens === null ? (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      ) : itens.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={estado === "pendente" ? "Nada por analisar." : "Sem denúncias aqui."}
          description={estado === "pendente" ? "Quando alguém denunciar um conteúdo, aparece aqui." : undefined}
        />
      ) : (
        <div className="space-y-3">
          {itens.map((item) => (
            <ItemFila key={item.chave} item={item} pendente={estado === "pendente"} onDecidir={() => setADecidir(item)} />
          ))}
        </div>
      )}

      {aDecidir && (
        <DialogoDecisao
          open
          onOpenChange={(aberto) => !aberto && setADecidir(null)}
          titulo={`Decidir: ${aDecidir.tipoLabel.toLowerCase()}`}
          descricao={
            aDecidir.autor
              ? `Autor: ${aDecidir.autor.nome} (@${aDecidir.autor.username}) · ${aDecidir.autor.avisos} aviso(s), ${aDecidir.autor.suspensoes} suspensão(ões) anteriores.`
              : undefined
          }
          conteudo={
            aDecidir.existe
              ? { ocultavel: aDecidir.ocultavel, apagavel: aDecidir.apagavel, oculto: aDecidir.oculto }
              : { ocultavel: false, apagavel: false, oculto: false }
          }
          onConfirmar={(d) => decidir(aDecidir, d)}
        />
      )}
    </div>
  );
}

function ItemFila({ item, pendente, onDecidir }: { item: ItemFilaModeracao; pendente: boolean; onDecidir: () => void }) {
  const gravidade = GRAVIDADE[item.gravidade as 1 | 2 | 3] ?? GRAVIDADE[1];
  const autor = item.autor;
  return (
    <Card className="space-y-4 p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("gap-1", gravidade.classes)}>
            <AlertOctagon className="h-3 w-3" /> {gravidade.label}
          </Badge>
          <Badge variant="outline">{item.tipoLabel}</Badge>
          <span className="inline-flex items-center gap-1 text-sm font-medium">
            <Flag className="h-3.5 w-3.5" /> {item.total} denúncia{item.total === 1 ? "" : "s"}
          </span>
          {item.oculto && (
            <Badge variant="outline" className="gap-1">
              <EyeOff className="h-3 w-3" /> Oculto
            </Badge>
          )}
          {!item.existe && <Badge variant="outline">Já apagado</Badge>}
        </div>
        <span className="text-xs text-muted-foreground">última {tempoRelativo(item.ultima)}</span>
      </div>

      <blockquote className="whitespace-pre-wrap break-words rounded-xl border-l-4 border-primary/50 bg-surface px-4 py-3 text-sm">
        {item.conteudo || <span className="text-muted-foreground">(sem texto)</span>}
      </blockquote>

      <div className="flex flex-wrap gap-2">
        {item.motivos.map((m) => (
          <span key={m.id} className="rounded-full bg-muted px-2.5 py-1 text-xs">
            {m.label} · {m.total}
          </span>
        ))}
      </div>

      {item.descricoes.some((d) => d.descricao) && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {item.descricoes
            .filter((d) => d.descricao)
            .map((d, i) => (
              <li key={i}>
                <span className="font-medium text-foreground">{d.denunciante}</span> ({d.motivo.toLowerCase()}): “{d.descricao}”
              </li>
            ))}
        </ul>
      )}

      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        {autor ? (
          <div className="text-sm">
            <Link href={`/perfil/${autor.id}`} className="font-medium hover:underline">
              {autor.nome}
            </Link>{" "}
            <span className="text-muted-foreground">@{autor.username}</span>
            <p className="text-xs text-muted-foreground">
              {autor.denunciasRecebidas} denúncia(s) recebida(s) · {autor.avisos} aviso(s) · {autor.suspensoes} suspensão(ões)
              {autor.banido && " · BANIDO"}
              {autor.suspensoAte && ` · suspenso até ${new Date(autor.suspensoAte).toLocaleDateString("pt-PT")}`}
            </p>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Autor desconhecido</span>
        )}
        <div className="flex gap-2">
          {item.link && (
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href={item.link} target="_blank">
                <ExternalLink className="h-3.5 w-3.5" /> Ver no sítio
              </Link>
            </Button>
          )}
          {pendente && (
            <Button size="sm" className="gap-1.5" onClick={onDecidir}>
              <Gavel className="h-3.5 w-3.5" /> Decidir
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Contestações ─────────────────────────────────────────────────────────────

function Contestacoes() {
  const [estado, setEstado] = useState<"pendente" | "aceite" | "recusada">("pendente");
  const [lista, setLista] = useState<ContestacaoAdmin[] | null>(null);
  const [respostas, setRespostas] = useState<Record<number, string>>({});

  const carregar = useCallback(() => {
    setLista(null);
    api.admin.contestacoes(estado).then(setLista).catch(() => setLista([]));
  }, [estado]);
  useEffect(carregar, [carregar]);

  const responder = async (c: ContestacaoAdmin, aceitar: boolean) => {
    try {
      await api.admin.responderContestacao(c.id, aceitar, respostas[c.id] || "");
      toast.success(aceitar ? "Contestação aceite — a decisão foi anulada." : "Contestação recusada.");
      carregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível responder."));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["pendente", "aceite", "recusada"] as const).map((e) => (
          <Button key={e} size="sm" variant={estado === e ? "default" : "outline"} onClick={() => setEstado(e)}>
            {e === "pendente" ? "Por responder" : e === "aceite" ? "Aceites" : "Recusadas"}
          </Button>
        ))}
      </div>
      {lista === null ? (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      ) : lista.length === 0 ? (
        <EmptyState icon={Scale} title="Sem contestações aqui." />
      ) : (
        lista.map((c) => (
          <Card key={c.id} className="space-y-3 p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                <Link href={`/perfil/${c.utilizador.id}`} className="font-medium hover:underline">
                  {c.utilizador.nome}
                </Link>{" "}
                contesta: <span className="font-medium">{c.acao.tipoLabel.toLowerCase()}</span>
                {c.acao.duracaoDias ? ` (${c.acao.duracaoDias} dias)` : ""}
              </p>
              <span className="text-xs text-muted-foreground">{tempoRelativo(c.criadaEm)}</span>
            </div>
            {c.acao.motivo && <p className="text-xs text-muted-foreground">Motivo da decisão: {c.acao.motivo}</p>}
            {c.acao.conteudo && (
              <blockquote className="rounded-xl bg-surface px-4 py-2 text-xs text-muted-foreground">{c.acao.conteudo}</blockquote>
            )}
            <p className="whitespace-pre-wrap rounded-xl border px-4 py-3 text-sm">{c.texto}</p>
            {c.estado === "pendente" ? (
              <>
                <Textarea
                  value={respostas[c.id] || ""}
                  onChange={(e) => setRespostas((r) => ({ ...r, [c.id]: e.target.value }))}
                  rows={2}
                  placeholder="Resposta ao utilizador (opcional, vai por email)"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void responder(c, true)}>
                    Aceitar e anular decisão
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void responder(c, false)}>
                    Manter decisão
                  </Button>
                </div>
              </>
            ) : (
              c.resposta && <p className="text-xs text-muted-foreground">Resposta: {c.resposta}</p>
            )}
          </Card>
        ))
      )}
    </div>
  );
}

// ── Registo de moderação ─────────────────────────────────────────────────────

function Registo() {
  const [lista, setLista] = useState<AcaoModeracaoRegisto[] | null>(null);
  useEffect(() => {
    api.admin.registoModeracao().then(setLista).catch(() => setLista([]));
  }, []);

  if (lista === null) return <p className="text-sm text-muted-foreground">A carregar…</p>;
  if (lista.length === 0) return <EmptyState icon={History} title="Ainda não há decisões de moderação." />;

  return (
    <Card className="divide-y shadow-soft">
      {lista.map((a) => (
        <div key={a.id} className="flex gap-3 p-4">
          <div className="mt-0.5">
            {a.automatica ? <Bot className="h-4 w-4 text-muted-foreground" /> : <Gavel className="h-4 w-4 text-primary" />}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-sm">
              <span className="font-medium">{a.tipoLabel}</span>
              {a.duracaoDias ? ` (${a.duracaoDias} dias)` : ""}
              {a.alvo && (
                <>
                  {" · "}
                  <Link href={`/perfil/${a.alvo.id}`} className="hover:underline">
                    {a.alvo.nome}
                  </Link>
                </>
              )}
              {a.conteudoTipo && <span className="text-muted-foreground"> · {a.conteudoTipo.toLowerCase()}</span>}
              {a.revertida && <Badge variant="outline" className="ml-2 text-[10px]">Anulada</Badge>}
            </div>
            {a.motivo && <p className="text-xs text-muted-foreground">{a.motivo}</p>}
            {a.conteudo && <p className="line-clamp-2 text-xs italic text-muted-foreground">“{a.conteudo}”</p>}
            <p className="text-[11px] text-muted-foreground">
              {a.moderador} · {new Date(a.criadaEm).toLocaleString("pt-PT")}
            </p>
          </div>
        </div>
      ))}
    </Card>
  );
}

// ── Palavras proibidas ───────────────────────────────────────────────────────

function Palavras() {
  const [lista, setLista] = useState<PalavraProibida[] | null>(null);
  const [termo, setTermo] = useState("");
  const [acao, setAcao] = useState<"bloquear" | "sinalizar">("bloquear");

  useEffect(() => {
    api.admin.palavras().then(setLista).catch(() => setLista([]));
  }, []);

  const adicionar = async () => {
    try {
      setLista(await api.admin.adicionarPalavra(termo.trim(), acao));
      setTermo("");
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível adicionar."));
    }
  };

  const apagar = async (p: PalavraProibida) => {
    try {
      await api.admin.apagarPalavra(p.id);
      setLista((l) => (l || []).filter((x) => x.id !== p.id));
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível remover."));
    }
  };

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-6 shadow-soft">
        <p className="text-sm text-muted-foreground">
          Aplica-se a publicações, comentários, avaliações e biografias. A comparação ignora maiúsculas, acentos e
          truques como “m3rd@”, e só apanha a palavra inteira. <strong>Impedir</strong> recusa o texto;{" "}
          <strong>Sinalizar</strong> deixa publicar mas manda para a fila de denúncias.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Palavra ou expressão"
            maxLength={100}
            onKeyDown={(e) => {
              if (e.key === "Enter" && termo.trim()) void adicionar();
            }}
          />
          <div className="flex gap-2">
            {(["bloquear", "sinalizar"] as const).map((a) => (
              <Button key={a} variant={acao === a ? "default" : "outline"} onClick={() => setAcao(a)}>
                {a === "bloquear" ? "Impedir" : "Sinalizar"}
              </Button>
            ))}
            <Button variant="outline" className="gap-1.5" disabled={!termo.trim()} onClick={() => void adicionar()}>
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </div>
        </div>
      </Card>

      {lista === null ? (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      ) : (
        <Card className="divide-y shadow-soft">
          {lista.length === 0 && <p className="p-4 text-sm text-muted-foreground">A lista está vazia.</p>}
          {lista.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex-1 font-mono text-sm">{p.termo}</span>
              <Badge variant="outline" className={p.acao === "bloquear" ? "border-red-500/40 text-red-600 dark:text-red-300" : ""}>
                {p.acao === "bloquear" ? "Impedir" : "Sinalizar"}
              </Badge>
              <Button size="icon" variant="ghost" aria-label={`Remover ${p.termo}`} onClick={() => void apagar(p)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
