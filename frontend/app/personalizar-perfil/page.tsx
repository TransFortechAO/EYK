"use client";

import { useState, useTransition } from "react";
import { Hand, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth-gate";

const EYK_GOLD = "#d4a24a";
const EYK_GOLD_LIGHT = "#e2b45c";
const EYK_GOLD_SOFT = "rgba(212, 162, 74, 0.18)";
const EYK_BG = "#0a0a0a";

export default function PersonalizarPerfilPage() {
  const { user } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [bio, setBio] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const firstName = user?.name?.split(" ")[0] || "";

  const concluir = () => {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        if (bio.trim()) {
          await api.perfil.atualizarAluno(bio.trim());
        }
        await api.perfil.completar();
        window.location.assign("/inicio");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Erro ao guardar o perfil.");
      }
    });
  };

  const saltar = () => {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await api.perfil.completar();
      } catch {
        /* mesmo que falhe, não bloqueia o acesso à plataforma */
      }
      window.location.assign("/inicio");
    });
  };

  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6 py-12"
      style={{ background: EYK_BG }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 70% 60% at 50% 0%, ${EYK_GOLD_SOFT}, transparent 55%)`,
        }}
      />

      <div className="relative z-10 w-full max-w-[520px] text-center">
        <div
          className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl text-black"
          style={{ background: `linear-gradient(135deg, ${EYK_GOLD}, ${EYK_GOLD_LIGHT})` }}
        >
          <Hand className="h-6 w-6" aria-hidden />
        </div>

        <div
          className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
          style={{
            background: "rgba(212,162,74,0.12)",
            borderColor: "rgba(212,162,74,0.28)",
            color: EYK_GOLD_LIGHT,
          }}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          <span className="text-[11px] font-bold uppercase tracking-[0.04em]">
            Último passo
          </span>
        </div>

        <h1 className="mb-3 font-serif text-3xl font-bold text-white lg:text-4xl">
          {firstName ? `Bem-vindo, ${firstName}.` : "Bem-vindo à EYK."}
        </h1>
        <p className="mx-auto mb-10 max-w-[420px] text-sm leading-relaxed text-white/60">
          Conta-nos um pouco sobre ti antes de começares. Podes sempre alterar isto mais
          tarde nas Configurações.
        </p>

        <div className="space-y-2.5 text-left">
          <Label htmlFor="bio" className="text-white/85 text-sm">
            Sobre ti (opcional)
          </Label>
          <Textarea
            id="bio"
            name="bio"
            placeholder="Ex: Sou aluna de 2º ano, interessada em ciências e a aprender língua gestual desde 2024."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            disabled={isPending}
            rows={4}
            className="rounded-2xl bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]/40"
          />
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-2 rounded-xl border px-4 py-3 text-left text-sm"
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

        <div className="mt-10 flex flex-col items-center gap-4">
          <Button
            onClick={concluir}
            disabled={isPending}
            size="lg"
            className="h-[52px] w-full max-w-[320px] rounded-full text-base font-semibold shadow-[0_10px_30px_-10px_rgba(212,162,74,0.45)]"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                A concluir…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Concluir
                <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            )}
          </Button>

          <button
            type="button"
            onClick={saltar}
            disabled={isPending}
            className="text-sm text-white/50 hover:text-white/80 hover:underline disabled:opacity-50"
          >
            Saltar por agora
          </button>
        </div>
      </div>
    </div>
  );
}
