"use client";

import { useState, type FormEvent } from "react";
import { Check, Copy, Mail, MessageSquare, Plus, QrCode, Ticket, UserCheck, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirm } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/eyk";
import { Exige, useInstituicaoAtual } from "@/components/instituicao/contexto";
import {
  acao,
  Campo,
  Carregando,
  celula,
  dataCurta,
  ErroCarregar,
  erroTexto,
  Etiqueta,
  EtiquetaPapel,
  haQuanto,
  Seletor,
  Tabela,
  useCarregar,
} from "@/components/instituicao/ui";
import { apiInstituicoes as api, VALIDADE_CONVITE_DIAS } from "@/lib/instituicoes/api";
import { ROTULO_PAPEL } from "@/lib/instituicoes/permissoes";
import type { CanalConvite, Convite, Papel } from "@/lib/instituicoes/tipos";

const ICONE_CANAL = { email: Mail, sms: MessageSquare, codigo: QrCode } as const;
const ROTULO_CANAL: Record<CanalConvite, string> = { email: "Email", sms: "SMS", codigo: "Código partilhável" };

function EstadoConvite({ c }: { c: Convite }) {
  if (c.estado === "pendente" && c.usos >= c.usosMax) return <Etiqueta tom="neutro">Esgotado</Etiqueta>;
  const mapa = {
    pendente: <Etiqueta tom="sucesso">Ativo</Etiqueta>,
    aceite: <Etiqueta tom="marca">Aceite</Etiqueta>,
    expirado: <Etiqueta tom="neutro">Expirado</Etiqueta>,
    cancelado: <Etiqueta tom="perigo">Cancelado</Etiqueta>,
  };
  return mapa[c.estado];
}

