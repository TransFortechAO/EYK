"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

// Mesmo visual do cartão de login/registo (fundo escuro + dourado EYK), para
// as páginas públicas de conta: recuperar palavra-passe, confirmar email,
// verificar certificado.

export const EYK_GOLD = "#d4a24a";
export const EYK_GOLD_LIGHT = "#e2b45c";

export const authInputClass =
  "h-12 rounded-2xl bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/40 transition-all focus-visible:bg-white/[0.06] focus-visible:border-[#d4a24a]/50 focus-visible:ring-2 focus-visible:ring-[#d4a24a]/25";

export const authButtonClass =
  "w-full h-[52px] rounded-full text-base font-semibold shadow-[0_10px_30px_-10px_rgba(212,162,74,0.45)] transition-transform active:scale-[0.98]";

export function AuthShell({
  icon: Icon,
  etiqueta,
  titulo,
  descricao,
  children,
}: {
  icon: LucideIcon;
  etiqueta: string;
  titulo: string;
  descricao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative flex min-h-screen w-full flex-col items-center justify-center px-6 py-12"
      style={{ background: "#0a0a0a" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(212,162,74,0.14), transparent 60%)",
        }}
      />
      <Link href="/" className="relative mb-8" aria-label="Página inicial EYK">
        <span className="font-serif text-4xl font-bold tracking-tight" style={{ color: EYK_GOLD }}>
          EYK
        </span>
      </Link>
      <div className="relative w-full max-w-[460px] rounded-[28px] border border-white/[0.07] bg-white/[0.02] p-8 shadow-[0_0_0_1px_rgba(212,162,74,0.04),0_30px_60px_-30px_rgba(0,0,0,0.6)] backdrop-blur-sm animate-in fade-in slide-in-from-bottom-3 duration-700 sm:p-10">
        <div
          className="mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
          style={{ background: "rgba(212,162,74,0.1)", borderColor: "rgba(212,162,74,0.25)", color: EYK_GOLD_LIGHT }}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          <span className="text-[11px] font-bold uppercase tracking-[0.04em]">{etiqueta}</span>
        </div>
        <h1 className="mb-3 font-serif text-3xl font-bold text-white">{titulo}</h1>
        {descricao && <p className="mb-8 text-sm leading-relaxed text-white/60">{descricao}</p>}
        {children}
      </div>
    </div>
  );
}

export function AuthAlert({ tipo, children }: { tipo: "erro" | "sucesso"; children: React.ReactNode }) {
  const estilo =
    tipo === "erro"
      ? { background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)", color: "#fca5a5" }
      : { background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.25)", color: "#6ee7b7" };
  return (
    <div
      role={tipo === "erro" ? "alert" : "status"}
      className="flex items-start gap-2 rounded-xl border px-4 py-3 text-sm animate-in fade-in slide-in-from-top-1 duration-300"
      style={estilo}
    >
      <span className="leading-snug">{children}</span>
    </div>
  );
}

export function AuthSpinner({ texto }: { texto: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      {texto}
    </span>
  );
}
