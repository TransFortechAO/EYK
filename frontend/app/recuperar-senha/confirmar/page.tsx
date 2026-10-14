"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { api, mensagemDeErro } from "@/lib/api";
import { AuthAlert, AuthShell, AuthSpinner, EYK_GOLD, authButtonClass, authInputClass } from "@/components/auth-shell";

type Estado = "a-validar" | "invalido" | "formulario" | "concluido";

function ConfirmarRecuperacao() {
  const params = useSearchParams();
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";

  const [estado, setEstado] = useState<Estado>("a-validar");
  const [isPending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || !token) {
      setEstado("invalido");
      return;
    }
    let vivo = true;
    api
      .validarLinkRecuperacao(uid, token)
      .then(() => vivo && setEstado("formulario"))
      .catch(() => vivo && setEstado("invalido"));
    return () => {
      vivo = false;
    };
  }, [uid, token]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro(null);
    if (password.length < 8) {
      setErro("A palavra-passe deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmacao) {
      setErro("As palavras-passe não coincidem.");
      return;
    }
    startTransition(async () => {
      try {
        await api.redefinirSenha(uid, token, password);
        setEstado("concluido");
      } catch (err) {
        setErro(mensagemDeErro(err, "Não foi possível alterar a palavra-passe."));
      }
    });
  };

  const titulos: Record<Estado, string> = {
    "a-validar": "A verificar o link…",
    invalido: "Link inválido ou expirado.",
    formulario: "Escolhe uma nova palavra-passe.",
    concluido: "Palavra-passe alterada.",
  };
  const descricoes: Record<Estado, string> = {
    "a-validar": "Só um momento.",
    invalido: "Este link já foi usado ou expirou. Pede um novo para recuperares o acesso à tua conta.",
    formulario: "Usa pelo menos 8 caracteres, misturando letras e números.",
    concluido: "Já podes entrar na plataforma com a tua nova palavra-passe.",
  };

  return (
    <AuthShell icon={KeyRound} etiqueta="Recuperar acesso" titulo={titulos[estado]} descricao={descricoes[estado]}>
      {estado === "formulario" && (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm text-white/85">
              Nova palavra-passe
            </Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending}
              className={authInputClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmacao" className="text-sm text-white/85">
              Confirmar palavra-passe
            </Label>
            <PasswordInput
              id="confirmacao"
              autoComplete="new-password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              disabled={isPending}
              className={authInputClass}
            />
          </div>

          {erro && <AuthAlert tipo="erro">{erro}</AuthAlert>}

          <Button type="submit" size="lg" disabled={isPending} className={authButtonClass}>
            {isPending ? <AuthSpinner texto="A guardar…" /> : "Guardar nova palavra-passe"}
          </Button>
        </form>
      )}

      {estado === "concluido" && (
        <Button asChild size="lg" className={authButtonClass}>
          <Link href="/login">Entrar na plataforma</Link>
        </Button>
      )}

      {estado === "invalido" && (
        <Button asChild size="lg" className={authButtonClass}>
          <Link href="/recuperar-senha">Pedir um novo link</Link>
        </Button>
      )}

      {estado !== "concluido" && (
        <p className="mt-8 text-center text-sm text-white/55">
          <Link href="/login" className="inline-flex items-center gap-1 font-semibold hover:underline" style={{ color: EYK_GOLD }}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Voltar ao login
          </Link>
        </p>
      )}
    </AuthShell>
  );
}

export default function ConfirmarRecuperacaoPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmarRecuperacao />
    </Suspense>
  );
}
