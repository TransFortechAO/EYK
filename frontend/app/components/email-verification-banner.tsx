"use client";

import { useEffect, useState } from "react";
import { MailWarning, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-gate";
import { api, mensagemDeErro } from "@/lib/api";

const FECHADO_KEY = "eyk:aviso-verificar-email-fechado";

/** Aviso no topo da app enquanto o email da conta não estiver confirmado. */
export function EmailVerificationBanner() {
  const { user } = useAuth();
  const [fechado, setFechado] = useState(true);
  const [aEnviar, setAEnviar] = useState(false);

  useEffect(() => {
    setFechado(sessionStorage.getItem(FECHADO_KEY) === "1");
  }, []);

  if (!user || user.emailVerificado !== false || !user.email || fechado) return null;

  const reenviar = async () => {
    setAEnviar(true);
    try {
      const res = await api.reenviarVerificacaoEmail();
      toast.success(
        res.jaVerificado ? "O teu email já está confirmado." : `Enviámos um novo link para ${user.email}.`,
      );
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível enviar o email. Tenta mais tarde."));
    } finally {
      setAEnviar(false);
    }
  };

  const fechar = () => {
    sessionStorage.setItem(FECHADO_KEY, "1");
    setFechado(true);
  };

  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b border-primary/20 bg-primary/10 px-4 py-2 text-xs sm:text-sm"
    >
      <MailWarning className="h-4 w-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1">
        Confirma o teu email (<span className="font-medium">{user.email}</span>) — abre o link que te enviámos.{" "}
        <button
          type="button"
          onClick={() => void reenviar()}
          disabled={aEnviar}
          className="font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-60"
        >
          {aEnviar ? "A enviar…" : "Reenviar email"}
        </button>
      </p>
      <button
        type="button"
        onClick={fechar}
        aria-label="Fechar aviso"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
