"use client";

import { useRef, useState } from "react";
import { Captions, X } from "lucide-react";
import { toast } from "sonner";
import { api, mensagemDeErro } from "@/lib/api";

/** Carregar/substituir/remover as legendas (.vtt ou .srt) de um vídeo do
 * professor — avulso ou aula de curso. */
export function BotaoLegendas({
  videoId,
  temLegenda,
  onChange,
  disabled,
}: {
  videoId: number;
  temLegenda: boolean;
  onChange: (temLegenda: boolean) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [aEnviar, setAEnviar] = useState(false);

  const enviar = async (ficheiro: File) => {
    setAEnviar(true);
    try {
      const res = await api.professor.carregarLegenda(videoId, ficheiro);
      onChange(res.tem_legenda);
      toast.success("Legendas carregadas.");
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível carregar as legendas."));
    } finally {
      setAEnviar(false);
    }
  };

  const remover = async () => {
    setAEnviar(true);
    try {
      await api.professor.removerLegenda(videoId);
      onChange(false);
      toast.success("Legendas removidas.");
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível remover as legendas."));
    } finally {
      setAEnviar(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1">
      <input
        ref={inputRef}
        type="file"
        accept=".vtt,.srt,text/vtt"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void enviar(f);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || aEnviar}
        className={
          temLegenda
            ? "inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-600 transition hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-300"
            : "inline-flex items-center gap-1 rounded-md border border-dashed border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground transition hover:border-amber-400/60 hover:text-foreground disabled:opacity-50"
        }
        title="Ficheiro .vtt ou .srt (até 1MB)"
      >
        <Captions className="h-3 w-3" />
        {aEnviar ? "A enviar…" : temLegenda ? "Legendas ✓ (substituir)" : "Legendas (.vtt/.srt)"}
      </button>
      {temLegenda && (
        <button
          type="button"
          onClick={() => void remover()}
          disabled={disabled || aEnviar}
          className="text-red-400 hover:text-red-300 disabled:opacity-50"
          aria-label="Remover legendas"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
