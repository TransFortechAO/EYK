"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, LogOut } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

const EYK_GOLD = "#d4a24a";
const EYK_GOLD_LIGHT = "#e2b45c";

/**
 * Primeiro acesso de uma conta criada por um administrador: a senha que veio
 * por email é temporária e tem de ser trocada antes de usar a plataforma.
 */
export default function DefinirSenhaPage() {
  const { user } = useAuth();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  const firstName = user?.name?.split(" ")[0] || user?.username || "";

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!atual) return setErro("Indica a senha temporária que recebeste por email.");
    if (nova.length < 8) return setErro("A nova senha deve ter pelo menos 8 caracteres.");
    if (nova === atual) return setErro("A nova senha tem de ser diferente da temporária.");
    if (nova !== confirmar) return setErro("As senhas novas não coincidem.");

    setAGuardar(true);
    try {
      const res = await api.seguranca.alterarSenha(atual, nova);
      if (!res?.ok) throw new Error(res?.error || "Não foi possível alterar a senha.");
      window.location.assign("/inicio");
    } catch (err) {
      const data = (err as { data?: { error?: string } })?.data;
      setErro(data?.error || (err instanceof Error ? err.message : "Erro ao alterar a senha."));
      setAGuardar(false);
    }
  };

  const sair = async () => {
    try {
      await api.logout();
    } finally {
      window.location.assign("/login");
    }
  };

  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center px-6 py-12"
      style={{ background: "#0a0a0a" }}
    >
      <div className="relative z-10 w-full max-w-[440px]">
        <div
          className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl text-black"
          style={{ background: `linear-gradient(135deg, ${EYK_GOLD}, ${EYK_GOLD_LIGHT})` }}
        >
          <KeyRound className="h-6 w-6" aria-hidden />
        </div>

        <h1 className="mb-2 text-center font-serif text-3xl font-bold text-white">
          {firstName ? `Bem-vindo(a), ${firstName}.` : "Bem-vindo(a) à EYK."}
        </h1>
        <p className="mb-8 text-center text-sm leading-relaxed text-white/60">
          Por segurança, escolhe agora uma senha só tua. A senha temporária que recebeste por
          email deixa de funcionar depois disto.
        </p>

        <form onSubmit={submeter} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="ds-atual" className="text-white/85 text-sm">Senha temporária</Label>
            <PasswordInput
              id="ds-atual"
              value={atual}
              onChange={(e) => setAtual(e.target.value)}
              autoComplete="current-password"
              disabled={aGuardar}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ds-nova" className="text-white/85 text-sm">Nova senha</Label>
            <PasswordInput
              id="ds-nova"
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              autoComplete="new-password"
              placeholder="Mínimo de 8 caracteres"
              disabled={aGuardar}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ds-confirmar" className="text-white/85 text-sm">Repetir a nova senha</Label>
            <PasswordInput
              id="ds-confirmar"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              autoComplete="new-password"
              disabled={aGuardar}
            />
          </div>

          {erro && (
            <div
              role="alert"
              className="rounded-xl border px-4 py-3 text-sm"
              style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)", color: "#fca5a5" }}
            >
              {erro}
            </div>
          )}

          <Button type="submit" size="lg" disabled={aGuardar} className="h-[52px] w-full rounded-full text-base font-semibold">
            {aGuardar ? "A guardar…" : "Guardar e entrar"}
          </Button>
        </form>

        <button
          type="button"
          onClick={sair}
          className="mx-auto mt-6 flex items-center gap-2 text-sm text-white/50 hover:text-white/80 hover:underline"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sair
        </button>
      </div>
    </div>
  );
}
