"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, X } from "lucide-react";
import { BodyPortal } from "@/components/body-portal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Mostrado quando o email de boas-vindas NÃO pôde ser enviado: o administrador
 * vê a senha temporária desta única vez e tem de a passar à pessoa por outra via.
 */
export function CredenciaisDialog({
  username,
  email,
  senha,
  onClose,
}: {
  username: string;
  email: string;
  senha: string;
  onClose: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  const texto = `Utilizador: ${username}\nSenha temporária: ${senha}`;
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sem permissão para a área de transferência: o texto está visível */
    }
  };

  return (
    <BodyPortal>
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cred-title"
    >
      <Card className="w-full max-w-md shadow-2xl border-border">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15 text-amber-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 id="cred-title" className="font-serif text-xl font-semibold">
                Conta criada, email não enviado
              </h2>
              <p className="text-sm text-muted-foreground">
                Não foi possível enviar o email para {email}. Passa estes dados à pessoa por outra via.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition rounded-md p-1"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <pre className="whitespace-pre-wrap break-all rounded-xl border border-border bg-surface/60 p-4 font-mono text-sm">
            {texto}
          </pre>
          <p className="text-xs text-muted-foreground">
            Esta senha só aparece agora. No primeiro acesso a pessoa será obrigada a escolher uma senha nova.
          </p>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Fechar
            </Button>
            <Button type="button" onClick={copiar} className="gap-2">
              {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiado ? "Copiado" : "Copiar dados"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
    </BodyPortal>
  );
}
