"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { BellRing, CheckCheck, Eye, Megaphone, Paperclip, Plus, Settings2, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/eyk";
import { useInstituicaoAtual } from "@/components/instituicao/contexto";
import {
  acao,
  Barra,
  Caixa,
  Campo,
  Carregando,
  ErroCarregar,
  erroTexto,
  EscolherDestinatarios,
  Etiqueta,
  haQuanto,
  rotuloDestinatarios,
  Seletor,
  useCarregar,
} from "@/components/instituicao/ui";
import { apiInstituicoes as api } from "@/lib/instituicoes/api";
import type { Aviso, Destinatarios, FicheiroInstituicao, Grupo, Membro } from "@/lib/instituicoes/tipos";

type Filtro = "todos" | "por_ler" | "confirmar" | "meus";

export default function AvisosPage() {
  const { instituicaoId, pode, atual } = useInstituicaoAtual();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [novo, setNovo] = useState(false);
  const [prefs, setPrefs] = useState(false);
  const eu = atual.membro.id;

  const { dados, erro, aCarregar, recarregar } = useCarregar(async () => {
    const podePublicar = pode("publicar_avisos");
    const [avisos, grupos, membros, ficheiros] = await Promise.all([
      api.listarAvisos(instituicaoId),
      podePublicar || pode("ver_todos_grupos") ? api.listarGrupos(instituicaoId, true) : Promise.resolve([]),
      podePublicar ? api.listarMembros(instituicaoId) : Promise.resolve([]),
      api.listarFicheiros(instituicaoId),
    ]);
    return { avisos, grupos, membros, ficheiros };
  }, [instituicaoId]);

  // Abre diretamente o aviso de um link (/instituicao/avisos#av-1).
  useEffect(() => {
    if (!dados || typeof window === "undefined" || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "center" });
  }, [dados]);

  const marcar = async (a: Aviso, confirmar: boolean) => {
    if (await acao(() => api.marcarAvisoLido(instituicaoId, a.id, confirmar), confirmar ? "Leitura confirmada." : undefined)) await recarregar();
  };

  if (aCarregar && !dados) return <Carregando />;
  if (!dados) return <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />;

  const lista = dados.avisos.filter((a) => {
    if (filtro === "por_ler") return !a.lidoPorMim && a.autorId !== eu;
    if (filtro === "confirmar") return a.pedirConfirmacao && !a.confirmadoPorMim && a.autorId !== eu;
    if (filtro === "meus") return a.autorId === eu;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Avisos</h2>
          <p className="text-sm text-muted-foreground">Mensagens da instituição para turmas, grupos ou pessoas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Seletor aria-label="Filtrar avisos" className="w-44" value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)}>
            <option value="todos">Todos</option>
            <option value="por_ler">Por ler</option>
            <option value="confirmar">Por confirmar</option>
            {pode("publicar_avisos") && <option value="meus">Os que publiquei</option>}
          </Seletor>
          <Button variant="outline" className="gap-1.5" onClick={() => setPrefs(true)}>
            <Settings2 className="h-4 w-4" /> Como sou avisado
          </Button>
          {pode("publicar_avisos") && (
            <Button className="gap-1.5" onClick={() => setNovo(true)}>
              <Plus className="h-4 w-4" /> Novo aviso
            </Button>
          )}
        </div>
      </div>

      {lista.length === 0 ? (
        <EmptyState icon={Megaphone} title="Sem avisos" description={filtro === "todos" ? "Ainda não há avisos para ti." : "Nada nesta lista."} />
      ) : (
        <div className="space-y-4">
          {lista.map((a) => (
            <CartaoAviso
              key={a.id}
              aviso={a}
              souAutor={a.autorId === eu || pode("gerir_membros")}
              destino={rotuloDestinatarios(a.destinatarios, dados.grupos, dados.membros)}
              anexos={dados.ficheiros.filter((f) => a.anexosIds.includes(f.id))}
              aoLer={() => void marcar(a, false)}
              aoConfirmar={() => void marcar(a, true)}
              recebido={a.autorId !== eu}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        No piloto os avisos são de sentido único (da instituição para as famílias). As conversas entre famílias e educadores
        ficam para uma fase seguinte, com regras de moderação.
      </p>

      {pode("publicar_avisos") && (
        <NovoAviso
          aberto={novo}
          aoFechar={() => setNovo(false)}
          aoPublicar={async () => {
            setNovo(false);
            await recarregar();
          }}
          grupos={dados.grupos.filter((g) => !g.arquivado)}
          membros={dados.membros.filter((m) => m.estado === "ativo" && m.id !== eu && m.papel !== "observador")}
          ficheiros={dados.ficheiros.filter((f) => f.estado === "disponivel")}
        />
      )}
      <Preferencias aberto={prefs} aoFechar={() => setPrefs(false)} />
    </div>
  );
}

function CartaoAviso({
  aviso: a,
  souAutor,
  destino,
  anexos,
  aoLer,
  aoConfirmar,
  recebido,
}: {
  aviso: Aviso;
  souAutor: boolean;
  destino: string;
  anexos: FicheiroInstituicao[];
  aoLer: () => void;
  aoConfirmar: () => void;
  recebido: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const novo = recebido && !a.lidoPorMim;

  return (
    <Card id={a.id} className={`scroll-mt-28 p-5 shadow-soft ${novo ? "border-primary/40" : ""}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-lg font-semibold">{a.titulo}</h3>
            {novo && <Etiqueta tom="marca">Novo</Etiqueta>}
            {a.pedirConfirmacao && <Etiqueta tom="aviso">Pede confirmação</Etiqueta>}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span>{a.autor}</span>
            <span aria-hidden>·</span>
            <span>{haQuanto(a.publicadoEm)}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden /> {destino}
            </span>
          </p>
        </div>
      </div>

      <p className={`mt-3 whitespace-pre-line text-sm ${aberto || !novo ? "" : "line-clamp-2"}`}>{a.mensagem}</p>

      {anexos.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {anexos.map((f) => (
            <li key={f.id}>
              <Link href={`/instituicao/ficheiros#${f.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs hover:bg-secondary/80">
                <Paperclip className="h-3 w-3" aria-hidden /> {f.nome}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {recebido && (
          <div className="flex gap-2">
            {novo && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  setAberto(true);
                  aoLer();
                }}
              >
                <Eye className="h-4 w-4" /> Marcar como lido
              </Button>
            )}
            {a.pedirConfirmacao &&
              (a.confirmadoPorMim ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                  <CheckCheck className="h-4 w-4" /> Confirmaste a leitura
                </span>
              ) : (
                <Button size="sm" className="gap-1.5" onClick={aoConfirmar}>
                  <CheckCheck className="h-4 w-4" /> Li e confirmo
                </Button>
              ))}
          </div>
        )}

        {souAutor && (
          <div className="w-full space-y-1.5 sm:w-72">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                <span className="font-semibold tabular-nums text-foreground">{a.lidos}</span> de {a.recebidos} leram
              </span>
              {a.pedirConfirmacao && (
                <span>
                  <span className="font-semibold tabular-nums text-foreground">{a.confirmados}</span> confirmaram
                </span>
              )}
            </div>
            <Barra valor={a.lidos} max={a.recebidos} rotulo={`${a.lidos} de ${a.recebidos} leram`} />
          </div>
        )}
      </div>
    </Card>
  );
}

function NovoAviso({
  aberto,
  aoFechar,
  aoPublicar,
  grupos,
  membros,
  ficheiros,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoPublicar: () => void;
  grupos: Grupo[];
  membros: Membro[];
  ficheiros: FicheiroInstituicao[];
}) {
  const { instituicaoId, pode } = useInstituicaoAtual();
  const podeInstituicao = pode("gerir_membros");
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [destino, setDestino] = useState<Destinatarios>(podeInstituicao ? { tipo: "instituicao" } : { tipo: "grupo", grupoId: grupos[0]?.id ?? "" });
  const [confirmar, setConfirmar] = useState(false);
  const [anexos, setAnexos] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setAEnviar(true);
    try {
      await api.publicarAviso(instituicaoId, { titulo, mensagem, destinatarios: destino, pedirConfirmacao: confirmar, anexosIds: anexos });
      setTitulo("");
      setMensagem("");
      setAnexos([]);
      setConfirmar(false);
      aoPublicar();
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
            <DialogTitle>Novo aviso</DialogTitle>
            <DialogDescription>Aparece na plataforma e, para quem escolheu, também por email.</DialogDescription>
          </div>
        </DialogHeader>
        <form onSubmit={submeter} className="flex min-h-0 flex-col">
          <div className="space-y-4 overflow-y-auto p-5">
            <Campo id="na-titulo" rotulo="Título">
              <Input id="na-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} required autoFocus />
            </Campo>
            <Campo id="na-msg" rotulo="Mensagem">
              <Textarea id="na-msg" rows={5} value={mensagem} onChange={(e) => setMensagem(e.target.value)} required />
            </Campo>
            <Campo id="na-dest" rotulo="Para quem">
              <EscolherDestinatarios id="na-dest" valor={destino} onChange={setDestino} grupos={grupos} membros={membros} podeInstituicao={podeInstituicao} />
            </Campo>
            {ficheiros.length > 0 && (
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">Anexar ficheiros da instituição</legend>
                <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                  {ficheiros.map((f) => (
                    <label key={f.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-surface">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--primary)]"
                        checked={anexos.includes(f.id)}
                        onChange={(e) => setAnexos((xs) => (e.target.checked ? [...xs, f.id] : xs.filter((x) => x !== f.id)))}
                      />
                      <span className="truncate">{f.nome}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Quem recebe o aviso só abre os ficheiros que pode ver.</p>
              </fieldset>
            )}
            <Caixa id="na-conf" checked={confirmar} onChange={setConfirmar} descricao="Para avisos importantes. Vês quantas pessoas confirmaram.">
              Pedir “li e confirmo”
            </Caixa>
            {erro && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
          </div>
          <DialogFooter className="flex justify-end gap-2 space-y-0">
            <Button type="button" variant="outline" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={aEnviar} className="gap-1.5">
              <Megaphone className="h-4 w-4" /> {aEnviar ? "A publicar…" : "Publicar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Preferencias({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const { instituicaoId } = useInstituicaoAtual();
  const [email, setEmail] = useState(false);
  const [disponiveis, setDisponiveis] = useState<string[]>([]);

  useEffect(() => {
    if (!aberto) return;
    void api.preferenciasAviso(instituicaoId).then((r) => {
      setEmail(r.preferencias.email);
      setDisponiveis(r.disponiveis);
    });
  }, [aberto, instituicaoId]);

  const guardar = async () => {
    if (await acao(() => api.guardarPreferenciasAviso(instituicaoId, { plataforma: true, email }), "Preferências guardadas.")) aoFechar();
  };

  const emailDisponivel = disponiveis.includes("email");

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <div>
            <DialogTitle>Como queres ser avisado</DialogTitle>
            <DialogDescription>Para os avisos e lembretes desta instituição.</DialogDescription>
          </div>
        </DialogHeader>
        <div className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                <BellRing className="h-4 w-4" aria-hidden /> Na plataforma
              </p>
              <p className="text-xs text-muted-foreground">Sempre ligado.</p>
            </div>
            <Switch checked disabled aria-label="Na plataforma" />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div>
              <label htmlFor="pref-email" className="text-sm font-medium">
                Por email
              </label>
              <p className="text-xs text-muted-foreground">
                {emailDisponivel ? "Recebe também uma cópia por email." : "A instituição não ativou os avisos por email."}
              </p>
            </div>
            <Switch id="pref-email" checked={email && emailDisponivel} disabled={!emailDisponivel} onCheckedChange={setEmail} />
          </div>
        </div>
        <DialogFooter className="flex justify-end gap-2 space-y-0">
          <Button variant="outline" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button onClick={() => void guardar()}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
