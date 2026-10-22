"use client";

import { useMemo, useState } from "react";
import { Lock, Search, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Exige, useInstituicaoAtual } from "@/components/instituicao/contexto";
import { Carregando, celula, dataHora, ErroCarregar, Etiqueta, Seletor, Tabela, useCarregar } from "@/components/instituicao/ui";
import { apiInstituicoes as api } from "@/lib/instituicoes/api";
import { ROTULO_ACAO } from "@/lib/instituicoes/permissoes";
import type { AcaoAuditoria } from "@/lib/instituicoes/tipos";

const GRUPOS_ACAO: { rotulo: string; acoes: AcaoAuditoria[] }[] = [
  { rotulo: "Membros e papéis", acoes: ["membro_adicionado", "membro_removido", "papel_alterado", "convite_criado", "convite_cancelado", "pedido_decidido"] },
  { rotulo: "Crianças e consentimentos", acoes: ["aluno_criado", "vinculo_criado", "vinculo_removido", "consentimento_alterado"] },
  { rotulo: "Ficheiros", acoes: ["ficheiro_carregado", "ficheiro_aberto", "ficheiro_removido"] },
  { rotulo: "Dados pessoais", acoes: ["dados_exportados", "dados_eliminacao_pedida"] },
  { rotulo: "Comunicação", acoes: ["aviso_publicado", "evento_criado", "evento_cancelado"] },
  { rotulo: "Instituição e equipa EYK", acoes: ["instituicao_criada", "instituicao_estado", "quotas_alteradas", "acesso_equipa_eyk", "grupo_criado", "grupo_arquivado"] },
];

export default function AuditoriaPage() {
  const { instituicaoId, pode } = useInstituicaoAtual();
  const [grupo, setGrupo] = useState("");
  const [origem, setOrigem] = useState<"" | "instituicao" | "equipa_eyk">("");
  const [pesquisa, setPesquisa] = useState("");
  const { dados, erro, aCarregar, recarregar } = useCarregar(() => api.listarAuditoria(instituicaoId), [instituicaoId]);

  const lista = useMemo(() => {
    const acoes = GRUPOS_ACAO.find((g) => g.rotulo === grupo)?.acoes;
    const termo = pesquisa.trim().toLowerCase();
    return (dados ?? []).filter(
      (r) =>
        (!acoes || acoes.includes(r.acao)) &&
        (!origem || r.origem === origem) &&
        (!termo || r.detalhe.toLowerCase().includes(termo) || r.quem.toLowerCase().includes(termo)),
    );
  }, [dados, grupo, origem, pesquisa]);

  return (
    <Exige permitido={pode("ver_auditoria")}>
      <div className="space-y-6">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Registo de auditoria</h2>
          <p className="text-sm text-muted-foreground">Quem fez o quê e quando, nas ações sensíveis da instituição.</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_14rem_12rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input aria-label="Pesquisar no registo" placeholder="Pesquisar" className="pl-9" value={pesquisa} onChange={(e) => setPesquisa(e.target.value)} />
          </div>
          <Seletor aria-label="Tipo de ação" value={grupo} onChange={(e) => setGrupo(e.target.value)}>
            <option value="">Todas as ações</option>
            {GRUPOS_ACAO.map((g) => (
              <option key={g.rotulo} value={g.rotulo}>
                {g.rotulo}
              </option>
            ))}
          </Seletor>
          <Seletor aria-label="Origem" value={origem} onChange={(e) => setOrigem(e.target.value as typeof origem)}>
            <option value="">Todas as origens</option>
            <option value="instituicao">Pessoas da instituição</option>
            <option value="equipa_eyk">Equipa EYK</option>
          </Seletor>
        </div>

        {aCarregar && !dados ? (
          <Carregando />
        ) : !dados ? (
          <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />
        ) : (
          <Card className="p-5 shadow-soft">
            <p className="mb-2 text-xs text-muted-foreground">{lista.length} registos</p>
            <Tabela cabecalho={["Quando", "Quem", "Ação", "Detalhe"]}>
              {lista.map((r) => (
                <tr key={r.id}>
                  <td className={`${celula} whitespace-nowrap text-xs`}>{dataHora(r.quando)}</td>
                  <td className={`${celula} text-xs`}>
                    {r.quem}
                    {r.origem === "equipa_eyk" && (
                      <span className="ml-1.5">
                        <Etiqueta tom="aviso">
                          <ShieldAlert className="h-3 w-3" aria-hidden /> Equipa EYK
                        </Etiqueta>
                      </span>
                    )}
                  </td>
                  <td className={`${celula} whitespace-nowrap text-xs font-medium`}>{ROTULO_ACAO[r.acao]}</td>
                  <td className={`${celula} text-xs text-muted-foreground`}>{r.detalhe}</td>
                </tr>
              ))}
            </Tabela>
            {lista.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum registo com estes filtros.</p>}
          </Card>
        )}

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Os registos não podem ser editados nem apagados. O acesso da equipa EYK aos dados da instituição também fica
          registado. Prazo de conservação: a definir com o jurista.
        </p>
      </div>
    </Exige>
  );
}
