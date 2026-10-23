"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, FlaskConical, Globe, HardDrive, History, Plus, ShieldAlert, SlidersHorizontal, Users, X } from "lucide-react";
import { PageHeader, StatCard } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/components/auth-gate";
import { useConfirm } from "@/components/confirm-dialog";
import { acao, Barra, Campo, Carregando, celula, dataHora, ErroCarregar, erroTexto, Etiqueta, haQuanto, Seletor, Tabela, tamanho, useCarregar } from "@/components/instituicao/ui";
import { INSTITUICOES_ATIVAS } from "@/lib/instituicoes/ativo";
import { apiInstituicoes as api } from "@/lib/instituicoes/api";
import { apiLga } from "@/lib/instituicoes/lga";
import { ROTULO_ACAO, ROTULO_ESTADO_INSTITUICAO, ROTULO_TIPO_INSTITUICAO } from "@/lib/instituicoes/permissoes";
import type { EstadoInstituicao, Instituicao, RegistoAuditoria, TipoInstituicao } from "@/lib/instituicoes/tipos";

type Linha = Awaited<ReturnType<typeof api.eyk.listarInstituicoes>>[number];

const PROVINCIAS = [
  "Bengo", "Benguela", "Bié", "Cabinda", "Cuando", "Cubango", "Cuanza Norte", "Cuanza Sul", "Cunene", "Huambo", "Huíla",
  "Icolo e Bengo", "Luanda", "Lunda Norte", "Lunda Sul", "Malanje", "Moxico", "Moxico Leste", "Namibe", "Uíge", "Zaire",
];

