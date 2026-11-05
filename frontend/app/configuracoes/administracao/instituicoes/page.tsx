"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Check, Copy, Eye, Globe, Mail, Plus, Send, ShieldAlert, SlidersHorizontal, Users, X } from "lucide-react";
import { PageHeader, StatCard } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/components/auth-gate";
import { useConfirm } from "@/components/confirm-dialog";
import { acao, Campo, Carregando, celula, ErroCarregar, erroTexto, Etiqueta, Seletor, Tabela, useCarregar } from "@/components/instituicao/ui";
import { INSTITUICOES_ATIVAS } from "@/lib/instituicoes/ativo";
import { apiLga } from "@/lib/instituicoes/lga";
import { ROTULO_ESTADO_INSTITUICAO, ROTULO_TIPO_INSTITUICAO } from "@/lib/instituicoes/permissoes";
import { apiEscolasServidor as api, type ConviteResumo, type LinhaInstituicao as Linha } from "@/lib/instituicoes/servidor";
import type { EstadoInstituicao, Instituicao, TipoInstituicao } from "@/lib/instituicoes/tipos";

const ROTULO_CONVITE: Record<ConviteResumo["estado"], string> = {
  pendente: "Convite por aceitar",
  aceite: "Convite aceite",
  expirado: "Convite expirado",
  cancelado: "Convite cancelado",
};

/** Resultado de criar uma escola ou reenviar o convite. */
type ConviteEnviado = { escola: string; email: string; link: string | null; emailEnviado: boolean };

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
  const [enviado, setEnviado] = useState<ConviteEnviado | null>(null);

  useEffect(() => {
    if (!INSTITUICOES_ATIVAS || (user && !user.isStaff)) router.replace("/inicio");
  }, [user, router]);

  const { dados, erro, aCarregar, recarregar } = useCarregar(() => api.listar(), []);

  const aposEnviar = (i: Linha & { emailEnviado: boolean }) =>
    setEnviado({ escola: i.nome, email: i.responsavel.email, link: i.convite?.link ?? null, emailEnviado: i.emailEnviado });

  const reenviar = async (i: Linha) => {
    await acao(async () => {
      aposEnviar(await api.reenviarConvite(i.id));
      await recarregar();
    });
  };

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
    if (await acao(() => api.mudarEstado(i.id, novo), "Estado alterado.")) await recarregar();
  };

  if (!INSTITUICOES_ATIVAS) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Escolas e instituições"
        description="Criar escolas, centros e organizações parceiras (com o convite de administrador para o responsável), ativar, suspender, ajustar quotas e aprovar o que as escolas querem publicar na plataforma geral."
      >
        <Button asChild variant="outline" className="gap-1.5">
          {/* A equipa EYK não pertence a escolas: vê o espaço de uma escola só em pré-visualização. */}
          <Link href="/instituicao">
            <Eye className="h-4 w-4" /> Pré-visualizar o espaço de uma escola
          </Link>
        </Button>
        <Button className="gap-1.5" onClick={() => setNova(true)}>
          <Plus className="h-4 w-4" /> Nova instituição
        </Button>
      </PageHeader>

      {aCarregar && !dados ? (
        <Carregando />
      ) : !dados ? (
        <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Building2} label="Instituições" value={dados.length} hint={`${dados.filter((i) => i.estado === "ativa").length} ativas`} tone="gold" />
            <StatCard icon={Users} label="Membros" value={dados.reduce((s, i) => s + i.membros, 0)} />
            <StatCard icon={ShieldAlert} label="Em preparação" value={dados.filter((i) => i.estado === "preparacao").length} hint="à espera do administrador" />
            <StatCard icon={Mail} label="Convites por aceitar" value={dados.filter((i) => i.convite?.estado === "pendente").length} />
          </div>

          <Card className="p-5 shadow-soft">
            <Tabela cabecalho={["Instituição", "Estado", "Membros", "Responsável", ""]}>
              {dados.map((i) => {
                const semResposta = i.convite?.estado === "pendente" || i.convite?.estado === "expirado";
                return (
                  <tr key={i.id}>
                    <td className={celula}>
                      <p className="font-medium">{i.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {ROTULO_TIPO_INSTITUICAO[i.tipo]} · {i.provincia}
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
                    <td className={celula}>
                      <p>{i.responsavel.nome}</p>
                      <p className="text-xs text-muted-foreground">{i.responsavel.email}</p>
                      {i.convite && <p className="text-xs text-muted-foreground">{ROTULO_CONVITE[i.convite.estado]}</p>}
                    </td>
                    <td className={`${celula} whitespace-nowrap text-right`}>
                      {semResposta && (
                        <Button size="icon" variant="ghost" aria-label={`Reenviar o convite de ${i.nome}`} title="Reenviar o convite" onClick={() => void reenviar(i)}>
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" aria-label={`Quotas de ${i.nome}`} title="Quotas" onClick={() => setQuotasDe(i)}>
                        <SlidersHorizontal className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </Tabela>
            {dados.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">Ainda não há instituições. Cria a primeira em &quot;Nova instituição&quot;.</p>
            )}
          </Card>
        </>
      )}

      <PropostasPlataformaGeral />

      <NovaInstituicao
        aberto={nova}
        aoFechar={() => setNova(false)}
        aoCriar={async (criada) => {
          setNova(false);
          aposEnviar(criada);
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
      <ConviteDaEscola enviado={enviado} aoFechar={() => setEnviado(null)} />
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

/** Confirma o envio; se o email não saiu (ou em desenvolvimento), dá o link para o passar à mão. */
function ConviteDaEscola({ enviado, aoFechar }: { enviado: ConviteEnviado | null; aoFechar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    if (!enviado?.link) return;
    await navigator.clipboard?.writeText(enviado.link);
    setCopiado(true);
  };
  return (
    <Dialog
      open={!!enviado}
      onOpenChange={(v) => {
        if (!v) {
          setCopiado(false);
          aoFechar();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <div>
            <DialogTitle>{enviado?.emailEnviado ? "Convite enviado" : "Convite criado"}</DialogTitle>
            <DialogDescription>{enviado?.escola}</DialogDescription>
          </div>
        </DialogHeader>
        <div className="space-y-3 p-5 text-sm">
          {enviado?.emailEnviado ? (
            <p>O convite de administrador seguiu para {enviado.email}.</p>
          ) : (
            <p className="rounded-md bg-primary/10 p-3">
              O email não chegou a sair para {enviado?.email}. Passa este link ao responsável, que tem de entrar com esse email.
            </p>
          )}
          {enviado?.link && (
            <div className="flex items-center gap-2">
              <Input readOnly value={enviado.link} aria-label="Link do convite" className="text-xs" />
              <Button type="button" variant="outline" className="shrink-0 gap-1.5" onClick={() => void copiar()}>
                {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiado ? "Copiado" : "Copiar"}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Válido 14 dias. Quando o responsável aceitar, a escola fica ativa.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NovaInstituicao({
  aberto,
  aoFechar,
  aoCriar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoCriar: (criada: Linha & { emailEnviado: boolean }) => void;
}) {
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
      const criada = await api.criar({ nome, tipo, provincia, responsavelNome: respNome, responsavelEmail: respEmail });
      setNome("");
      setRespNome("");
      setRespEmail("");
      aoCriar(criada);
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
            <DialogDescription>Depois de assinado o acordo de parceria. O responsável recebe um convite por email e fica administrador ao aceitar.</DialogDescription>
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
    if (await acao(() => api.ajustarQuotas(instituicao.id, q), "Quotas atualizadas.")) aoGuardar();
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
