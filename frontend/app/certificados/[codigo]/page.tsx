"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Award } from "lucide-react";
import { api, type CertificadoVerificado } from "@/lib/api";
import { AuthShell, EYK_GOLD_LIGHT } from "@/components/auth-shell";

function dataPorExtenso(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" });
}

/** Página pública (link/QR impresso no PDF) que confirma a autenticidade de um certificado. */
export default function VerificarCertificadoPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const [certificado, setCertificado] = useState<CertificadoVerificado | null>(null);
  const [aCarregar, setACarregar] = useState(true);

  useEffect(() => {
    let vivo = true;
    api.verificarCertificado(codigo).then((res) => {
      if (!vivo) return;
      setCertificado(res);
      setACarregar(false);
    });
    return () => {
      vivo = false;
    };
  }, [codigo]);

  if (aCarregar) {
    return <AuthShell icon={Award} etiqueta="Certificado EYK" titulo="A verificar certificado…">{null}</AuthShell>;
  }

  if (!certificado?.valido) {
    return (
      <AuthShell
        icon={Award}
        etiqueta="Certificado EYK"
        titulo="Certificado não encontrado."
        descricao="Não existe nenhum certificado EYK válido com este código. Confirma que o link ou o código estão completos."
      >
        {null}
      </AuthShell>
    );
  }

  const linhas = [
    { label: "Aluno", valor: certificado.aluno },
    { label: "Curso", valor: certificado.curso },
    { label: "Professor", valor: certificado.professor },
    { label: "Concluído a", valor: dataPorExtenso(certificado.concluidoEm) },
  ];

  return (
    <AuthShell
      icon={Award}
      etiqueta="Certificado verificado"
      titulo="Certificado autêntico."
      descricao="Este certificado de conclusão foi emitido pela plataforma EYK."
    >
      <dl className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        {linhas.map((l) => (
          <div key={l.label} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
            <dt className="shrink-0 text-white/50">{l.label}</dt>
            <dd className="text-right font-medium text-white" style={l.label === "Aluno" ? { color: EYK_GOLD_LIGHT } : undefined}>
              {l.valor}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 break-all text-center text-[11px] text-white/35">Código: {certificado.codigo}</p>
    </AuthShell>
  );
}
