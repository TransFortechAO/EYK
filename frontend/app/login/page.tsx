"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Eye, EyeOff, LogIn, Hand, BookOpen, Users, Trophy, User, Lock, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

const EYK_GOLD = "#d4a24a";
const EYK_GOLD_LIGHT = "#e2b45c";
const EYK_GOLD_SOFT = "rgba(212, 162, 74, 0.18)";
const EYK_BG = "#0a0a0a";
const OTP_LENGTH = 6;

type Sancao = { mensagem: string; motivo: string; token: string | null };

/** Resposta 403 do login para contas suspensas/banidas (ver
 * `resposta_conta_sancionada` no backend). */
function sancaoDoErro(err: unknown): Sancao | null {
  const data = (err as { data?: { codigo?: string; error?: string; motivo?: string; tokenContestacao?: string | null } })?.data;
  if (data?.codigo !== "conta_suspensa" && data?.codigo !== "conta_banida") return null;
  return { mensagem: data.error || "A tua conta está suspensa.", motivo: data.motivo || "", token: data.tokenContestacao ?? null };
}

function AvisoSancao({ sancao }: { sancao: Sancao }) {
  return (
    <div
      role="alert"
      className="space-y-2 rounded-xl border px-4 py-3 text-sm animate-in fade-in slide-in-from-top-1 duration-300"
      style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)", color: "#fecaca" }}
    >
      <p className="font-semibold">{sancao.mensagem}</p>
      {sancao.motivo && <p className="text-white/70">Motivo: {sancao.motivo}</p>}
      {sancao.token && (
        <Link
          href={`/contestar?token=${encodeURIComponent(sancao.token)}`}
          className="inline-block font-semibold underline underline-offset-2"
          style={{ color: EYK_GOLD_LIGHT }}
        >
          Achas que foi um engano? Contestar a decisão
        </Link>
      )}
    </div>
  );
}

function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? "");

  const setDigit = (i: number, d: string) => {
    const clean = d.replace(/\D/g, "").slice(-1);
    const next = digits.slice();
    next[i] = clean;
    onChange(next.join(""));
    if (clean && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    refs.current[focusIndex]?.focus();
  };

  return (
    <div className="flex justify-between gap-2" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="h-14 w-12 sm:w-13 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white text-center text-xl font-semibold outline-none transition-all focus:bg-white/[0.06] focus:border-[#d4a24a]/50 focus:ring-2 focus:ring-[#d4a24a]/25"
        />
      ))}
    </div>
  );
}

export default function LoginPage() {
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [precisa2FA, setPrecisa2FA] = useState(false);
  const [codigo2FA, setCodigo2FA] = useState("");
  const [sancao, setSancao] = useState<Sancao | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setSancao(null);
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
        const sancaoConta = sancaoDoErro(err);
        if (sancaoConta) {
          setSancao(sancaoConta);
          return;
        }
        const status = (err as { status?: number })?.status;
        const msg = err instanceof Error ? err.message : "Erro ao iniciar sessão.";
        if (status === 401 || msg.includes("401") || msg.toLowerCase().includes("credencial")) {
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
        const sancaoConta = sancaoDoErro(err);
        if (sancaoConta) {
          setSancao(sancaoConta);
          return;
        }
        setErrorMsg(err instanceof Error ? err.message : "Erro ao verificar o código.");
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
            Aprende em língua gestual com uma comunidade
            <em className="not-italic" style={{ color: EYK_GOLD_LIGHT }}>
              {" "}
              para ti.
            </em>
          </h1>

          <p className="text-sm max-w-[380px] leading-relaxed mb-10 text-white/60">
            A EYK é uma escola especial em formato digital, pensada para alunos surdos e professores de língua
            gestual.
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
          key={precisa2FA ? "2fa" : "login"}
          className="w-full max-w-[460px] rounded-[28px] border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-8 sm:p-10 shadow-[0_0_0_1px_rgba(212,162,74,0.04),0_30px_60px_-30px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-bottom-3 duration-700"
        >
          {precisa2FA && (
            <div
              className="mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border"
              style={{ background: "rgba(212,162,74,0.1)", borderColor: "rgba(212,162,74,0.25)", color: EYK_GOLD_LIGHT }}
            >
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden />
              <span className="text-[11px] font-bold tracking-[0.04em] uppercase">Verificação em duas etapas</span>
            </div>
          )}

          <h2 className="font-serif font-bold text-white text-3xl mb-3">
            {precisa2FA ? "Confirma que és tu." : "Bem-vindo de volta."}
          </h2>
          <p className="text-sm text-white/60 mb-9 leading-relaxed">
            {precisa2FA
              ? "Introduz o código de 6 dígitos gerado pela tua app de autenticação."
              : "Introduz as tuas credenciais para entrares na tua área pessoal."}
          </p>

          {precisa2FA ? (
            <form onSubmit={handleSubmit2FA} method="post" className="space-y-7" noValidate>
              <div className="space-y-3">
                <Label className="text-white/85 text-sm">Código de verificação</Label>
                <OtpInput value={codigo2FA} onChange={setCodigo2FA} disabled={isPending} />
              </div>

              {sancao && <AvisoSancao sancao={sancao} />}
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
                className="w-full h-[52px] rounded-full text-base font-semibold shadow-[0_10px_30px_-10px_rgba(212,162,74,0.45)] transition-transform active:scale-[0.98]"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    A verificar…
                  </span>
                ) : (
                  "Confirmar código"
                )}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setPrecisa2FA(false);
                  setCodigo2FA("");
                  setErrorMsg(null);
                }}
                className="w-full text-center text-sm text-white/55 hover:text-white/80 hover:underline transition-colors"
              >
                Voltar ao login
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} method="post" className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="username" className="text-white/85 text-sm">
                  Nome de utilizador ou email
                </Label>
                <div className="relative group">
                  <User
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 group-focus-within:text-[#d4a24a] transition-colors"
                    aria-hidden
                  />
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="Nome de utilizador ou email"
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-white/85 text-sm">
                    Palavra-passe
                  </Label>
                  <Link href="/recuperar-senha" className="hit text-xs font-medium hover:underline text-white/55">
                    Esqueceste-te?
                  </Link>
                </div>
                <div className="relative group">
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 group-focus-within:text-[#d4a24a] transition-colors"
                    aria-hidden
                  />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
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
              </div>

              {sancao && <AvisoSancao sancao={sancao} />}
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
                      A entrar…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Entrar na plataforma
                      <LogIn className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  )}
                </span>
              </Button>
            </form>
          )}

          {!precisa2FA && (
            <p className="mt-8 text-center text-sm text-white/55">
              Ainda não tens conta?{" "}
              <Link href="/register" className="hit font-semibold hover:underline inline-flex items-center gap-1" style={{ color: EYK_GOLD }}>
                Criar conta agora
                <ArrowRight className="w-3.5 h-3.5" aria-hidden />
              </Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}