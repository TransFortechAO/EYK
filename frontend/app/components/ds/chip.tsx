import { forwardRef, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Design System EYK — Chip (pílula pequena com ícone e valor).
 * Regra: no tema claro não tem borda nem sombra (só o fundo `surface`);
 * no tema escuro tem uma borda fina para se destacar do fundo.
 * Usado nas moedas e no streak da barra do topo, no "Instalar app", etc.
 * Ver docs/design-system.md.
 */
export const Chip = forwardRef<HTMLDivElement, ComponentProps<"div">>(function Chip({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-transparent bg-surface px-3 py-1.5 text-sm font-medium shadow-none dark:border-border/70",
        className,
      )}
      {...props}
    />
  );
});

/** Classes de um botão com aspeto de chip (para <Button className={CHIP_BOTAO}>). */
export const CHIP_BOTAO =
  "rounded-full border-transparent bg-surface shadow-none hover:bg-secondary dark:border-border/70";
