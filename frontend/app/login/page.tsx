"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  LogIn,
  Hand,
  BookOpen,
  Users,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, API_BASE_URL } from "@/lib/api";

const EYK_GOLD = "#d4a24a";
const EYK_GOLD_LIGHT = "#e2b45c"; // variante mais clara para texto sobre fundo escuro
const EYK_GOLD_SOFT = "rgba(212, 162, 74, 0.18)";
const EYK_BG = "#0a0a0a";

export default function LoginPage() {
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [precisa2FA, setPrecisa2FA] = useState(false);
  const [codigo2FA, setCodigo2FA] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!username.trim() || !password.trim()) {
      setErrorMsg("Preenche todos os campos.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await api.login(username.trim(), password);
        if (!res?.ok) {
          if (res?.requires2fa) {
            setPrecisa2FA(true);
            return;
          }
          setErrorMsg(res?.error || "Credenciais inválidas. Tenta novamente.");
          return;
        }
        window.location.assign("/inicio");
      } catch (err) {
        // Preferimos usar um status estruturado do wrapper `api`, se existir.
        // (ex: err.status === 401). Fica o fallback por texto como rede de segurança.
        const status = (err as { status?: number })?.status;
        const msg = err instanceof Error ? err.message : "Erro ao iniciar sessão.";
        if (
          status === 401 ||
          msg.includes("401") ||
          msg.toLowerCase().includes("credencial")
        ) {
          setErrorMsg("Nome de utilizador ou palavra-passe incorretos.");
        } else {
          setErrorMsg(msg);
        }
      }
    });
  };

  const handleSubmit2FA = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    if (codigo2FA.trim().length < 6) {
      setErrorMsg("Introduz o código de 6 dígitos.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await api.verificar2FA(codigo2FA.trim());
        if (!res?.ok) {
          setErrorMsg(res?.error || "Código inválido. Tenta novamente.");
          return;
        }
        window.location.assign("/inicio");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Erro ao verificar o código.");
      }
    });
  };

  return (
    <div
      className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2"
      style={{ background: EYK_BG }}
    >
      {/* Lado Esquerdo — Branding EYK */}
      <aside className="relative overflow-hidden px-8 py-12 lg:px-16 lg:py-20 flex flex-col justify-between border-r border-white/5">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 85% 20%, " +
              EYK_GOLD_SOFT +
              ", transparent 55%)",
          }}
        />

        <div className="relative z-10">
          <Link href="/" className="inline-block mb-12" aria-label="Página inicial EYK">
            <span
              className="font-serif text-4xl font-bold tracking-tight"
              style={{ color: EYK_GOLD }}
            >
              EYK
            </span>
            <span className="sr-only">Ekola Ya Kelela</span>
          </Link>

          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8 border"
            style={{
              background: "rgba(212,162,74,0.12)",
              borderColor: "rgba(212,162,74,0.28)",
              color: EYK_GOLD_LIGHT,
            }}
          >
            <Hand className="w-3.5 h-3.5" aria-hidden />
            <span className="text-[11px] font-bold tracking-[0.04em] uppercase">
              Língua Gestual Inclusiva
            </span>
          </div>

          <h1 className="font-serif font-bold text-white leading-[1.1] max-w-[420px] mb-6 text-4xl lg:text-[42px]">
            Aprende em língua gestual com uma comunidade
            <em className="not-italic" style={{ color: EYK_GOLD_LIGHT }}>
              {" "}
              para ti.
            </em>
          </h1>

          <p className="text-sm max-w-[380px] leading-relaxed mb-10 text-white/60">
            A EYK é uma escola especial em formato digital, pensada para alunos
            surdos e professores de língua gestual.
          </p>

          <ul className="space-y-3 max-w-[380px]">
            {[
              { icon: BookOpen, text: "Cursos em vídeo com intérprete LGP" },
              { icon: Users, text: "Comunidade de alunos e professores" },
              { icon: Trophy, text: "Gamificação: moedas, níveis e ranking" },
            ].map(({ icon: TheIcon, text }) => (
              <li key={text} className="flex items-start gap-3 text-white/75">
                <div
                  className="mt-0.5 w-5 h-5 shrink-0 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(212,162,74,0.15)", color: EYK_GOLD }}
                >
                  <TheIcon className="w-3.5 h-3.5" aria-hidden />
                </div>
                <span className="text-sm leading-snug">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <Hand
          aria-hidden
          className="absolute -right-8 -bottom-8 w-60 h-60 opacity-[0.08]"
          style={{ color: EYK_GOLD }}
        />
      </aside>

      {/* Lado Direito — Formulário */}
      <main className="flex items-center justify-center px-8 py-12 lg:px-16 lg:py-20">
        <div className="w-full max-w-[460px]">
          <h2 className="font-serif font-bold text-white text-3xl mb-3">
            {precisa2FA ? "Verificação em duas etapas." : "Bem-vindo de volta."}
          </h2>
          <p className="text-sm text-white/60 mb-10 leading-relaxed">
            {precisa2FA
              ? "Introduz o código de 6 dígitos gerado pela tua app de autenticação."
              : "Introduz as tuas credenciais para entrares na tua área pessoal."}
          </p>

          {precisa2FA ? (
            <form onSubmit={handleSubmit2FA} className="space-y-6" noValidate>
              <div className="space-y-2.5">
                <Label htmlFor="codigo2fa" className="text-white/85 text-sm">
                  Código de verificação
                </Label>
                <Input
                  id="codigo2fa"
                  name="codigo2fa"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  value={codigo2FA}
                  onChange={(e) => setCodigo2FA(e.target.value)}
                  required
                  disabled={isPending}
                  autoFocus
                  className="h-12 rounded-2xl bg-white/[0.04] border-white/[0.08] text-white text-center tracking-[0.4em] text-lg placeholder:text-white/55 focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]/40"
                />
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="flex items-start gap-2 px-4 py-3 rounded-xl border text-sm"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    borderColor: "rgba(239,68,68,0.25)",
                    color: "#fca5a5",
                  }}
                >
                  <span className="font-semibold">!</span>
                  <span className="leading-snug">{errorMsg}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={isPending}
                size="lg"
                className="w-full h-[52px] rounded-full text-base font-semibold shadow-[0_10px_30px_-10px_rgba(212,162,74,0.45)]"
              >
                {isPending ? "A verificar…" : "Confirmar código"}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setPrecisa2FA(false);
                  setCodigo2FA("");
                  setErrorMsg(null);
                }}
                className="w-full text-center text-sm text-white/55 hover:underline"
              >
                Voltar ao login
              </button>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div className="space-y-2.5">
              <Label htmlFor="username" className="text-white/85 text-sm">
                Nome de utilizador
              </Label>
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isPending}
                className="h-12 rounded-2xl bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/55 focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]/40"
              />
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-white/85 text-sm">
                  Palavra-passe
                </Label>
                <Link
                  href={API_BASE_URL + "/accounts/password_reset/"}
                  className="text-xs font-medium hover:underline text-white/55"
                >
                  Esqueceste-te?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isPending}
                  className="h-12 rounded-2xl pr-12 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/55 focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full text-white/45 hover:text-white/80 hover:bg-white/[0.04] transition"
                  aria-label={showPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden />
                  )}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2 px-4 py-3 rounded-xl border text-sm"
                style={{
                  background: "rgba(239,68,68,0.08)",
                  borderColor: "rgba(239,68,68,0.25)",
                  color: "#fca5a5",
                }}
              >
                <span className="font-semibold">!</span>
                <span className="leading-snug">{errorMsg}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={isPending}
              size="lg"
              className="w-full h-[52px] rounded-full text-base font-semibold shadow-[0_10px_30px_-10px_rgba(212,162,74,0.45)]"
            >
              <span aria-live="polite">
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    A entrar…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Entrar na plataforma
                    <LogIn className="w-4 h-4" aria-hidden />
                  </span>
                )}
              </span>
            </Button>
          </form>
          )}

          {!precisa2FA && (
            <p className="mt-8 text-center text-sm text-white/55">
              Ainda não tens conta?{" "}
              <Link
                href="/register"
                className="font-semibold hover:underline"
                style={{ color: EYK_GOLD }}
              >
                Criar conta agora
              </Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}