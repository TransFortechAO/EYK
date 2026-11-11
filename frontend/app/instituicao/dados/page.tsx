"use client";

import { useState, type FormEvent } from "react";
import { Database, Download, FileDown, Info, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/eyk";
import { useConfirm } from "@/components/confirm-dialog";
import { Exige, useInstituicaoAtual } from "@/components/instituicao/contexto";
import { acao, Campo, Carregando, celula, dataCurta, ErroCarregar, erroTexto, Etiqueta, haQuanto, Seletor, Tabela, useCarregar } from "@/components/instituicao/ui";
import { apiInstituicoes as api } from "@/lib/instituicoes/api";
import { enderecoApi } from "@/lib/instituicoes/servidor";
import type { AmbitoDados, PedidoDados } from "@/lib/instituicoes/tipos";

const ROTULO_AMBITO: Record<AmbitoDados, string> = { crianca: "Uma criança", familia: "A minha família", instituicao: "A instituição inteira" };

function EstadoPedido({ p }: { p: PedidoDados }) {
  const mapa = {
    recebido: <Etiqueta>Recebido</Etiqueta>,
    em_curso: <Etiqueta tom="aviso">Em curso</Etiqueta>,
    concluido: <Etiqueta tom="sucesso">Concluído</Etiqueta>,
    recusado: <Etiqueta tom="perigo">Recusado</Etiqueta>,
  };
  return mapa[p.estado];
}

export default function DadosPage() {
  const { instituicaoId, pode, atual } = useInstituicaoAtual();
  const confirmar = useConfirm();
  const admin = pode("gerir_pedidos_dados");
  const [tipo, setTipo] = useState<PedidoDados["tipo"]>("exportacao");
  const [ambito, setAmbito] = useState<AmbitoDados>(admin ? "instituicao" : "familia");
  const [alunoId, setAlunoId] = useState("");
  const [aEnviar, setAEnviar] = useState(false);

  const { dados, erro, aCarregar, recarregar } = useCarregar(async () => {
    const [pedidos, alunos] = await Promise.all([api.listarPedidosDados(instituicaoId), api.listarAlunos(instituicaoId)]);
    return { pedidos, alunos };
  }, [instituicaoId]);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (!dados) return;
    const crianca = dados.alunos.find((a) => a.id === alunoId);
    const alvo =
      ambito === "instituicao"
        ? atual.instituicao.nome
        : ambito === "crianca"
          ? crianca?.nome ?? ""
          : `Família de ${atual.membro.nome}`;
    if (ambito === "crianca" && !crianca) {
      toast.error("Escolhe a criança.");
      return;
    }
    if (tipo === "eliminacao") {
      const ok = await confirmar({
        title: `Pedir a eliminação: ${alvo}?`,
        description:
          "Primeiro fica disponível uma cópia completa para descarregares. Nada é apagado até a eliminação ser confirmada. Depois, os dados e ficheiros são apagados ou anonimizados e a criança deixa de ter perfil. As cópias de segurança são limpas no ciclo normal.",
        confirmLabel: "Pedir eliminação",
        destructive: true,
        requireText: "ELIMINAR",
      });
      if (!ok) return;
    }
    setAEnviar(true);
    try {
      await api.pedirDados(instituicaoId, { tipo, ambito, alvo, alunoId: ambito === "crianca" ? alunoId : null });
      toast.success(tipo === "exportacao" ? "A tua cópia está pronta para descarregar." : "Pedido de eliminação recebido.");
      await recarregar();
    } catch (err) {
      toast.error(erroTexto(err));
    } finally {
      setAEnviar(false);
    }
  };

  const descarregar = (p: PedidoDados) => {
    const url = enderecoApi(p.url);
    if (url) window.location.assign(url);
    else toast.info("Na demonstração não há ficheiro para descarregar.");
  };

  const decidir = async (p: PedidoDados, aprovar: boolean) => {
    if (aprovar) {
      const ok = await confirmar({
        title: `Eliminar os dados: ${p.alvo}?`,
        description: "Esta ação não se pode desfazer. Confirma que a cópia já foi descarregada.",
        confirmLabel: "Eliminar",
        destructive: true,
        requireText: "ELIMINAR",
      });
      if (!ok) return;
    }
    if (await acao(() => api.decidirPedidoDados(instituicaoId, p.id, aprovar), aprovar ? "Dados eliminados." : "Pedido recusado.")) await recarregar();
  };

  const ambitos: AmbitoDados[] = admin ? ["instituicao", "familia", "crianca"] : ["familia", "crianca"];

  return (
    <Exige permitido={pode("pedir_dados")}>
      <div className="space-y-8">
        <PageHeader title={admin ? "Exportação e eliminação de dados" : "Os meus dados"} description="Descarrega uma cópia dos dados ou pede a sua eliminação. A eliminação é confirmada em até 30 dias." />

        <Card className="p-5 shadow-soft">
          <form onSubmit={submeter} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <Campo id="dd-tipo" rotulo="O que pedes">
              <Seletor id="dd-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as PedidoDados["tipo"])}>
                <option value="exportacao">Exportar (receber uma cópia)</option>
                <option value="eliminacao">Eliminar</option>
              </Seletor>
            </Campo>
            <Campo id="dd-ambito" rotulo="Sobre">
              <Seletor id="dd-ambito" value={ambito} onChange={(e) => setAmbito(e.target.value as AmbitoDados)}>
                {ambitos.map((a) => (
                  <option key={a} value={a}>
                    {ROTULO_AMBITO[a]}
                  </option>
                ))}
              </Seletor>
            </Campo>
            {ambito === "crianca" ? (
              <Campo id="dd-aluno" rotulo="Criança">
                <Seletor id="dd-aluno" value={alunoId} onChange={(e) => setAlunoId(e.target.value)} required>
                  <option value="">Escolhe…</option>
                  {(dados?.alunos ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </Seletor>
              </Campo>
            ) : (
              <div className="hidden lg:block" />
            )}
            <Button type="submit" disabled={aEnviar} variant={tipo === "eliminacao" ? "destructive" : "default"} className="gap-1.5">
              {tipo === "eliminacao" ? <Trash2 className="h-4 w-4" /> : <FileDown className="h-4 w-4" />}
              {aEnviar ? "A enviar…" : "Enviar pedido"}
            </Button>
          </form>
          {ambito === "instituicao" && tipo === "eliminacao" && (
            <p className="mt-3 flex items-start gap-2 rounded-md bg-warning/10 p-3 text-xs">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              No fim de uma parceria, descarrega a cópia completa: a eliminação da instituição inteira é confirmada pela equipa EYK.
            </p>
          )}
        </Card>

        {aCarregar && !dados ? (
          <Carregando />
        ) : !dados ? (
          <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />
        ) : dados.pedidos.length === 0 ? (
          <EmptyState icon={Database} title="Sem pedidos" description="Os pedidos que fizeres aparecem aqui, com o estado e o prazo." />
        ) : (
          <Card className="p-5 shadow-soft">
            <Tabela cabecalho={["Pedido", "Sobre", ...(admin ? ["Pedido por"] : []), "Estado", "Prazo", ""]}>
              {dados.pedidos.map((p) => (
                <tr key={p.id}>
                  <td className={celula}>
                    <p className="font-medium">{p.tipo === "exportacao" ? "Exportação" : "Eliminação"}</p>
                    <p className="text-xs text-muted-foreground">{haQuanto(p.pedidoEm)}</p>
                  </td>
                  <td className={`${celula} text-xs`}>
                    {p.alvo}
                    <p className="text-muted-foreground">{ROTULO_AMBITO[p.ambito]}</p>
                  </td>
                  {admin && <td className={`${celula} text-xs`}>{p.pedidoPor}</td>}
                  <td className={celula}>
                    <EstadoPedido p={p} />
                    {p.nota && <p className="mt-1 max-w-56 text-[11px] text-muted-foreground">{p.nota}</p>}
                  </td>
                  <td className={`${celula} whitespace-nowrap text-xs`}>até {dataCurta(p.prazo)}</td>
                  <td className={`${celula} text-right`}>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {p.ficheiroPronto && (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => descarregar(p)}>
                          <Download className="h-4 w-4" /> Descarregar
                        </Button>
                      )}
                      {admin && p.tipo === "eliminacao" && p.estado === "em_curso" && p.ambito !== "instituicao" && (
                        <>
                          <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => void decidir(p, true)}>
                            <Trash2 className="h-4 w-4" /> Confirmar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => void decidir(p, false)}>
                            Recusar
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </Tabela>
          </Card>
        )}
      </div>
    </Exige>
  );
}
