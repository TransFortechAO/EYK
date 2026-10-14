"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Estilo de perigo (ação irreversível) — botão de confirmar em vermelho. */
  destructive?: boolean;
  /**
   * Quando definido, só deixa confirmar depois de o utilizador escrever
   * exatamente este texto — substitui os antigos `window.prompt` de
   * confirmação (ex: apagar conta).
   */
  requireText?: string;
  /** Esconde o botão de cancelar — usar para substituir `window.alert`. */
  hideCancel?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

/**
 * Substitui `window.confirm`/`window.prompt` por uma caixa de diálogo própria
 * da plataforma. Uso: `const confirm = useConfirm(); if (!(await confirm({ title: "…" }))) return;`
 */
export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext);
}

/** Substitui `window.alert` — mostra uma mensagem com um único botão "OK". */
export function useAlertDialog(): (options: Omit<ConfirmOptions, "hideCancel">) => Promise<void> {
  const confirm = useConfirm();
  return useCallback(
    async (options) => {
      await confirm({ confirmLabel: "OK", ...options, hideCancel: true });
    },
    [confirm],
  );
}

type DialogState = ConfirmOptions & { open: boolean };

const ESTADO_INICIAL: DialogState = { open: false, title: "" };

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState>(ESTADO_INICIAL);
  const [texto, setTexto] = useState("");
  const resolveRef = useRef<(value: boolean) => void>(() => {});

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setTexto("");
      setState({ ...options, open: true });
    });
  }, []);

  const fechar = useCallback((valor: boolean) => {
    setState((prev) => ({ ...prev, open: false }));
    resolveRef.current(valor);
  }, []);

  const confirmacaoBloqueada = Boolean(state.requireText) && texto !== state.requireText;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={state.open} onOpenChange={(open) => !open && fechar(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {state.destructive && <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />}
              {state.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 p-5">
            {state.description && <DialogDescription>{state.description}</DialogDescription>}
            {state.requireText && (
              <Input
                autoFocus
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={`Escreve "${state.requireText}" para confirmar`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !confirmacaoBloqueada) fechar(true);
                }}
              />
            )}
          </div>
          <DialogFooter className="flex flex-row justify-end gap-2 space-y-0">
            {!state.hideCancel && (
              <Button variant="outline" onClick={() => fechar(false)}>
                {state.cancelLabel || "Cancelar"}
              </Button>
            )}
            <Button
              variant={state.destructive ? "destructive" : "default"}
              disabled={confirmacaoBloqueada}
              onClick={() => fechar(true)}
            >
              {state.confirmLabel || "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
