"use client";

import { useMemo, useState, type FormEvent } from "react";
import { BellRing, CalendarDays, ChevronLeft, ChevronRight, Link as LinkIcon, MapPin, Plus, Repeat, Users, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirm } from "@/components/confirm-dialog";
import { useInstituicaoAtual } from "@/components/instituicao/contexto";
import {
  acao,
  Caixa,
  Campo,
  Carregando,
  deInputLuanda,
  diaLuanda,
  ErroCarregar,
  erroTexto,
  EscolherDestinatarios,
  Etiqueta,
  FUSO,
  hora,
  rotuloDestinatarios,
  Seletor,
  useCarregar,
} from "@/components/instituicao/ui";
import { apiInstituicoes as api } from "@/lib/instituicoes/api";
import type { Destinatarios, Evento, Grupo, Recorrencia, RespostaPresenca } from "@/lib/instituicoes/tipos";
import { cn } from "@/lib/utils";

const DIA = 24 * 60 * 60 * 1000;
const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const ROTULO_RECORRENCIA: Record<Recorrencia, string> = { nenhuma: "Não se repete", semanal: "Todas as semanas", mensal: "Todos os meses" };
const ROTULO_RESPOSTA: Record<RespostaPresenca, string> = { vou: "Vou", talvez: "Talvez", nao_vou: "Não vou" };

type Ocorrencia = { evento: Evento; inicio: string; dia: string };

/** Ocorrências de um evento (com repetição) dentro de um intervalo de dias. */
function ocorrencias(ev: Evento, deDia: string, ateDia: string): Ocorrencia[] {
  const r: Ocorrencia[] = [];
  const base = new Date(ev.inicio);
  for (let i = 0; i < 400; i++) {
    const d = new Date(base);
    if (ev.recorrencia === "semanal") d.setTime(base.getTime() + i * 7 * DIA);
    else if (ev.recorrencia === "mensal") d.setMonth(base.getMonth() + i);
    else if (i > 0) break;
    const dia = diaLuanda(d);
    if (dia > ateDia) break;
    if (dia >= deDia) r.push({ evento: ev, inicio: d.toISOString(), dia });
  }
  return r;
}

