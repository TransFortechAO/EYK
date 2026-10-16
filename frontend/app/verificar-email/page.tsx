"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { AuthShell, authButtonClass } from "@/components/auth-shell";

type Estado = "a-verificar" | "sucesso" | "invalido";

function VerificarEmail() {
  const token = useSearchParams().get("token") || "";
  const [estado, setEstado] = useState<Estado>("a-verificar");
  const [autenticado, setAutenticado] = useState(false);
  // Em modo estrito o React corre os efeitos duas vezes em dev — o token só
  // deve ser enviado uma vez.
  const enviadoRef = useRef(false);

  useEffect(() => {
    if (enviadoRef.current) return;
    enviadoRef.current = true;
    if (!token) {
      setEstado("invalido");
      return;
    }
    api
      .verificarEmail(token)
      .then((res) => {
        setAutenticado(Boolean(res?.authenticated));
        setEstado("sucesso");
      })
      .catch(() => setEstado("invalido"));
  }, [token]);

  const titulos: Record<Estado, string> = {
    "a-verificar": "A confirmar o teu email…",
    sucesso: "Email confirmado!",
    invalido: "Link inválido ou expirado.",
  };
  const descricoes: Record<Estado, string> = {
    "a-verificar": "Só um momento.",
    sucesso: "Obrigado — a tua conta EYK está confirmada.",
    invalido:
      "Este link expirou ou já não corresponde ao email da tua conta. Entra na plataforma e pede um novo no aviso do topo da página.",
  };

  return (
    <AuthShell icon={MailCheck} etiqueta="Confirmação de email" titulo={titulos[estado]} descricao={descricoes[estado]}>
      {estado !== "a-verificar" && (
        <Button asChild size="lg" className={authButtonClass}>
          <Link href={autenticado ? "/inicio" : "/login"}>{autenticado ? "Continuar para a EYK" : "Entrar na plataforma"}</Link>
        </Button>
      )}
    </AuthShell>
  );
}

export default function VerificarEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerificarEmail />
    </Suspense>
  );
}