export default function AdminInstituicoesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const confirmar = useConfirm();
  const [nova, setNova] = useState(false);
  const [quotasDe, setQuotasDe] = useState<Linha | null>(null);
  const [auditoriaDe, setAuditoriaDe] = useState<Linha | null>(null);

  useEffect(() => {
    if (!INSTITUICOES_ATIVAS || (user && !user.isStaff)) router.replace("/inicio");
  }, [user, router]);

  const { dados, erro, aCarregar, recarregar } = useCarregar(() => api.eyk.listarInstituicoes(), []);

  const mudarEstado = async (i: Linha, novo: EstadoInstituicao) => {
    const textos: Record<EstadoInstituicao, string> = {
      preparacao: "Volta a estar em preparação.",
      ativa: "Os membros passam a ter acesso.",
      suspensa: "O acesso fica bloqueado; os dados continuam guardados.",
      encerrada: "Fim da parceria: o acesso é bloqueado de vez. Antes de eliminar os dados, a instituição recebe uma exportação completa.",
    };
    const ok = await confirmar({
      title: `${i.nome}: ${ROTULO_ESTADO_INSTITUICAO[novo].toLowerCase()}?`,
      description: textos[novo],
      confirmLabel: "Confirmar",
      destructive: novo === "suspensa" || novo === "encerrada",
      requireText: novo === "encerrada" ? "ENCERRAR" : undefined,
    });
    if (!ok) return;
    if (await acao(() => api.eyk.mudarEstado(i.id, novo), "Estado alterado.")) await recarregar();
  };

  if (!INSTITUICOES_ATIVAS) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Escolas e instituições"
        description="Criar escolas, centros e organizações parceiras (o responsável recebe o convite de administrador), ativar, suspender, ajustar quotas e aprovar o que as escolas querem publicar na plataforma geral."
      >
        <Button className="gap-1.5" onClick={() => setNova(true)}>
          <Plus className="h-4 w-4" /> Nova instituição
        </Button>
      </PageHeader>

      <p className="flex items-start gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 text-sm text-muted-foreground">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        Demonstração com dados fictícios. Acesso restrito à equipa EYK; todas as ações ficam no registo de auditoria da
        instituição.
      </p>

      {aCarregar && !dados ? (
        <Carregando />
      ) : !dados ? (
        <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Building2} label="Instituições" value={dados.length} hint={`${dados.filter((i) => i.estado === "ativa").length} ativas`} tone="gold" />
            <StatCard icon={Users} label="Membros" value={dados.reduce((s, i) => s + i.membros, 0)} />
            <StatCard icon={HardDrive} label="Armazenamento" value={tamanho(dados.reduce((s, i) => s + i.usadoBytes, 0))} />
            <StatCard icon={ShieldAlert} label="Em preparação" value={dados.filter((i) => i.estado === "preparacao").length} hint="à espera do administrador" />
          </div>

          <Card className="p-5 shadow-soft">
            <Tabela cabecalho={["Instituição", "Estado", "Membros", "Armazenamento", "Última atividade", ""]}>
              {dados.map((i) => {
                const quota = i.quotas.armazenamentoMb * 1024 * 1024;
                return (
                  <tr key={i.id}>
                    <td className={celula}>
                      <p className="font-medium">{i.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {ROTULO_TIPO_INSTITUICAO[i.tipo]} · {i.provincia} · {i.responsavel.nome}
                      </p>
                    </td>
                    <td className={celula}>
                      {i.estado === "encerrada" ? (
                        <Etiqueta tom="perigo">Encerrada</Etiqueta>
                      ) : (
                        <Seletor
                          aria-label={`Estado de ${i.nome}`}
                          className="h-8 w-36 text-xs"
                          value={i.estado}
                          onChange={(e) => void mudarEstado(i, e.target.value as EstadoInstituicao)}
                        >
                          {(Object.keys(ROTULO_ESTADO_INSTITUICAO) as EstadoInstituicao[]).map((s) => (
                            <option key={s} value={s}>
                              {ROTULO_ESTADO_INSTITUICAO[s]}
                            </option>
                          ))}
                        </Seletor>
                      )}
                    </td>
                    <td className={`${celula} tabular-nums`}>
                      {i.membros}
                      <span className="text-xs text-muted-foreground"> / {i.quotas.utilizadoresMax}</span>
                    </td>
                    <td className={`${celula} w-44`}>
                      <p className="mb-1 text-xs tabular-nums text-muted-foreground">
                        {tamanho(i.usadoBytes)} de {tamanho(quota)}
                      </p>
                      <Barra valor={i.usadoBytes} max={quota} rotulo={`Armazenamento de ${i.nome}`} />
                    </td>
                    <td className={`${celula} whitespace-nowrap text-xs text-muted-foreground`}>{haQuanto(i.ultimaAtividade)}</td>
                    <td className={`${celula} whitespace-nowrap text-right`}>
                      <Button size="icon" variant="ghost" aria-label={`Quotas de ${i.nome}`} title="Quotas" onClick={() => setQuotasDe(i)}>
                        <SlidersHorizontal className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label={`Auditoria de ${i.nome}`} title="Auditoria" onClick={() => setAuditoriaDe(i)}>
                        <History className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </Tabela>
          </Card>
        </>
      )}

      <PropostasPlataformaGeral />

      <NovaInstituicao
        aberto={nova}
        aoFechar={() => setNova(false)}
        aoCriar={async () => {
          setNova(false);
          await recarregar();
        }}
      />
      <Quotas
        instituicao={quotasDe}
        aoFechar={() => setQuotasDe(null)}
        aoGuardar={async () => {
          setQuotasDe(null);
          await recarregar();
        }}
      />
      <AuditoriaEyk instituicao={auditoriaDe} aoFechar={() => setAuditoriaDe(null)} />
    </div>
  );
}

/** Cursos e vídeos que os professores das escolas quiseram publicar também na plataforma geral. */
function PropostasPlataformaGeral() {
  const { dados, recarregar } = useCarregar(() => apiLga.listarPropostasPublicas(), []);
  if (!dados || dados.length === 0) return null;
  const decidir = async (id: string, aceitar: boolean) => {
    if (await acao(() => apiLga.decidirPropostaPublica(id, aceitar), aceitar ? "Publicado na plataforma geral." : "Proposta recusada.")) await recarregar();
  };
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 font-serif text-xl font-semibold">
        <Globe className="h-5 w-5 text-primary" aria-hidden /> Propostas para a plataforma geral ({dados.length})
      </h2>
      <p className="text-sm text-muted-foreground">
        Conteúdos que os professores publicaram para a escola e querem partilhar com toda a EYK. Confirma a qualidade, a acessibilidade (legendas, LGA) e os direitos antes de aceitar.
      </p>
      <Card className="divide-y divide-border shadow-soft">
        {dados.map((c) => (
          <div key={c.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium">{c.titulo}</p>
              <p className="text-xs text-muted-foreground">
                {c.tipo === "curso" ? `Curso · ${c.aulas} lições` : "Vídeo"} · {c.duracaoMin} min · {c.autor} · {c.escola}
                {c.emLga ? " · em LGA" : ""}
                {c.temLegendas ? " · legendas PT" : " · sem legendas"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void decidir(c.id, false)}>
                <X className="h-4 w-4" /> Recusar
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => void decidir(c.id, true)}>
                <Check className="h-4 w-4" /> Aceitar
              </Button>
            </div>
          </div>
        ))}
      </Card>
    </section>
  );
}

function NovaInstituicao({ aberto, aoFechar, aoCriar }: { aberto: boolean; aoFechar: () => void; aoCriar: () => void }) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoInstituicao>("escola");
  const [provincia, setProvincia] = useState("Luanda");
  const [respNome, setRespNome] = useState("");
  const [respEmail, setRespEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await api.eyk.criarInstituicao({ nome, tipo, provincia, responsavelNome: respNome, responsavelEmail: respEmail });
      setNome("");
      setRespNome("");
      setRespEmail("");
      aoCriar();
    } catch (err) {
      setErro(erroTexto(err));
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <div>
            <DialogTitle>Nova instituição</DialogTitle>
            <DialogDescription>Depois de assinado o acordo de parceria. O responsável recebe um convite e fica administrador.</DialogDescription>
          </div>
        </DialogHeader>
        <form onSubmit={submeter} className="flex min-h-0 flex-col">
          <div className="space-y-4 overflow-y-auto p-5">
            <Campo id="ni-nome" rotulo="Nome">
              <Input id="ni-nome" value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="ni-tipo" rotulo="Tipo">
                <Seletor id="ni-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoInstituicao)}>
                  {(Object.keys(ROTULO_TIPO_INSTITUICAO) as TipoInstituicao[]).map((t) => (
                    <option key={t} value={t}>
                      {ROTULO_TIPO_INSTITUICAO[t]}
                    </option>
                  ))}
                </Seletor>
              </Campo>
              <Campo id="ni-prov" rotulo="Província">
                <Seletor id="ni-prov" value={provincia} onChange={(e) => setProvincia(e.target.value)}>
                  {PROVINCIAS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </Seletor>
              </Campo>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="ni-rn" rotulo="Responsável">
                <Input id="ni-rn" value={respNome} onChange={(e) => setRespNome(e.target.value)} required />
              </Campo>
              <Campo id="ni-re" rotulo="Email do responsável">
                <Input id="ni-re" type="email" value={respEmail} onChange={(e) => setRespEmail(e.target.value)} required />
              </Campo>
            </div>
            {erro && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
          </div>
          <DialogFooter className="flex justify-end gap-2 space-y-0">
            <Button type="button" variant="outline" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit">Criar e enviar convite</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Quotas({ instituicao, aoFechar, aoGuardar }: { instituicao: Instituicao | null; aoFechar: () => void; aoGuardar: () => void }) {
  const [q, setQ] = useState<Instituicao["quotas"] | null>(null);
  useEffect(() => setQ(instituicao?.quotas ?? null), [instituicao]);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!instituicao || !q) return;
    if (await acao(() => api.eyk.ajustarQuotas(instituicao.id, q), "Quotas atualizadas.")) aoGuardar();
  };

  return (
    <Dialog open={!!instituicao} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <div>
            <DialogTitle>Quotas · {instituicao?.nome}</DialogTitle>
            <DialogDescription>No limite, só a criação de novos itens é bloqueada — nunca o acesso ao que já existe.</DialogDescription>
          </div>
        </DialogHeader>
        {q && (
          <form onSubmit={guardar} className="flex min-h-0 flex-col">
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              <Campo id="q-arm" rotulo="Armazenamento (MB)">
                <Input id="q-arm" type="number" min={1} value={q.armazenamentoMb} onChange={(e) => setQ({ ...q, armazenamentoMb: Number(e.target.value) })} />
              </Campo>
              <Campo id="q-fich" rotulo="Por ficheiro (MB)">
                <Input id="q-fich" type="number" min={1} value={q.ficheiroMaxMb} onChange={(e) => setQ({ ...q, ficheiroMaxMb: Number(e.target.value) })} />
              </Campo>
              <Campo id="q-util" rotulo="Utilizadores">
                <Input id="q-util" type="number" min={1} value={q.utilizadoresMax} onChange={(e) => setQ({ ...q, utilizadoresMax: Number(e.target.value) })} />
              </Campo>
            </div>
            <DialogFooter className="flex justify-end gap-2 space-y-0">
              <Button type="button" variant="outline" onClick={aoFechar}>
                Cancelar
              </Button>
              <Button type="submit">Guardar</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AuditoriaEyk({ instituicao, aoFechar }: { instituicao: Instituicao | null; aoFechar: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [registos, setRegistos] = useState<RegistoAuditoria[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const fechar = () => {
    setMotivo("");
    setRegistos(null);
    setErro(null);
    aoFechar();
  };

  const abrir = async (e: FormEvent) => {
    e.preventDefault();
    if (!instituicao) return;
    setErro(null);
    try {
      setRegistos(await api.eyk.consultarAuditoria(instituicao.id, motivo));
    } catch (err) {
      setErro(erroTexto(err));
    }
  };

  return (
    <Dialog open={!!instituicao} onOpenChange={(v) => !v && fechar()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div>
            <DialogTitle>Auditoria · {instituicao?.nome}</DialogTitle>
            <DialogDescription>O acesso da equipa EYK fica registado e visível à instituição.</DialogDescription>
          </div>
        </DialogHeader>
        {!registos ? (
          <form onSubmit={abrir} className="space-y-4 p-5">
            <Campo id="au-motivo" rotulo="Motivo do acesso" ajuda="ex: pedido de apoio n.º 21, investigação de uma denúncia">
              <Input id="au-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} required autoFocus />
            </Campo>
            {erro && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={fechar}>
                Cancelar
              </Button>
              <Button type="submit">Registar acesso e abrir</Button>
            </div>
          </form>
        ) : (
          <div className="overflow-y-auto p-5">
            <ul className="divide-y divide-border">
              {registos.map((r) => (
                <li key={r.id} className="py-2.5 text-sm">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{ROTULO_ACAO[r.acao]}</span>
                    {r.origem === "equipa_eyk" && <Etiqueta tom="aviso">Equipa EYK</Etiqueta>}
                    <span className="text-xs text-muted-foreground">
                      {dataHora(r.quando)} · {r.quem}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">{r.detalhe}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
