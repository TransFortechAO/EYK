"use client";

import { useEffect, useState } from "react";
import { Gavel } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DecisaoConteudo, Sancao } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type Decisao = {
  conteudo: DecisaoConteudo;
  sancao: Sancao | "levantar" | null;
  motivo: string;
  dias: number;
};

type Opcao<T> = { valor: T; label: string; descricao: string; perigo?: boolean };

function Opcoes<T extends string | null>({
  opcoes,
  valor,
  onChange,
  rotulo,
}: {
  opcoes: Opcao<T>[];
  valor: T;
  onChange: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="grid gap-2 sm:grid-cols-2">
      {opcoes.map((o) => (
        <button
          key={String(o.valor)}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          onClick={() => onChange(o.valor)}
          className={cn(
            "rounded-xl border px-3 py-2 text-left transition hover:bg-surface",
            valor === o.valor
              ? o.perigo
                ? "border-red-500 bg-red-500/5 ring-1 ring-red-500"
                : "border-primary bg-primary/5 ring-1 ring-primary"
              : "border-border",
          )}
        >
          <span className="block text-sm font-medium">{o.label}</span>
          <span className="block text-xs text-muted-foreground">{o.descricao}</span>
        </button>
      ))}
    </div>
  );
}

/** Decisão de moderação. Com `conteudo` (fila de denúncias): o que fazer ao
 * conteúdo + sanção opcional ao autor. Sem `conteudo` (lista de
 * utilizadores): só a sanção. */
export function DialogoDecisao({
  open,
  onOpenChange,
  titulo,
  descricao,
  conteudo,
  sancionado = false,
  onConfirmar,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  descricao?: string;
  /** Opções de conteúdo disponíveis (omitir = só sanções). */
  conteudo?: { ocultavel: boolean; apagavel: boolean; oculto: boolean };
  /** O utilizador já está suspenso/banido (mostra "Levantar sanção"). */
  sancionado?: boolean;
  onConfirmar: (decisao: Decisao) => Promise<boolean>;
}) {
  const [decConteudo, setDecConteudo] = useState<DecisaoConteudo>("manter");
  const [sancao, setSancao] = useState<Decisao["sancao"]>(null);
  const [motivo, setMotivo] = useState("");
  const [dias, setDias] = useState(7);
  const [aEnviar, setAEnviar] = useState(false);

  // Valores primitivos nas dependências: o pai pode passar um objeto
  // `conteudo` novo a cada render, o que apagaria o que já foi escrito.
  const temConteudo = Boolean(conteudo);
  const ocultavel = Boolean(conteudo?.ocultavel);
  const jaOculto = Boolean(conteudo?.oculto);
  useEffect(() => {
    if (!open) return;
    setDecConteudo(ocultavel && !jaOculto ? "ocultar" : "manter");
    setSancao(temConteudo ? null : "aviso");
    setMotivo("");
    setDias(7);
  }, [open, temConteudo, ocultavel, jaOculto]);

  const opcoesConteudo: Opcao<DecisaoConteudo>[] = [
    {
      valor: "manter",
      label: conteudo?.oculto ? "Manter oculto" : "Manter visível",
      descricao: "Sem sanção = as denúncias são rejeitadas.",
    },
  ];
  if (conteudo?.ocultavel && !conteudo.oculto) {
    opcoesConteudo.push({ valor: "ocultar", label: "Ocultar", descricao: "Deixa de aparecer a terceiros (fica como prova)." });
  }
  if (conteudo?.ocultavel && conteudo.oculto) {
    opcoesConteudo.push({ valor: "restaurar", label: "Repor", descricao: "Volta a aparecer — o conteúdo estava bem." });
  }
  if (conteudo?.apagavel) {
    opcoesConteudo.push({ valor: "apagar", label: "Apagar", descricao: "Remove de vez (fica o texto no registo).", perigo: true });
  }

  const opcoesSancao: Opcao<Decisao["sancao"]>[] = [
    ...(conteudo ? [{ valor: null, label: "Sem sanção", descricao: "O autor não é penalizado." }] : []),
    { valor: "aviso", label: "Aviso", descricao: "Avisos acumulados levam a suspensão automática." },
    { valor: "suspensao", label: "Suspender", descricao: "Sem acesso durante uns dias." },
    { valor: "banimento", label: "Banir", descricao: "Sem acesso de vez (pode contestar).", perigo: true },
    ...(sancionado ? [{ valor: "levantar" as const, label: "Levantar sanção", descricao: "Volta a ter acesso já." }] : []),
  ];

  const precisaMotivo = sancao !== null && sancao !== "levantar";

  const confirmar = async () => {
    setAEnviar(true);
    try {
      const ok = await onConfirmar({ conteudo: decConteudo, sancao, motivo: motivo.trim(), dias });
      if (ok) onOpenChange(false);
    } finally {
      setAEnviar(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {descricao && <DialogDescription>{descricao}</DialogDescription>}
          {conteudo && (
            <div className="space-y-2">
              <Label>Conteúdo</Label>
              <Opcoes rotulo="Decisão sobre o conteúdo" opcoes={opcoesConteudo} valor={decConteudo} onChange={setDecConteudo} />
            </div>
          )}

          <div className="space-y-2">
            <Label>{conteudo ? "Sanção ao autor" : "Sanção"}</Label>
            <Opcoes rotulo="Sanção" opcoes={opcoesSancao} valor={sancao} onChange={setSancao} />
          </div>

          {sancao === "suspensao" && (
            <div className="flex items-center gap-2">
              <Label htmlFor="dias-suspensao">Dias de suspensão</Label>
              <Input
                id="dias-suspensao"
                type="number"
                min={1}
                max={365}
                value={dias}
                onChange={(e) => setDias(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
                className="w-24"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="motivo-decisao">Motivo {precisaMotivo ? "(enviado ao utilizador)" : "(opcional, fica no registo)"}</Label>
            <Textarea
              id="motivo-decisao"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Ex: Insultos repetidos a outros alunos na comunidade."
            />
          </div>
        </div>

        <DialogFooter className="flex flex-row justify-end gap-2 space-y-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => void confirmar()}
            disabled={aEnviar || (precisaMotivo && !motivo.trim())}
            className={cn("gap-2", (sancao === "banimento" || decConteudo === "apagar") && "bg-red-600 text-white hover:bg-red-700")}
          >
            <Gavel className="h-4 w-4" /> {aEnviar ? "A aplicar…" : "Aplicar decisão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
