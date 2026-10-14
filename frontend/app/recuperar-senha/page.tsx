"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, mensagemDeErro } from "@/lib/api";
import { AuthAlert, AuthShell, AuthSpinner, EYK_GOLD, authButtonClass, authInputClass } from "@/components/auth-shell";

export default function RecuperarSenhaPage() {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro(null);
    if (!email.trim() || !email.includes("@")) {
      setErro("Indica um email válido.");
      return;
    }
    startTransition(async () => {
      try {
        await api.pedirRecuperacaoSenha(email.trim());
        setEnviado(true);
      } catch (err) {
        setErro(mensagemDeErro(err, "Não foi possível enviar o pedido. Tenta novamente."));
      }
    });
  };

  return (
    <AuthShell
      icon={KeyRound}
      etiqueta="Recuperar acesso"
      titulo={enviado ? "Verifica o teu email." : "Esqueceste-te da palavra-passe?"}
      descricao={
        enviado ? (
          <>
            Se existir uma conta associada a <span className="font-medium text-white/85">{email.trim()}</span>,
            vais receber um link para escolheres uma nova palavra-passe. Não te esqueças de ver a pasta de spam.
          </>
        ) : (
          "Indica o email da tua conta e enviamos-te um link para criares uma nova palavra-passe."
        )
      }
    >
      {enviado ? (
        <div className="space-y-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setEnviado(false)}
            className="h-12 w-full rounded-full border-white/15 bg-transparent text-white hover:bg-white/5"
          >
            Usar outro email
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm text-white/85">
              Email
            </Label>
            <div className="group relative">
              <Mail
                className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35 transition-colors group-focus-within:text-[#d4a24a]"
                aria-hidden
              />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="o.teu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
                className={`${authInputClass} pl-11`}
              />
            </div>
          </div>

          {erro && <AuthAlert tipo="erro">{erro}</AuthAlert>}

          <Button type="submit" size="lg" disabled={isPending} className={authButtonClass}>
            {isPending ? <AuthSpinner texto="A enviar…" /> : "Enviar link de recuperação"}
          </Button>
        </form>
      )}

      <p className="mt-8 text-center text-sm text-white/55">
        <Link href="/login" className="inline-flex items-center gap-1 font-semibold hover:underline" style={{ color: EYK_GOLD }}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Voltar ao login
        </Link>
      </p>
    </AuthShell>
  );
}
