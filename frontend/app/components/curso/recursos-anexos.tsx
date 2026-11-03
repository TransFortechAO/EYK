"use client";

import { Download, FileText } from "lucide-react";
import { mediaUrl, type CursoRecurso } from "@/lib/api";
import { Card } from "@/components/ui/card";

/**
 * Recursos (PDFs, exercícios…) que o professor juntou a um vídeo ou a uma aula.
 * Ficam por baixo do vídeo — não dentro do player, para não tapar os controlos.
 */
export function RecursosAnexos({ recursos, titulo = "Recursos" }: { recursos: CursoRecurso[]; titulo?: string }) {
  if (recursos.length === 0) return null;
  return (
    <Card className="space-y-2 p-4 shadow-soft">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <FileText className="h-4 w-4 text-primary" /> {titulo}
      </h2>
      <ul className="divide-y divide-border/60">
        {recursos.map((r) => (
          <li key={r.id}>
            <a
              href={mediaUrl(r.arquivoUrl) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="flex items-center gap-3 py-2 text-sm transition-colors hover:text-primary"
            >
              <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{r.nome}</span>
              {r.tamanhoMb > 0 && <span className="shrink-0 text-xs text-muted-foreground">{r.tamanhoMb.toFixed(1)} MB</span>}
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}
