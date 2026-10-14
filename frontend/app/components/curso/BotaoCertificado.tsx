"use client";

import { useState } from "react";
import { Award, MailWarning } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-gate";
import { api, mensagemDeErro } from "@/lib/api";

/** Descarregar o certificado de um curso concluído — o servidor só o emite a
 * contas com o email confirmado, por isso até lá mostra como confirmar. */
export function BotaoCertificado({ cursoId }: { cursoId: string | number }) {
  const { user, refresh } = useAuth();
  const [aEnviar, setAEnviar] = useState(false);
  const [aVerificar, setAVerificar] = useState(false);

  if (user?.emailVerificado !== false) {
    return (
      <Button asChild className="w-full gap-2 bg-gradient-gold text-primary-foreground hover:opacity-95 shadow-gold">
        <a href={api.certificadoUrl(cursoId)} download>
          <Award className="h-4 w-4" />
          Descarregar certificado
        </a>
      </Button>
    );
  }

  const reenviar = async () => {
    setAEnviar(true);
    try {
      const res = await api.reenviarVerificacaoEmail();
      if (res.jaVerificado) {
        await refresh();
      } else {
        toast.success(`Enviámos um novo link para ${user.email}.`);
      }
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível enviar o email. Tenta mais tarde."));
    } finally {
      setAEnviar(false);
    }
  };

  const jaConfirmei = async () => {
    setAVerificar(true);
    try {
      await refresh();
    } finally {
      setAVerificar(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-3 text-sm">
      <p className="flex items-start gap-2">
        <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          Confirma o teu email para descarregares o certificado — abre o link que enviámos para{" "}
          <span className="font-medium">{user.email}</span>.
        </span>
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={() => void reenviar()} disabled={aEnviar}>
          {aEnviar ? "A enviar…" : "Reenviar email"}
        </Button>
        <Button size="sm" variant="ghost" className="flex-1" onClick={() => void jaConfirmei()} disabled={aVerificar}>
          {aVerificar ? "A verificar…" : "Já confirmei"}
        </Button>
      </div>
    </div>
  );
}
