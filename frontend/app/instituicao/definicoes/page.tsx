"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Exige, useInstituicaoAtual } from "@/components/instituicao/contexto";
import { acao, dataCurta } from "@/components/instituicao/ui";
import { apiInstituicoes as api } from "@/lib/instituicoes/api";
import { ROTULO_ESTADO_INSTITUICAO, ROTULO_TIPO_INSTITUICAO } from "@/lib/instituicoes/permissoes";

export default function DefinicoesPage() {
  const { instituicaoId, pode, atual, recarregar } = useInstituicaoAtual();
  const inst = atual.instituicao;
  const [aprovar, setAprovar] = useState(inst.aprovarPedidosPorCodigo);
  const [email, setEmail] = useState(inst.canaisAviso.includes("email"));
  const alterado = aprovar !== inst.aprovarPedidosPorCodigo || email !== inst.canaisAviso.includes("email");

  const guardar = async () => {
    const ok = await acao(
      () => api.atualizarDefinicoes(instituicaoId, { aprovarPedidosPorCodigo: aprovar, canaisAviso: email ? ["plataforma", "email"] : ["plataforma"] }),
      "Definições guardadas.",
    );
    if (ok) await recarregar();
  };

  return (
    <Exige permitido={pode("gerir_definicoes")}>
      <div className="space-y-6">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Definições</h2>
          <p className="text-sm text-muted-foreground">Como a instituição funciona no EYK.</p>
        </div>

        <Card className="divide-y divide-border shadow-soft">
          <div className="flex items-start justify-between gap-4 p-5">
            <div>
              <label htmlFor="def-aprovar" className="text-sm font-medium">
                Aprovar pedidos feitos por código
              </label>
              <p className="text-xs text-muted-foreground">
                Quem usa um código partilhável fica à espera da tua aprovação antes de ganhar acesso. Os convites por email ou
                SMS são pessoais e não precisam de aprovação.
              </p>
            </div>
            <Switch id="def-aprovar" checked={aprovar} onCheckedChange={setAprovar} />
          </div>
          <div className="flex items-start justify-between gap-4 p-5">
            <div>
              <label htmlFor="def-email" className="text-sm font-medium">
                Avisos e lembretes por email
              </label>
              <p className="text-xs text-muted-foreground">
                Cada pessoa escolhe depois se os quer receber. Desligado, os avisos chegam só pela plataforma.
              </p>
            </div>
            <Switch id="def-email" checked={email} onCheckedChange={setEmail} />
          </div>
          <div className="flex justify-end p-4">
            <Button disabled={!alterado} onClick={() => void guardar()}>
              Guardar
            </Button>
          </div>
        </Card>

        <Card className="p-5 shadow-soft">
          <p className="mb-3 font-medium">Sobre a instituição</p>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Linha t="Tipo" v={ROTULO_TIPO_INSTITUICAO[inst.tipo]} />
            <Linha t="Província" v={inst.provincia} />
            <Linha t="Estado" v={ROTULO_ESTADO_INSTITUICAO[inst.estado]} />
            <Linha t="No EYK desde" v={dataCurta(inst.criadaEm)} />
            <Linha t="Responsável" v={`${inst.responsavel.nome} · ${inst.responsavel.email}`} />
            <Linha t="Armazenamento" v={`${inst.quotas.armazenamentoMb >= 1024 ? `${inst.quotas.armazenamentoMb / 1024} GB` : `${inst.quotas.armazenamentoMb} MB`}`} />
            <Linha t="Tamanho máximo por ficheiro" v={`${inst.quotas.ficheiroMaxMb} MB`} />
            <Linha t="Utilizadores" v={`até ${inst.quotas.utilizadoresMax}`} />
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">As quotas e o estado são geridos pela equipa EYK. Para mudar, abre um pedido de apoio.</p>
        </Card>
      </div>
    </Exige>
  );
}

function Linha({ t, v }: { t: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{t}</dt>
      <dd>{v}</dd>
    </div>
  );
}