export default function AgendaPage() {
  const { instituicaoId, pode } = useInstituicaoAtual();
  const confirmar = useConfirm();
  const hoje = diaLuanda(new Date());
  const [mes, setMes] = useState(() => hoje.slice(0, 7)); // "AAAA-MM"
  const [diaEscolhido, setDiaEscolhido] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);

  const { dados, erro, aCarregar, recarregar } = useCarregar(async () => {
    const [eventos, grupos, membros] = await Promise.all([
      api.listarEventos(instituicaoId),
      pode("criar_eventos") || pode("ver_todos_grupos") ? api.listarGrupos(instituicaoId) : Promise.resolve([]),
      pode("criar_eventos") ? api.listarMembros(instituicaoId) : Promise.resolve([]),
    ]);
    return { eventos, grupos, membros };
  }, [instituicaoId]);

  const [ano, mesN] = mes.split("-").map(Number);
  const primeiroDia = `${mes}-01`;
  const diasNoMes = new Date(Date.UTC(ano, mesN, 0)).getUTCDate();
  const ultimoDia = `${mes}-${String(diasNoMes).padStart(2, "0")}`;
  const deslocamento = (new Date(Date.UTC(ano, mesN - 1, 1)).getUTCDay() + 6) % 7; // segunda = 0

  const doMes = useMemo(
    () =>
      (dados?.eventos ?? [])
        .flatMap((ev) => ocorrencias(ev, primeiroDia, ultimoDia))
        .sort((a, b) => a.inicio.localeCompare(b.inicio)),
    [dados, primeiroDia, ultimoDia],
  );

  const mudarMes = (delta: number) => {
    const d = new Date(Date.UTC(ano, mesN - 1 + delta, 1));
    setMes(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    setDiaEscolhido(null);
  };

  const responder = async (eventoId: string, r: RespostaPresenca) => {
    if (await acao(() => api.responderPresenca(instituicaoId, eventoId, r), "Resposta guardada.")) await recarregar();
  };

  const cancelar = async (ev: Evento) => {
    const ok = await confirmar({
      title: `Cancelar «${ev.titulo}»?`,
      description: "Os destinatários recebem um aviso automático do cancelamento.",
      confirmLabel: "Cancelar evento",
      destructive: true,
    });
    if (!ok) return;
    if (await acao(() => api.cancelarEvento(instituicaoId, ev.id), "Evento cancelado e destinatários avisados.")) await recarregar();
  };

  if (aCarregar && !dados) return <Carregando />;
  if (!dados) return <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />;

  const lista = diaEscolhido ? doMes.filter((o) => o.dia === diaEscolhido) : doMes.filter((o) => o.dia >= (mes === hoje.slice(0, 7) ? hoje : primeiroDia));
  const nomeMes = new Date(Date.UTC(ano, mesN - 1, 15)).toLocaleDateString("pt-PT", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Agenda</h2>
          <p className="text-sm text-muted-foreground">Reuniões, atividades e prazos. Horas de Angola (WAT).</p>
        </div>
        {pode("criar_eventos") && (
          <Button className="gap-1.5" onClick={() => setNovo(true)}>
            <Plus className="h-4 w-4" /> Novo evento
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <Card className="h-fit p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => mudarMes(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="font-medium capitalize">{nomeMes}</p>
            <Button variant="ghost" size="icon" aria-label="Mês seguinte" onClick={() => mudarMes(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-muted-foreground">
            {DIAS_SEMANA.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: deslocamento }).map((_, i) => (
              <span key={`v${i}`} />
            ))}
            {Array.from({ length: diasNoMes }).map((_, i) => {
              const dia = `${mes}-${String(i + 1).padStart(2, "0")}`;
              const n = doMes.filter((o) => o.dia === dia && !o.evento.cancelado).length;
              const escolhido = diaEscolhido === dia;
              return (
                <button
                  key={dia}
                  type="button"
                  onClick={() => setDiaEscolhido(escolhido ? null : dia)}
                  aria-pressed={escolhido}
                  aria-label={`${i + 1}${n ? `, ${n} evento${n === 1 ? "" : "s"}` : ""}`}
                  className={cn(
                    "relative grid aspect-square place-items-center rounded-lg text-sm transition-colors pointer-coarse:min-h-10",
                    escolhido ? "bg-primary text-primary-foreground" : dia === hoje ? "ring-1 ring-primary" : "hover:bg-secondary",
                  )}
                >
                  {i + 1}
                  {n > 0 && <span className={cn("absolute bottom-1 h-1.5 w-1.5 rounded-full", escolhido ? "bg-primary-foreground" : "bg-primary")} />}
                </button>
              );
            })}
          </div>
          {diaEscolhido && (
            <Button variant="link" size="sm" className="mt-2 px-0" onClick={() => setDiaEscolhido(null)}>
              Ver o mês todo
            </Button>
          )}
        </Card>

        <div className="space-y-3">
          {lista.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 p-10 text-center shadow-soft">
              <CalendarDays className="h-6 w-6 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">{diaEscolhido ? "Nada neste dia." : "Nada agendado para o resto do mês."}</p>
            </Card>
          ) : (
            lista.map((o) => (
              <CartaoEvento
                key={`${o.evento.id}-${o.inicio}`}
                o={o}
                destino={rotuloDestinatarios(o.evento.destinatarios, dados.grupos, dados.membros)}
                podeGerir={pode("criar_eventos")}
                aoResponder={(r) => void responder(o.evento.id, r)}
                aoCancelar={() => void cancelar(o.evento)}
              />
            ))
          )}
        </div>
      </div>

      {pode("criar_eventos") && (
        <NovoEvento
          aberto={novo}
          aoFechar={() => setNovo(false)}
          aoCriar={async () => {
            setNovo(false);
            await recarregar();
          }}
          grupos={dados.grupos}
        />
      )}
    </div>
  );
}

function CartaoEvento({
  o,
  destino,
  podeGerir,
  aoResponder,
  aoCancelar,
}: {
  o: Ocorrencia;
  destino: string;
  podeGerir: boolean;
  aoResponder: (r: RespostaPresenca) => void;
  aoCancelar: () => void;
}) {
  const ev = o.evento;
  const data = new Date(o.inicio);
  const fimMs = new Date(ev.fim).getTime() - new Date(ev.inicio).getTime();
  const passado = data.getTime() < Date.now();
  return (
    <Card className={cn("flex gap-4 p-5 shadow-soft", ev.cancelado && "opacity-60")}>
      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-primary/10 text-center leading-none text-primary">
        <span className="text-xl font-semibold">{Number(o.dia.slice(8))}</span>
        <span className="text-[10px] uppercase">{data.toLocaleDateString("pt-PT", { weekday: "short", timeZone: FUSO })}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={cn("font-medium", ev.cancelado && "line-through")}>{ev.titulo}</h3>
          {ev.cancelado && <Etiqueta tom="perigo">Cancelado</Etiqueta>}
          {ev.recorrencia !== "nenhuma" && (
            <Etiqueta>
              <Repeat className="h-3 w-3" aria-hidden /> {ROTULO_RECORRENCIA[ev.recorrencia]}
            </Etiqueta>
          )}
        </div>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            {hora(o.inicio)}
            {fimMs > 0 && ` – ${hora(new Date(data.getTime() + fimMs).toISOString())}`}
          </span>
          {ev.local && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden /> {ev.local}
            </span>
          )}
          {ev.ligacao && (
            <a href={ev.ligacao} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              <LinkIcon className="h-3 w-3" aria-hidden /> Entrar na sessão
            </a>
          )}
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" aria-hidden /> {destino}
          </span>
          {ev.lembretes.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <BellRing className="h-3 w-3" aria-hidden /> lembrete {ev.lembretes.map((l) => (l === "1d" ? "1 dia" : "1 hora")).join(" e ")} antes
            </span>
          )}
        </p>
        {ev.descricao && <p className="text-sm">{ev.descricao}</p>}

        {!ev.cancelado && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {!passado ? (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Confirmar presença">
                {(Object.keys(ROTULO_RESPOSTA) as RespostaPresenca[]).map((r) => (
                  <Button key={r} size="sm" variant={ev.minhaResposta === r ? "default" : "outline"} aria-pressed={ev.minhaResposta === r} onClick={() => aoResponder(r)}>
                    {ROTULO_RESPOSTA[r]}
                  </Button>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Já passou.</span>
            )}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold tabular-nums text-foreground">{ev.presencas.vou}</span> vão ·{" "}
                <span className="tabular-nums">{ev.presencas.talvez}</span> talvez
              </span>
              {podeGerir && (
                <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground hover:text-destructive" onClick={aoCancelar}>
                  <XCircle className="h-4 w-4" /> Cancelar
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function NovoEvento({ aberto, aoFechar, aoCriar, grupos }: { aberto: boolean; aoFechar: () => void; aoCriar: () => void; grupos: Grupo[] }) {
  const { instituicaoId, pode } = useInstituicaoAtual();
  const podeInstituicao = pode("gerir_membros");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [local, setLocal] = useState("");
  const [ligacao, setLigacao] = useState("");
  const [destino, setDestino] = useState<Destinatarios>(podeInstituicao ? { tipo: "instituicao" } : { tipo: "grupo", grupoId: grupos[0]?.id ?? "" });
  const [recorrencia, setRecorrencia] = useState<Recorrencia>("nenhuma");
  const [lembrete1d, setLembrete1d] = useState(true);
  const [lembrete1h, setLembrete1h] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setAEnviar(true);
    try {
      await api.criarEvento(instituicaoId, {
        titulo,
        descricao,
        inicio: deInputLuanda(inicio),
        fim: deInputLuanda(fim),
        local,
        ligacao,
        destinatarios: destino,
        recorrencia,
        lembretes: [...(lembrete1d ? (["1d"] as const) : []), ...(lembrete1h ? (["1h"] as const) : [])],
      });
      setTitulo("");
      setDescricao("");
      setInicio("");
      setFim("");
      aoCriar();
    } catch (err) {
      setErro(erroTexto(err));
    } finally {
      setAEnviar(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div>
            <DialogTitle>Novo evento</DialogTitle>
            <DialogDescription>Os destinatários vêem-no na agenda e recebem os lembretes que escolheres.</DialogDescription>
          </div>
        </DialogHeader>
        <form onSubmit={submeter} className="flex min-h-0 flex-col">
          <div className="space-y-4 overflow-y-auto p-5">
            <Campo id="ne-titulo" rotulo="Título">
              <Input id="ne-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} required autoFocus />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="ne-inicio" rotulo="Início (hora de Angola)">
                <Input id="ne-inicio" type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
              </Campo>
              <Campo id="ne-fim" rotulo="Fim (opcional)">
                <Input id="ne-fim" type="datetime-local" value={fim} min={inicio} onChange={(e) => setFim(e.target.value)} />
              </Campo>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="ne-local" rotulo="Local">
                <Input id="ne-local" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="ex: Sala polivalente" />
              </Campo>
              <Campo id="ne-lig" rotulo="Ligação (sessão online)">
                <Input id="ne-lig" type="url" value={ligacao} onChange={(e) => setLigacao(e.target.value)} placeholder="https://" />
              </Campo>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="ne-dest" rotulo="Para quem">
                <EscolherDestinatarios id="ne-dest" valor={destino} onChange={setDestino} grupos={grupos} podeInstituicao={podeInstituicao} />
              </Campo>
              <Campo id="ne-rec" rotulo="Repetição">
                <Seletor id="ne-rec" value={recorrencia} onChange={(e) => setRecorrencia(e.target.value as Recorrencia)}>
                  {(Object.keys(ROTULO_RECORRENCIA) as Recorrencia[]).map((r) => (
                    <option key={r} value={r}>
                      {ROTULO_RECORRENCIA[r]}
                    </option>
                  ))}
                </Seletor>
              </Campo>
            </div>
            <Campo id="ne-desc" rotulo="Descrição">
              <Textarea id="ne-desc" rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </Campo>
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="mb-1.5 text-sm font-medium">Lembretes</legend>
              <Caixa id="ne-l1d" checked={lembrete1d} onChange={setLembrete1d}>
                1 dia antes
              </Caixa>
              <Caixa id="ne-l1h" checked={lembrete1h} onChange={setLembrete1h}>
                1 hora antes
              </Caixa>
            </fieldset>
            <p className="text-xs text-muted-foreground">Os lembretes respeitam as preferências de aviso de cada pessoa.</p>
            {erro && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
          </div>
          <DialogFooter className="flex justify-end gap-2 space-y-0">
            <Button type="button" variant="outline" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={aEnviar}>
              {aEnviar ? "A criar…" : "Criar evento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
