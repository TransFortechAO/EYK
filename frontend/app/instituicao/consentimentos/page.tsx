"use client";

import { useMemo, useState } from "react";
import { HandHelping, History, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { EmptyState, StatCard } from "@/components/eyk";
import { useConfirm } from "@/components/confirm-dialog";
import { Exige, useInstituicaoAtual } from "@/components/instituicao/contexto";
import { acao, Carregando, celula, dataHora, ErroCarregar, Etiqueta, Seletor, Tabela, useCarregar } from "@/components/instituicao/ui";
import { apiInstituicoes as api, consentimentosAtuais } from "@/lib/instituicoes/api";
import type { FinalidadeConsentimento } from "@/lib/instituicoes/tipos";

export default function ConsentimentosPage() {
  const { pode, papel } = useInstituicaoAtual();
  if (papel === "familia") return <VistaFamilia />;
  return (
    <Exige permitido={pode("ver_consentimentos")}>
      <VistaAdministracao />
    </Exige>
  );
}

function VistaFamilia() {
  const { instituicaoId, atual } = useInstituicaoAtual();
  const confirmar = useConfirm();
  const texto = api.textoConsentimento();
  const { dados, erro, aCarregar, recarregar } = useCarregar(async () => {
    const [alunos, consentimentos] = await Promise.all([api.listarAlunos(instituicaoId), api.listarConsentimentos(instituicaoId)]);
    return { alunos, consentimentos };
  }, [instituicaoId]);

  const meus = useMemo(() => consentimentosAtuais((dados?.consentimentos ?? []).filter((c) => c.tutorId === atual.membro.id)), [dados, atual]);

  const mudar = async (alunoId: string, nome: string, finalidade: FinalidadeConsentimento, aceite: boolean) => {
    const f = texto.finalidades.find((x) => x.id === finalidade)!;
    if (!aceite && f.obrigatoria) {
      const ok = await confirmar({
        title: `Retirar o consentimento de utilização de ${nome}?`,
        description: "O perfil fica inativo, a criança sai dos relatórios e deixa de aceder aos conteúdos da turma. Podes voltar a dar o consentimento depois.",
        confirmLabel: "Retirar",
        destructive: true,
      });
      if (!ok) return;
    }
    if (await acao(() => api.registarConsentimento(instituicaoId, alunoId, finalidade, aceite), aceite ? "Consentimento registado." : "Consentimento retirado.")) {
      await recarregar();
    }
  };

  if (aCarregar && !dados) return <Carregando />;
  if (!dados) return <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold">Consentimentos</h2>
        <p className="text-sm text-muted-foreground">Decides cada finalidade em separado e podes mudar a qualquer momento.</p>
      </div>

      <Card className="space-y-2 p-5 shadow-soft">
        <p className="flex items-center gap-2 font-medium">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> Em resumo
        </p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {texto.resumo.map((l) => (
            <li key={l} className="flex gap-2">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              {l}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">Versão do texto {texto.versao}.</p>
      </Card>

      {dados.alunos.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Sem crianças associadas" />
      ) : (
        dados.alunos.map((a) => (
          <Card key={a.id} className="p-5 shadow-soft">
            <p className="mb-3 font-serif text-lg font-semibold">{a.nome}</p>
            <ul className="divide-y divide-border">
              {texto.finalidades.map((f) => {
                const atualC = meus[a.id]?.[f.id];
                const aceite = !!atualC?.aceite;
                return (
                  <li key={f.id} className="flex items-start justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <label htmlFor={`cs-${a.id}-${f.id}`} className="text-sm font-medium">
                        {f.titulo}
                      </label>
                      <p className="text-xs text-muted-foreground">{f.descricao}</p>
                      {atualC && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {aceite ? "Aceite" : "Recusado"} em {dataHora(atualC.registadoEm)} · versão {atualC.versaoTexto}
                        </p>
                      )}
                    </div>
                    <Switch id={`cs-${a.id}-${f.id}`} checked={aceite} onCheckedChange={(v) => void mudar(a.id, a.nome, f.id, v)} />
                  </li>
                );
              })}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}

function VistaAdministracao() {
  const { instituicaoId } = useInstituicaoAtual();
  const texto = api.textoConsentimento();
  const [vista, setVista] = useState<"atual" | "historico">("atual");
  const { dados, erro, aCarregar, recarregar } = useCarregar(async () => {
    const [alunos, consentimentos] = await Promise.all([api.listarAlunos(instituicaoId), api.listarConsentimentos(instituicaoId)]);
    return { alunos, consentimentos };
  }, [instituicaoId]);

  const atuais = useMemo(() => consentimentosAtuais(dados?.consentimentos ?? []), [dados]);

  if (aCarregar && !dados) return <Carregando />;
  if (!dados) return <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />;

  const nomeAluno = (id: string) => dados.alunos.find((a) => a.id === id)?.nome ?? "—";
  const contar = (f: FinalidadeConsentimento) => dados.alunos.filter((a) => atuais[a.id]?.[f]?.aceite).length;
  const comApoio = dados.consentimentos.filter((c) => c.comApoio).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Registo de consentimentos</h2>
          <p className="text-sm text-muted-foreground">
            Quem consentiu, o quê, quando e com que versão do texto. Os registos não se editam: cada mudança acrescenta um novo.
          </p>
        </div>
        <Seletor aria-label="Vista" className="w-56" value={vista} onChange={(e) => setVista(e.target.value as "atual" | "historico")}>
          <option value="atual">Estado atual por criança</option>
          <option value="historico">Histórico completo</option>
        </Seletor>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {texto.finalidades.map((f) => (
          <StatCard key={f.id} icon={ShieldCheck} label={f.titulo} value={`${contar(f.id)}/${dados.alunos.length}`} hint="crianças com consentimento" />
        ))}
        <StatCard icon={HandHelping} label="Com apoio presencial" value={comApoio} hint="registos feitos com ajuda da instituição" />
      </div>

      <Card className="p-5 shadow-soft">
        {vista === "atual" ? (
          <Tabela cabecalho={["Criança", ...texto.finalidades.map((f) => f.titulo)]}>
            {dados.alunos.map((a) => (
              <tr key={a.id}>
                <td className={`${celula} font-medium`}>{a.nome}</td>
                {texto.finalidades.map((f) => {
                  const c = atuais[a.id]?.[f.id];
                  return (
                    <td key={f.id} className={celula}>
                      {!c ? (
                        <Etiqueta tom="neutro">Sem resposta</Etiqueta>
                      ) : c.aceite ? (
                        <Etiqueta tom="sucesso">Aceite</Etiqueta>
                      ) : (
                        <Etiqueta tom="perigo">Recusado</Etiqueta>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </Tabela>
        ) : (
          <>
            <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <History className="h-3.5 w-3.5" aria-hidden /> {dados.consentimentos.length} registos, do mais recente para o mais antigo
            </p>
            <Tabela cabecalho={["Quando", "Criança", "Finalidade", "Decisão", "Tutor", "Versão"]}>
              {[...dados.consentimentos]
                .sort((x, y) => y.registadoEm.localeCompare(x.registadoEm))
                .map((c) => (
                  <tr key={c.id}>
                    <td className={`${celula} whitespace-nowrap text-xs`}>{dataHora(c.registadoEm)}</td>
                    <td className={`${celula} font-medium`}>{nomeAluno(c.alunoId)}</td>
                    <td className={`${celula} text-xs`}>{texto.finalidades.find((f) => f.id === c.finalidade)?.titulo}</td>
                    <td className={celula}>{c.aceite ? <Etiqueta tom="sucesso">Aceite</Etiqueta> : <Etiqueta tom="perigo">Recusado</Etiqueta>}</td>
                    <td className={`${celula} text-xs`}>
                      {c.tutorNome}
                      {c.comApoio && <span className="ml-1 text-muted-foreground">(com apoio)</span>}
                    </td>
                    <td className={`${celula} font-mono text-xs`}>{c.versaoTexto}</td>
                  </tr>
                ))}
            </Tabela>
          </>
        )}
      </Card>
    </div>
  );
}
