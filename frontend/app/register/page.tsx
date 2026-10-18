"use client";

import { Suspense, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  UserPlus,
  Hand,
  BookOpen,
  Users,
  Trophy,
  User,
  Mail,
  Lock,
  ArrowRight,
  Check,
  X,
} from "lucide-react";
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

function forcaPassword(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

const NIVEIS_FORCA = [
  { label: "Fraca", color: "#ef4444" },
  { label: "Razoável", color: "#f59e0b" },
  { label: "Boa", color: "#eab308" },
  { label: "Forte", color: "#22c55e" },
  { label: "Muito forte", color: EYK_GOLD_LIGHT },
];

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

  const forca = useMemo(() => forcaPassword(password), [password]);
  const passwordsCoincidem =
    confirmPassword.length > 0 ? confirmPassword === password : null;

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
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2" style={{ background: EYK_BG }}>
      {/* Lado Esquerdo — Branding EYK */}
      <aside className="relative overflow-hidden px-8 py-12 lg:px-16 lg:py-20 flex flex-col justify-between border-r border-white/5">
        <div className="absolute inset-0 z-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/gif1.gif" alt="" aria-hidden className="h-full w-full object-cover" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(10,10,10,0.85) 0%, rgba(10,10,10,0.75) 40%, rgba(10,10,10,0.92) 100%)",
            }}
          />
        </div>

        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none z-[1]"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 85% 20%, " + EYK_GOLD_SOFT + ", transparent 55%)",
          }}
        />

        <div className="relative z-10 animate-in fade-in slide-in-from-left-2 duration-700">
          <Link href="/" className="inline-block mb-12" aria-label="Página inicial EYK">
            <span className="font-serif text-4xl font-bold tracking-tight" style={{ color: EYK_GOLD }}>
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
            <span className="text-[11px] font-bold tracking-[0.04em] uppercase">Língua Gestual Inclusiva</span>
          </div>

          <h1 className="font-serif font-bold text-white leading-[1.1] max-w-[420px] mb-6 text-4xl lg:text-[42px]">
            Junta-te a uma comunidade
            <em className="not-italic" style={{ color: EYK_GOLD_LIGHT }}>
              {" "}
              feita para ti.
            </em>
          </h1>

          <p className="text-sm max-w-[380px] leading-relaxed mb-10 text-white/60">
            Cria a tua conta e começa a aprender língua gestual com professores e uma comunidade de alunos surdos e
            ouvintes.
          </p>

          <ul className="space-y-3 max-w-[380px]">
            {[
              { icon: BookOpen, text: "Cursos em vídeo com intérprete LGP" },
              { icon: Users, text: "Comunidade de alunos e professores" },
              { icon: Trophy, text: "Gamificação: moedas, níveis e ranking" },
            ].map(({ icon: TheIcon, text }, i) => (
              <li
                key={text}
                className="flex items-start gap-3 text-white/75 animate-in fade-in slide-in-from-left-2"
                style={{ animationDelay: `${150 + i * 100}ms`, animationDuration: "600ms", animationFillMode: "backwards" }}
              >
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
          className="absolute -right-8 -bottom-8 w-60 h-60 opacity-[0.08] z-10"
          style={{ color: EYK_GOLD }}
        />
      </aside>

      {/* Lado Direito — Formulário */}
      <main className="flex items-center justify-center px-6 py-12 lg:px-16 lg:py-20">
        <div
          className="w-full max-w-[460px] rounded-[28px] border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-8 sm:p-10 shadow-[0_0_0_1px_rgba(212,162,74,0.04),0_30px_60px_-30px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-bottom-3 duration-700"
        >
          <h2 className="font-serif font-bold text-white text-3xl mb-3">Cria a tua conta.</h2>
          <p className="text-sm text-white/60 mb-9 leading-relaxed">
            Preenche os dados abaixo para começares a tua jornada na EYK.
          </p>

          <form onSubmit={handleSubmit} method="post" className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="username" className="text-white/85 text-sm">
                Nome de utilizador
              </Label>
              <div className="relative group">
                <User
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 group-focus-within:text-[color:var(--eyk-gold)] transition-colors"
                  style={{ ["--eyk-gold" as string]: EYK_GOLD }}
                  aria-hidden
                />
                <Input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={isPending}
                  className="h-12 rounded-2xl pl-11 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/40 transition-all focus-visible:bg-white/[0.06] focus-visible:border-[#d4a24a]/50 focus-visible:ring-2 focus-visible:ring-[#d4a24a]/25"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/85 text-sm">
                Email
              </Label>
              <div className="relative group">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 group-focus-within:text-[#d4a24a] transition-colors"
                  aria-hidden
                />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isPending}
                  className="h-12 rounded-2xl pl-11 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/40 transition-all focus-visible:bg-white/[0.06] focus-visible:border-[#d4a24a]/50 focus-visible:ring-2 focus-visible:ring-[#d4a24a]/25"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/85 text-sm">
                Palavra-passe
              </Label>
              <div className="relative group">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 group-focus-within:text-[#d4a24a] transition-colors"
                  aria-hidden
                />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isPending}
                  className="h-12 rounded-2xl pl-11 pr-12 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/40 transition-all focus-visible:bg-white/[0.06] focus-visible:border-[#d4a24a]/50 focus-visible:ring-2 focus-visible:ring-[#d4a24a]/25"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full text-white/45 hover:text-white/80 hover:bg-white/[0.05] transition"
                  aria-label={showPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
                </button>
              </div>

              {password.length > 0 && (
                <div className="pt-1 animate-in fade-in duration-300">
                  <div className="flex gap-1.5 mb-1.5">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-1 flex-1 rounded-full transition-colors duration-300"
                        style={{
                          background: i < forca ? NIVEIS_FORCA[forca - 1]?.color ?? "#ef4444" : "rgba(255,255,255,0.08)",
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-white/45">
                    Força:{" "}
                    <span style={{ color: NIVEIS_FORCA[Math.max(forca - 1, 0)].color }}>
                      {password.length < 8 ? "Mínimo 8 caracteres" : NIVEIS_FORCA[Math.max(forca - 1, 0)].label}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-white/85 text-sm">
                Confirmar palavra-passe
              </Label>
              <div className="relative group">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 group-focus-within:text-[#d4a24a] transition-colors"
                  aria-hidden
                />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isPending}
                  className={
                    "h-12 rounded-2xl pl-11 pr-12 bg-white/[0.04] text-white placeholder:text-white/40 transition-all focus-visible:bg-white/[0.06] focus-visible:ring-2 " +
                    (passwordsCoincidem === false
                      ? "border-red-500/40 focus-visible:border-red-500/50 focus-visible:ring-red-500/20"
                      : "border-white/[0.08] focus-visible:border-[#d4a24a]/50 focus-visible:ring-[#d4a24a]/25")
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full text-white/45 hover:text-white/80 hover:bg-white/[0.05] transition"
                  aria-label={showConfirmPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden />
                  )}
                </button>
              </div>
              {passwordsCoincidem !== null && (
                <p
                  className={
                    "flex items-center gap-1.5 text-xs animate-in fade-in duration-200 " +
                    (passwordsCoincidem ? "text-emerald-400/90" : "text-red-400/90")
                  }
                >
                  {passwordsCoincidem ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  {passwordsCoincidem ? "As palavras-passe coincidem" : "As palavras-passe não coincidem"}
                </p>
              )}
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2 px-4 py-3 rounded-xl border text-sm animate-in fade-in slide-in-from-top-1 duration-300"
                style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)", color: "#fca5a5" }}
              >
                <span className="font-semibold">!</span>
                <span className="leading-snug">{errorMsg}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={isPending}
              size="lg"
              className="group w-full h-[52px] rounded-full text-base font-semibold shadow-[0_10px_30px_-10px_rgba(212,162,74,0.45)] transition-transform active:scale-[0.98]"
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
                    <UserPlus className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                )}
              </span>
            </Button>

            <p className="text-center text-xs leading-relaxed text-white/45">
              Ao criar conta, aceitas os{" "}
              <Link href="/termos" target="_blank" className="underline-offset-2 hover:underline" style={{ color: EYK_GOLD }}>
                Termos de Utilização
              </Link>{" "}
              e a{" "}
              <Link href="/privacidade" target="_blank" className="underline-offset-2 hover:underline" style={{ color: EYK_GOLD }}>
                Política de Privacidade
              </Link>
              .
            </p>
          </form>

          <p className="mt-8 text-center text-sm text-white/55">
            Já tens conta?{" "}
            <Link href="/login" className="font-semibold hover:underline inline-flex items-center gap-1" style={{ color: EYK_GOLD }}>
              Iniciar sessão
              <ArrowRight className="w-3.5 h-3.5" aria-hidden />
            </Link>
          </p>

          <div className="mt-6 border-t border-white/[0.08] pt-6 text-center">
            <Link
              href="/ser-professor"
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