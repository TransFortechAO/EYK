"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { api, mensagemDeErro } from "@/lib/api";
import { AuthAlert, AuthShell, AuthSpinner, EYK_GOLD, authButtonClass, authInputClass } from "@/components/auth-shell";

type Estado = "a-validar" | "invalido" | "formulario";

function ConcluirCandidatura() {
  const params = useSearchParams();
  const token = params.get("token") || "";

  const [estado, setEstado] = useState<Estado>("a-validar");
  const [nome, setNome] = useState("");
  const [password, setPassword] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!token) {
      setEstado("invalido");
      return;
    }
    let vivo = true;
    api
      .validarCandidaturaProfessor(token)
      .then((res) => {
        if (!vivo) return;
        setNome(res.nome);
        setEstado("formulario");
      })
      .catch(() => vivo && setEstado("invalido"));
    return () => {
      vivo = false;
    };
  }, [token]);

  const submeter = (e: React.FormEvent<HTMLFormElement>) => {
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
        const res = await api.concluirCandidaturaProfessor(token, password);
        // Conta criada e sessão iniciada: vai direto para a área do professor.
        window.location.assign(res.user ? "/professor" : "/login");
      } catch (err) {
        setErro(mensagemDeErro(err, "Não foi possível criar a conta. Tenta novamente."));
      }
    });
  };

  const titulos: Record<Estado, string> = {
    "a-validar": "A verificar o link…",
    invalido: "Link inválido ou expirado.",
    formulario: nome ? `Bem-vindo(a), ${nome.split(" ")[0]}.` : "Bem-vindo(a).",
  };
  const descricoes: Record<Estado, string> = {
    "a-validar": "Só um momento.",
    invalido: "Este link já foi usado ou expirou. Faz um novo pedido para receberes outro email.",
    formulario: "Escolhe a tua palavra-passe para criares a conta de professor.",
  };

  return (
    <AuthShell icon={GraduationCap} etiqueta="Conta de professor" titulo={titulos[estado]} descricao={descricoes[estado]}>
      {estado === "formulario" && (
        <form onSubmit={submeter} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm text-white/85">Palavra-passe</Label>
            <PasswordInput id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isPending} className={authInputClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmacao" className="text-sm text-white/85">Confirmar palavra-passe</Label>
            <PasswordInput id="confirmacao" autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} disabled={isPending} className={authInputClass} />
          </div>

          {erro && <AuthAlert tipo="erro">{erro}</AuthAlert>}

          <Button type="submit" size="lg" disabled={isPending} className={authButtonClass}>
            {isPending ? <AuthSpinner texto="A criar a conta…" /> : "Criar conta e entrar"}
          </Button>
        </form>
      )}

      {estado === "invalido" && (
        <Button asChild size="lg" className={authButtonClass}>
          <Link href="/ser-professor">Fazer novo pedido</Link>
        </Button>
      )}

      <p className="mt-8 text-center text-sm text-white/55">
        <Link href="/" className="inline-flex items-center gap-1 font-semibold hover:underline" style={{ color: EYK_GOLD }}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Voltar ao início
        </Link>
      </p>
    </AuthShell>
  );
}

export default function ConcluirCandidaturaPage() {
  return (
    <Suspense fallback={null}>
      <ConcluirCandidatura />
    </Suspense>
  );
}
