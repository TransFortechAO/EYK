import { cn } from "@/lib/utils";
import type { LgaMotion } from "@/lib/lga-data";

const motionClass: Record<LgaMotion, string> = {
  static: "",
  wave: "lga-wave",
  tap: "lga-tap",
  circle: "lga-circle",
  updown: "lga-updown",
  twist: "lga-twist",
};

/**
 * Mostra um gesto LGA. `play` ativa a animação do movimento;
 * quando `hoverPlay`, a animação corre no hover/focus do contentor pai (.group).
 */
export function LgaSign({
  glyph,
  motion = "static",
  play = false,
  hoverPlay = false,
  className,
  label,
}: {
  glyph: string;
  motion?: LgaMotion;
  play?: boolean;
  hoverPlay?: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "inline-block select-none leading-none",
        hoverPlay && "lga-hover",
        (play || hoverPlay) && motionClass[motion],
        className,
      )}
    >
      {glyph}
    </span>
  );
}