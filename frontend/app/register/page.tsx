"use client";

import { Suspense, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, UserPlus, Hand, BookOpen, Users, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

const EYK_GOLD = "#d4a24a";
const EYK_GOLD_LIGHT = "#e2b45c";
const EYK_GOLD_SOFT = "rgba(212, 162, 74, 0.18)";
const EYK_BG = "#0a0a0a";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterConteudo />
    </Suspense>
  );
}

function RegisterConteudo() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref") || undefined;
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!username.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setErrorMsg("Preenche todos os campos.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("As palavras-passe não coincidem.");
      return;
    }
    if (password.length < 8) {
      setErrorMsg("A palavra-passe deve ter pelo menos 8 caracteres.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await api.register(username.trim(), email.trim(), password, ref);
        if (!res?.ok) {
          setErrorMsg(res?.error || "Não foi possível criar a conta. Tenta novamente.");
          return;
        }
        // `login` devolve `user` e autentica a sessão (cookie); assumimos que
        // `register` faz o mesmo, tal como o resto do padrão. Se o backend
        // exigir confirmação de email antes de autenticar, trocar para
        // window.location.assign("/login?registered=1") em vez desta linha.
        window.location.assign("/personalizar-perfil");
      } catch (err) {
        const status = (err as { status?: number })?.status;
        const msg = err instanceof Error ? err.message : "Erro ao criar conta.";
        if (status === 409 || msg.toLowerCase().includes("já existe") || msg.toLowerCase().includes("already")) {
          setErrorMsg("Já existe uma conta com este nome de utilizador ou email.");
        } else {
          setErrorMsg(msg);
        }
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
            Junta-te a uma comunidade
            <em className="not-italic" style={{ color: EYK_GOLD_LIGHT }}>
              {" "}
              feita para ti.
            </em>
          </h1>

          <p className="text-sm max-w-[380px] leading-relaxed mb-10 text-white/60">
            Cria a tua conta e começa a aprender língua gestual com professores
            e uma comunidade de alunos surdos e ouvintes.
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
            Cria a tua conta.
          </h2>
          <p className="text-sm text-white/60 mb-10 leading-relaxed">
            Preenche os dados abaixo para começares a tua jornada na EYK.
          </p>

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
              <Label htmlFor="email" className="text-white/85 text-sm">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isPending}
                className="h-12 rounded-2xl bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/55 focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]/40"
              />
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="password" className="text-white/85 text-sm">
                Palavra-passe
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
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

            <div className="space-y-2.5">
              <Label htmlFor="confirmPassword" className="text-white/85 text-sm">
                Confirmar palavra-passe
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isPending}
                  className="h-12 rounded-2xl pr-12 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/55 focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]/40"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full text-white/45 hover:text-white/80 hover:bg-white/[0.04] transition"
                  aria-label={
                    showConfirmPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"
                  }
                >
                  {showConfirmPassword ? (
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
                    A criar conta…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Criar conta
                    <UserPlus className="w-4 h-4" aria-hidden />
                  </span>
                )}
              </span>
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-white/55">
            Já tens conta?{" "}
            <Link
              href="/login"
              className="font-semibold hover:underline"
              style={{ color: EYK_GOLD }}
            >
              Iniciar sessão
            </Link>
          </p>

          <div className="mt-6 border-t border-white/[0.08] pt-6 text-center">
            <Link
              href="https://forms.gle/KEp7rH9QHuVwkNHA9"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-white/55 hover:text-white/80 hover:underline"
            >
              Quer ser professor no EYK?
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}