"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Baby, Info, Link2Off, Plus, Send, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/eyk";
import { useConfirm } from "@/components/confirm-dialog";
import { Exige, useInstituicaoAtual } from "@/components/instituicao/contexto";
import { acao, Campo, Carregando, celula, ErroCarregar, erroTexto, Etiqueta, haQuanto, LinkConvite, Seletor, Tabela, useCarregar } from "@/components/instituicao/ui";
import { apiInstituicoes as api, consentimentosAtuais } from "@/lib/instituicoes/api";
import type { CanalConvite, Convite, Grupo, PerfilAluno } from "@/lib/instituicoes/tipos";

function EstadoPerfil({ a }: { a: PerfilAluno }) {
  if (a.estado === "ativo") return <Etiqueta tom="sucesso">Ativo</Etiqueta>;
  if (a.estado === "aguarda_consentimento") return <Etiqueta tom="aviso">À espera de consentimento</Etiqueta>;
  return <Etiqueta tom="neutro">Consentimento retirado</Etiqueta>;
}

export default function AlunosPage() {
  const { instituicaoId, papel, pode } = useInstituicaoAtual();
  const confirmar = useConfirm();
  const [novo, setNovo] = useState(false);
  const [convidarPara, setConvidarPara] = useState<PerfilAluno | null>(null);
  const [filtroGrupo, setFiltroGrupo] = useState("");

  const { dados, erro, aCarregar, recarregar } = useCarregar(async () => {
    const [alunos, grupos, membros, consentimentos] = await Promise.all([
      api.listarAlunos(instituicaoId),
      api.listarGrupos(instituicaoId, true),
      papel === "familia" ? Promise.resolve([]) : api.listarMembros(instituicaoId),
      api.listarConsentimentos(instituicaoId).catch(() => []),
    ]);
    return { alunos, grupos, membros, consentimentos };
  }, [instituicaoId, papel]);

  const atuais = useMemo(() => consentimentosAtuais(dados?.consentimentos ?? []), [dados]);
  const permitido = pode("gerir_alunos") || papel === "familia" || pode("ver_todos_grupos");

  const desfazer = async (aluno: PerfilAluno, tutorId: string, tutorNome: string) => {
    const ok = await confirmar({
      title: `${tutorNome} deixa de ser tutor de ${aluno.nome}?`,
      description: "Perde o acesso ao perfil, aos avisos e aos ficheiros desta criança. Fica registado na auditoria.",
      confirmLabel: "Desfazer vínculo",
      destructive: true,
    });
    if (!ok) return;
    if (await acao(() => api.removerVinculo(instituicaoId, aluno.id, tutorId), "Vínculo desfeito.")) await recarregar();
  };

  if (aCarregar && !dados) return <Carregando />;
  if (!dados) return <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />;

  const nomeGrupo = (id: string | null) => dados.grupos.find((g) => g.id === id)?.nome ?? "—";

  // ── Vista da família ──
  if (papel === "familia") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-serif text-2xl font-semibold">As minhas crianças</h2>
          <p className="text-sm text-muted-foreground">Vês apenas o que diz respeito às crianças de quem és tutor.</p>
        </div>
        {dados.alunos.length === 0 ? (
          <EmptyState icon={Baby} title="Sem crianças associadas" description="Quando a escola te enviar um convite ligado à tua criança, ela aparece aqui." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {dados.alunos.map((a) => {
              const c = atuais[a.id] ?? {};
              return (
                <Card key={a.id} className="space-y-3 p-5 shadow-soft">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-serif text-lg font-semibold">{a.nome}</p>
                      <p className="text-xs text-muted-foreground">{nomeGrupo(a.grupoId)}</p>
                    </div>
                    <EstadoPerfil a={a} />
                  </div>
                  <ul className="space-y-1 text-sm">
                    <li>Utilização da plataforma: {c.utilizacao?.aceite ? "sim" : "não"}</li>
                    <li>Fotografias na turma: {c.fotografias?.aceite ? "sim" : "não"}</li>
                    <li>Relatórios agregados: {c.relatorios?.aceite ? "sim" : "não"}</li>
                  </ul>
                  <Button asChild variant="outline" size="sm" className="gap-1.5">
                    <Link href="/instituicao/consentimentos">
                      <ShieldCheck className="h-4 w-4" /> Rever consentimentos
                    </Link>
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const lista = dados.alunos.filter((a) => !filtroGrupo || a.grupoId === filtroGrupo);

  return (
    <Exige permitido={permitido}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-2xl font-semibold">Alunos e tutores</h2>
            <p className="text-sm text-muted-foreground">Cada família vê apenas o que diz respeito à sua criança.</p>
          </div>
          <div className="flex gap-2">
            <Seletor aria-label="Filtrar por grupo" className="w-48" value={filtroGrupo} onChange={(e) => setFiltroGrupo(e.target.value)}>
              <option value="">Todos os grupos</option>
              {dados.grupos.filter((g) => !g.arquivado).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </Seletor>
            {pode("gerir_alunos") && (
              <Button className="gap-1.5" onClick={() => setNovo(true)}>
                <Plus className="h-4 w-4" /> Novo perfil
              </Button>
            )}
          </div>
        </div>

        {lista.length === 0 ? (
          <EmptyState icon={Baby} title="Sem perfis de crianças" description="Cria um perfil e convida o tutor para dar o consentimento." />
        ) : (
          <Card className="p-5 shadow-soft">
            <Tabela cabecalho={["Criança", "Grupo", "Estado", "Tutores", ""]}>
              {lista.map((a) => (
                <tr key={a.id}>
                  <td className={celula}>
                    <p className="font-medium">{a.nome}</p>
                    <p className="text-xs text-muted-foreground">perfil criado {haQuanto(a.criadoEm)}</p>
                  </td>
                  <td className={`${celula} text-xs`}>{nomeGrupo(a.grupoId)}</td>
                  <td className={celula}>
                    <EstadoPerfil a={a} />
                  </td>
                  <td className={celula}>
                    {a.tutoresIds.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Nenhum</span>
                    ) : (
                      <ul className="space-y-1">
                        {a.tutoresIds.map((t) => {
                          const tutor = dados.membros.find((m) => m.id === t);
                          const nome = tutor?.nome ?? "Tutor";
                          return (
                            <li key={t} className="flex items-center gap-1 text-xs">
                              {nome}
                              {pode("gerir_membros") && (
                                <button
                                  type="button"
                                  onClick={() => void desfazer(a, t, nome)}
                                  className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                                  aria-label={`Desfazer vínculo de ${nome}`}
                                  title="Desfazer vínculo"
                                >
                                  <Link2Off className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </td>
                  <td className={`${celula} text-right`}>
                    {pode("convidar") && a.estado !== "consentimento_retirado" && (
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setConvidarPara(a)}>
                        <Send className="h-3.5 w-3.5" /> Convidar tutor
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </Tabela>
          </Card>
        )}

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          O perfil só fica ativo quando um tutor aceita o consentimento de utilização. Não registamos informação clínica nem
          de diagnóstico.
        </p>

        <NovoPerfil
          aberto={novo}
          grupos={dados.grupos.filter((g) => !g.arquivado)}
          aoFechar={() => setNovo(false)}
          aoCriar={async (aluno) => {
            setNovo(false);
            await recarregar();
            setConvidarPara(aluno);
          }}
        />
        <ConvidarTutor aluno={convidarPara} aoFechar={() => setConvidarPara(null)} />
      </div>
    </Exige>
  );
}

function NovoPerfil({
  aberto,
  grupos,
  aoFechar,
  aoCriar,
}: {
  aberto: boolean;
  grupos: Grupo[];
  aoFechar: () => void;
  aoCriar: (a: PerfilAluno) => void;
}) {
  const { instituicaoId } = useInstituicaoAtual();
  const [nome, setNome] = useState("");
  const [grupoId, setGrupoId] = useState(grupos[0]?.id ?? "");
  const [erro, setErro] = useState<string | null>(null);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      const a = await api.criarAluno(instituicaoId, { nome, grupoId: grupoId || null });
      setNome("");
      aoCriar(a);
    } catch (err) {
      setErro(erroTexto(err));
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <div>
            <DialogTitle>Novo perfil de criança</DialogTitle>
            <DialogDescription>Só o mínimo: nome ou alcunha e grupo.</DialogDescription>
          </div>
        </DialogHeader>
        <form onSubmit={submeter} className="flex min-h-0 flex-col">
          <div className="space-y-4 overflow-y-auto p-5">
            <Campo id="np-nome" rotulo="Nome ou alcunha">
              <Input id="np-nome" value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
            </Campo>
            <Campo id="np-grupo" rotulo="Grupo">
              <Seletor id="np-grupo" value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
              </Seletor>
            </Campo>
            <p className="rounded-md bg-surface p-3 text-xs text-muted-foreground">
              O perfil fica à espera do consentimento do tutor. A seguir, convida o tutor para o aceitar.
            </p>
            {erro && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
          </div>
          <DialogFooter className="flex justify-end gap-2 space-y-0">
            <Button type="button" variant="outline" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit">Criar e convidar tutor</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConvidarTutor({ aluno, aoFechar }: { aluno: PerfilAluno | null; aoFechar: () => void }) {
  const { instituicaoId } = useInstituicaoAtual();
  const [canal, setCanal] = useState<CanalConvite>("sms");
  const [destino, setDestino] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [criado, setCriado] = useState<Convite | null>(null);

  const fechar = () => {
    setCriado(null);
    setDestino("");
    setErro(null);
    aoFechar();
  };

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (!aluno) return;
    setErro(null);
    try {
      setCriado(
        await api.criarConvite(instituicaoId, { canal, destino, papel: "familia", grupoId: aluno.grupoId, alunoId: aluno.id, usosMax: 1 }),
      );
    } catch (err) {
      setErro(erroTexto(err));
    }
  };

  return (
    <Dialog open={!!aluno} onOpenChange={(v) => !v && fechar()}>
      <DialogContent>
        <DialogHeader>
          <div>
            <DialogTitle>Convidar o tutor de {aluno?.nome}</DialogTitle>
            <DialogDescription>Ao aceitar, o tutor dá o consentimento e fica ligado só a esta criança.</DialogDescription>
          </div>
        </DialogHeader>
        {criado ? (
          <div className="space-y-4 p-5 text-center">
            <p className="font-mono text-4xl font-bold tracking-[0.3em] text-primary">{criado.codigo}</p>
            <LinkConvite codigo={criado.codigo} />
            <p className="text-sm text-muted-foreground">
              {criado.canal === "codigo" ? "Entrega este código ao tutor (em papel ou por mensagem)." : `Enviado para ${criado.destino}.`}
            </p>
            <Button className="w-full" onClick={fechar}>
              Concluir
            </Button>
          </div>
        ) : (
          <form onSubmit={submeter} className="flex min-h-0 flex-col">
            <div className="space-y-4 overflow-y-auto p-5">
              <Campo id="ct-canal" rotulo="Como enviar">
                <Seletor id="ct-canal" value={canal} onChange={(e) => setCanal(e.target.value as CanalConvite)}>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                  <option value="codigo">Código para entregar em mão</option>
                </Seletor>
              </Campo>
              {canal !== "codigo" && (
                <Campo id="ct-destino" rotulo={canal === "sms" ? "Telemóvel" : "Email"}>
                  <Input id="ct-destino" type={canal === "sms" ? "tel" : "email"} value={destino} onChange={(e) => setDestino(e.target.value)} required />
                </Campo>
              )}
              {erro && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
            </div>
            <DialogFooter className="flex justify-end gap-2 space-y-0">
              <Button type="button" variant="outline" onClick={fechar}>
                Cancelar
              </Button>
              <Button type="submit">Enviar convite</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
