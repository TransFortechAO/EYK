"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, formatarDataCurta, mensagemDeErro, type AcaoPublica } from "@/lib/api";
import { AuthShell, authButtonClass } from "@/components/auth-shell";

type Dados = Awaited<ReturnType<typeof api.moderacao.verContestacao>>;

const ESTADO_LABEL: Record<string, string> = {
  pendente: "A equipa ainda está a analisar a tua contestação. Vais receber a resposta por email.",
  aceite: "A tua contestação foi aceite — a decisão foi anulada.",
  recusada: "A tua contestação foi analisada e a decisão foi mantida.",
};

function descreverAcao(acao: AcaoPublica): string {
  const quando = formatarDataCurta(acao.criadaEm);
  if (acao.tipo === "suspensao") return `Suspensão de ${acao.duracaoDias ?? "?"} dia(s), aplicada a ${quando}.`;
  if (acao.tipo === "banimento") return `Banimento da conta, aplicado a ${quando}.`;
  if (acao.tipo === "aviso") return `Aviso da moderação, recebido a ${quando}.`;
  return `${acao.tipoLabel}, a ${quando}.`;
}

/** Contestar uma decisão de moderação (link do email ou do login). Pública:
 * contas suspensas/banidas não conseguem entrar, por isso o acesso é pelo token. */
function Contestar() {
  const token = useSearchParams().get("token") || "";
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);

  useEffect(() => {
    if (!token) {
      setErro("Este link é inválido ou já expirou.");
      return;
    }
    api.moderacao
      .verContestacao(token)
      .then(setDados)
      .catch((err) => setErro(mensagemDeErro(err, "Este link é inválido ou já expirou.")));
  }, [token]);

  const enviar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      await api.moderacao.contestar(token, texto.trim());
      setEnviada(true);
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível enviar. Tenta de novo."));
    } finally {
      setEnviando(false);
    }
  };

  if (!dados) {
    return (
      <AuthShell icon={Scale} etiqueta="Moderação" titulo={erro ? "Link inválido" : "A carregar…"} descricao={erro ?? undefined}>
        {erro && (
          <Button asChild size="lg" className={authButtonClass}>
            <Link href="/login">Voltar ao login</Link>
          </Button>
        )}
      </AuthShell>
    );
  }

  const { acao, contestacao, contestavel } = dados;

  if (enviada || contestacao) {
    return (
      <AuthShell
        icon={Scale}
        etiqueta="Moderação"
        titulo={enviada ? "Contestação enviada" : "Contestação"}
        descricao={enviada ? ESTADO_LABEL.pendente : ESTADO_LABEL[contestacao!.estado]}
      >
        {contestacao?.resposta && (
          <p className="rounded-xl bg-white/[0.04] p-3 text-sm text-white/80">Resposta da equipa: {contestacao.resposta}</p>
        )}
        <Button asChild size="lg" className={authButtonClass}>
          <Link href="/login">Voltar ao login</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell icon={Scale} etiqueta="Moderação" titulo="Contestar a decisão" descricao={descreverAcao(acao)}>
      <div className="space-y-4">
        {acao.motivo && <p className="text-sm text-white/80">Motivo indicado: {acao.motivo}</p>}
        {acao.conteudo && (
          <blockquote className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/70">
            {acao.conteudo}
          </blockquote>
        )}
        {contestavel ? (
          <>
            <label htmlFor="contestacao" className="block text-sm text-white/85">
              Explica porque achas que a decisão foi um engano
            </label>
            <Textarea
              id="contestacao"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={5}
              maxLength={3000}
              className="bg-white/[0.04] text-white border-white/10"
            />
            {erro && <p className="text-sm text-red-300">{erro}</p>}
            <Button
              size="lg"
              className={authButtonClass}
              disabled={enviando || texto.trim().length < 10}
              onClick={() => void enviar()}
            >
              {enviando ? "A enviar…" : "Enviar contestação"}
            </Button>
          </>
        ) : (
          <p className="text-sm text-white/70">Esta decisão já não pode ser contestada.</p>
        )}
      </div>
    </AuthShell>
  );
}

export default function ContestarPage() {
  return (
    <Suspense fallback={null}>
      <Contestar />
    </Suspense>
  );
}
