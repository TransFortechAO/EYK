import { useState } from "react";
import { Play, Hand } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LgaMotion, LgaSign as LgaSignData } from "@/lib/lga-data";

const motionClass: Record<LgaMotion, string> = {
  static: "",
  wave: "lga-wave",
  tap: "lga-tap",
  circle: "lga-circle",
  updown: "lga-updown",
  twist: "lga-twist",
};

/**
 * Mostra um gesto LGA (pequeno, inline). `play` ativa a animação do movimento;
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

/**
 * Card completo de um sinal LGA para a Biblioteca — toca para animar.
 */
export function LGASign({ sign }: { sign: LgaSignData }) {
  const [play, setPlay] = useState(false);
  const trigger = () => {
    setPlay(true);
    setTimeout(() => setPlay(false), 1200);
  };

  return (
    <Card className="overflow-hidden shadow-soft transition-all hover:shadow-elevated group cursor-pointer" onClick={trigger}>
      <div className="relative aspect-square w-full bg-gradient-to-br from-surface to-primary/5 grid place-items-center">
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && trigger()}
          className="text-6xl sm:text-7xl select-none"
        >
          <LgaSign
            glyph={sign.glyph}
            motion={sign.motion}
            play={play}
            label={sign.term}
          />
        </div>
        <Badge className="absolute left-3 top-3 rounded-full bg-background/90 backdrop-blur text-foreground border-0">
          <Hand className="mr-1 h-3 w-3" />
          {sign.category}
        </Badge>
        <Button
          size="icon"
          variant="secondary"
          className="absolute right-3 top-3 h-8 w-8 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
          aria-label="Reproduzir gesto"
          onClick={(e) => {
            e.stopPropagation();
            trigger();
          }}
        >
          <Play className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-4 space-y-1">
        <p className="font-serif text-lg font-semibold leading-snug">{sign.term}</p>
        <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2em]">
          {sign.description}
        </p>
      </div>
    </Card>
  );
}