export default function ConvitesPage() {
  const { instituicaoId, pode, atual } = useInstituicaoAtual();
  const confirmar = useConfirm();
  const [novoAberto, setNovoAberto] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [mostrarInativos, setMostrarInativos] = useState(false);

  const { dados, erro, aCarregar, recarregar } = useCarregar(async () => {
    const [convites, pedidos, grupos, alunos] = await Promise.all([
      api.listarConvites(instituicaoId),
      pode("aprovar_pedidos") ? api.listarPedidosAdesao(instituicaoId) : Promise.resolve([]),
      api.listarGrupos(instituicaoId),
      api.listarAlunos(instituicaoId),
    ]);
    return { convites, pedidos, grupos, alunos };
  }, [instituicaoId]);

  const copiar = async (codigo: string) => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(codigo);
      setTimeout(() => setCopiado(null), 1500);
    } catch {
      /* sem acesso à área de transferência: o código está visível */
    }
  };

  const cancelar = async (c: Convite) => {
    if (!(await confirmar({ title: `Cancelar o convite ${c.codigo}?`, description: "Quem ainda não o usou deixa de poder aderir com ele.", confirmLabel: "Cancelar convite", destructive: true }))) return;
    if (await acao(() => api.cancelarConvite(instituicaoId, c.id), "Convite cancelado.")) await recarregar();
  };

  const decidir = async (pedidoId: string, aprovar: boolean) => {
    if (await acao(() => api.decidirPedido(instituicaoId, pedidoId, aprovar), aprovar ? "Pedido aprovado." : "Pedido rejeitado.")) await recarregar();
  };

  if (aCarregar && !dados) return <Carregando />;
  if (!dados) return <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />;

  const ativos = dados.convites.filter((c) => c.estado === "pendente" && c.usos < c.usosMax);
  const lista = mostrarInativos ? dados.convites : ativos;
  const pendentes = dados.pedidos.filter((p) => p.estado === "pendente");

  return (
    <Exige permitido={pode("convidar")}>
      <div className="space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-2xl font-semibold">Convites e códigos</h2>
            <p className="text-sm text-muted-foreground">
              Convida por email ou SMS, ou cria um código curto para partilhar em papel ou por mensagem. Os convites
              expiram ao fim de {VALIDADE_CONVITE_DIAS} dias.
            </p>
          </div>
          <Button className="gap-1.5" onClick={() => setNovoAberto(true)}>
            <Plus className="h-4 w-4" /> Novo convite
          </Button>
        </div>

        {pode("aprovar_pedidos") && (
          <section id="pedidos" className="scroll-mt-24 space-y-3">
            <h3 className="flex items-center gap-2 font-serif text-lg font-semibold">
              <UserCheck className="h-5 w-5 text-primary" aria-hidden /> Pedidos de adesão
              {pendentes.length > 0 && <Etiqueta tom="marca">{pendentes.length}</Etiqueta>}
            </h3>
            <p className="text-sm text-muted-foreground">
              {atual.instituicao.aprovarPedidosPorCodigo
                ? "Quem adere com um código só ganha acesso depois de aprovado."
                : "A aprovação de pedidos por código está desligada nas definições: quem usa um código entra logo."}
            </p>
            {pendentes.length === 0 ? (
              <p className="rounded-xl bg-surface/60 p-4 text-sm text-muted-foreground">Sem pedidos à espera.</p>
            ) : (
              <Card className="divide-y divide-border shadow-soft">
                {pendentes.map((p) => (
                  <div key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.email} · quer entrar como {ROTULO_PAPEL[p.papel]}
                        {p.grupoId ? ` em ${dados.grupos.find((g) => g.id === p.grupoId)?.nome ?? "um grupo"}` : ""} · {haQuanto(p.pedidoEm)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void decidir(p.id, false)}>
                        <X className="h-4 w-4" /> Rejeitar
                      </Button>
                      <Button size="sm" className="gap-1.5" onClick={() => void decidir(p.id, true)}>
                        <Check className="h-4 w-4" /> Aprovar
                      </Button>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-serif text-lg font-semibold">{mostrarInativos ? "Todos os convites" : "Convites ativos"}</h3>
            <Button variant="ghost" size="sm" onClick={() => setMostrarInativos((v) => !v)}>
              {mostrarInativos ? "Só os ativos" : "Ver também expirados e cancelados"}
            </Button>
          </div>
          {lista.length === 0 ? (
            <EmptyState icon={Ticket} title="Sem convites ativos" description="Cria um convite para trazer educadores, famílias e alunos." />
          ) : (
            <Card className="p-5 shadow-soft">
              <Tabela cabecalho={["Código", "Para", "Papel e destino", "Usos", "Validade", ""]}>
                {lista.map((c) => {
                  const Icone = ICONE_CANAL[c.canal];
                  const aluno = c.alunoId ? dados.alunos.find((a) => a.id === c.alunoId) : null;
                  return (
                    <tr key={c.id}>
                      <td className={celula}>
                        <button
                          type="button"
                          onClick={() => void copiar(c.codigo)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-background px-2 py-1 font-mono text-sm font-semibold tracking-widest ring-1 ring-border hover:ring-primary"
                          title="Copiar código"
                        >
                          {c.codigo}
                          {copiado === c.codigo ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                        </button>
                      </td>
                      <td className={celula}>
                        <span className="flex items-center gap-1.5 text-xs">
                          <Icone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                          {c.destino || ROTULO_CANAL[c.canal]}
                        </span>
                        <span className="text-xs text-muted-foreground">por {c.criadoPor}</span>
                      </td>
                      <td className={celula}>
                        <EtiquetaPapel papel={c.papel} />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {c.grupoId ? dados.grupos.find((g) => g.id === c.grupoId)?.nome ?? "Grupo" : "Sem grupo"}
                          {aluno ? ` · tutor de ${aluno.nome}` : ""}
                        </p>
                      </td>
                      <td className={`${celula} tabular-nums`}>
                        {c.usos}/{c.usosMax}
                      </td>
                      <td className={`${celula} whitespace-nowrap text-xs`}>
                        <EstadoConvite c={c} />
                        <p className="mt-1 text-muted-foreground">
                          {c.estado === "pendente" ? `expira ${haQuanto(c.expiraEm)}` : `até ${dataCurta(c.expiraEm)}`}
                        </p>
                      </td>
                      <td className={`${celula} text-right`}>
                        {c.estado === "pendente" && (
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => void cancelar(c)}>
                            Cancelar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Tabela>
            </Card>
          )}
          <p className="text-xs text-muted-foreground">
            Quem recebe um código abre <span className="font-medium text-foreground">Instituição → Tenho um código</span> no EYK,
            ou o endereço <span className="font-mono">/instituicao/aderir</span>.
          </p>
        </section>

        <NovoConvite
          aberto={novoAberto}
          aoFechar={() => setNovoAberto(false)}
          aoCriar={async () => {
            setNovoAberto(false);
            await recarregar();
          }}
          grupos={dados.grupos}
          alunos={dados.alunos}
        />
      </div>
    </Exige>
  );
}

function NovoConvite({
  aberto,
  aoFechar,
  aoCriar,
  grupos,
  alunos,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoCriar: () => void;
  grupos: { id: string; nome: string }[];
  alunos: { id: string; nome: string; grupoId: string | null; estado: string }[];
}) {
  const { instituicaoId, pode } = useInstituicaoAtual();
  const podeTodos = pode("gerir_membros");
  const papeisPossiveis: Papel[] = podeTodos
    ? ["familia", "aluno", "educador", "formador", "coordenador", "administrador", "observador"]
    : ["familia", "aluno"];
  const [canal, setCanal] = useState<CanalConvite>("codigo");
  const [destino, setDestino] = useState("");
  const [papel, setPapel] = useState<Papel>("familia");
  const [grupoId, setGrupoId] = useState<string>(grupos[0]?.id ?? "");
  const [alunoId, setAlunoId] = useState("");
  const [usosMax, setUsosMax] = useState(30);
  const [validade, setValidade] = useState(VALIDADE_CONVITE_DIAS);
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);
  const [criado, setCriado] = useState<Convite | null>(null);

  const alunosDoGrupo = alunos.filter((a) => !grupoId || a.grupoId === grupoId);

  const fechar = () => {
    setCriado(null);
    setErro(null);
    setDestino("");
    aoFechar();
  };

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setAEnviar(true);
    try {
      const c = await api.criarConvite(instituicaoId, {
        canal,
        destino,
        papel,
        grupoId: grupoId || null,
        alunoId: papel === "familia" && alunoId ? alunoId : null,
        usosMax,
        validadeDias: validade,
      });
      setCriado(c);
    } catch (err) {
      setErro(erroTexto(err));
    } finally {
      setAEnviar(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && (criado ? (setCriado(null), aoCriar()) : fechar())}>
      <DialogContent>
        <DialogHeader>
          <div>
            <DialogTitle>{criado ? "Convite criado" : "Novo convite"}</DialogTitle>
            <DialogDescription>
              {criado ? "Partilha este código com a pessoa." : "Escolhe o papel e o grupo de destino."}
            </DialogDescription>
          </div>
        </DialogHeader>

        {criado ? (
          <div className="space-y-4 p-5 text-center">
            <p className="font-mono text-4xl font-bold tracking-[0.3em] text-primary">{criado.codigo}</p>
            <p className="text-sm text-muted-foreground">
              {criado.canal === "email"
                ? `Enviámos o convite para ${criado.destino}.`
                : criado.canal === "sms"
                  ? `Enviámos o código por SMS para ${criado.destino}.`
                  : `Pode ser usado ${criado.usosMax} vez${criado.usosMax === 1 ? "" : "es"}.`}{" "}
              Expira {haQuanto(criado.expiraEm)}.
            </p>
            <Button
              className="w-full"
              onClick={() => {
                setCriado(null);
                aoCriar();
              }}
            >
              Concluir
            </Button>
          </div>
        ) : (
          <form onSubmit={submeter} className="flex min-h-0 flex-col">
            <div className="space-y-4 overflow-y-auto p-5">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Como enviar</legend>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(ROTULO_CANAL) as CanalConvite[]).map((k) => {
                    const Icone = ICONE_CANAL[k];
                    return (
                      <label
                        key={k}
                        className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-3 text-center text-xs ${canal === k ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
                      >
                        <input type="radio" name="canal" value={k} checked={canal === k} onChange={() => setCanal(k)} className="sr-only" />
                        <Icone className="h-5 w-5" aria-hidden />
                        {ROTULO_CANAL[k]}
                      </label>
                    );
                  })}
                </div>
                {canal === "sms" && (
                  <p className="text-xs text-muted-foreground">Útil para famílias que não usam email regularmente.</p>
                )}
              </fieldset>

              {canal !== "codigo" && (
                <Campo id="cv-destino" rotulo={canal === "email" ? "Email" : "Telemóvel"}>
                  <Input
                    id="cv-destino"
                    type={canal === "email" ? "email" : "tel"}
                    placeholder={canal === "email" ? "nome@exemplo.ao" : "+244 9XX XXX XXX"}
                    value={destino}
                    onChange={(e) => setDestino(e.target.value)}
                    required
                  />
                </Campo>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Campo id="cv-papel" rotulo="Papel">
                  <Seletor id="cv-papel" value={papel} onChange={(e) => setPapel(e.target.value as Papel)}>
                    {papeisPossiveis.map((p) => (
                      <option key={p} value={p}>
                        {ROTULO_PAPEL[p]}
                      </option>
                    ))}
                  </Seletor>
                </Campo>
                <Campo id="cv-grupo" rotulo="Grupo de destino">
                  <Seletor id="cv-grupo" value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
                    {podeTodos && <option value="">Nenhum</option>}
                    {grupos.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nome}
                      </option>
                    ))}
                  </Seletor>
                </Campo>
              </div>

              {papel === "familia" && (
                <Campo
                  id="cv-aluno"
                  rotulo="Ligar a uma criança (opcional)"
                  ajuda="O tutor fica a ver apenas o que diz respeito a esta criança e dá o consentimento ao aderir."
                >
                  <Seletor id="cv-aluno" value={alunoId} onChange={(e) => setAlunoId(e.target.value)}>
                    <option value="">Sem criança associada</option>
                    {alunosDoGrupo.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome}
                        {a.estado === "aguarda_consentimento" ? " (à espera de consentimento)" : ""}
                      </option>
                    ))}
                  </Seletor>
                </Campo>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {canal === "codigo" && (
                  <Campo id="cv-usos" rotulo="Utilizações máximas">
                    <Input id="cv-usos" type="number" min={1} max={500} value={usosMax} onChange={(e) => setUsosMax(Number(e.target.value))} />
                  </Campo>
                )}
                <Campo id="cv-validade" rotulo="Validade (dias)">
                  <Input id="cv-validade" type="number" min={1} max={60} value={validade} onChange={(e) => setValidade(Number(e.target.value))} />
                </Campo>
              </div>

              {erro && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
            </div>
            <DialogFooter className="flex justify-end gap-2 space-y-0">
              <Button type="button" variant="outline" onClick={fechar}>
                Cancelar
              </Button>
              <Button type="submit" disabled={aEnviar}>
                {aEnviar ? "A criar…" : "Criar convite"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
