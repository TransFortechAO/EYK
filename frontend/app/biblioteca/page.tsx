"use client";

import { useState } from "react";
import { Hand, Video } from "lucide-react";
import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/eyk";
import { CampoPesquisaPagina, usePesquisaPagina } from "@/components/pesquisa-pagina";
import { normalizarTexto } from "@/components/filtros/barra-filtros";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lgaCategories, lgaSigns } from "@/lib/lga-data";
import { LGASign } from "@/components/lga-sign";
import { GestosValidadosBiblioteca } from "@/components/instituicao/escola";
import { Button } from "@/components/ui/button";

export default function BibliotecaPage() {
  const [cat, setCat] = useState("Todas");
  // A pesquisa está no topo (computador) ou na página (telemóvel/tablet) — ver pesquisa-pagina.tsx.
  const [q] = usePesquisaPagina();
  const list = lgaSigns.filter(
    (s) =>
      (cat === "Todas" || s.category === cat) &&
      (q.trim() === "" || normalizarTexto(s.term).includes(normalizarTexto(q.trim()))),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Biblioteca LGA"
        description="Consulta rápida de gestos da Língua Gestual Angolana — aprende ao teu ritmo."
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-surface/40 p-4">
        <p className="text-sm text-muted-foreground">Queres ajudar a preparar ferramentas de reconhecimento de LGA?</p>
        <Button asChild variant="outline" className="gap-2"><Link href="/contribuir-lga"><Video className="h-4 w-4" />Contribuir com um vídeo</Link></Button>
      </div>

      <CampoPesquisaPagina className="computador:hidden" />

      <Tabs value={cat} onValueChange={setCat}>
        <TabsList className="bg-surface flex-wrap h-auto py-1">
          {lgaCategories.map((c) => (
            <TabsTrigger key={c} value={c}>
              {c}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {list.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((sign) => (
            <LGASign key={sign.id} sign={sign} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Hand}
          title="Nenhum sinal encontrado."
          description="Tenta outra categoria ou ajusta a pesquisa."
        />
      )}

      {/* Gestos validados nas escolas parceiras (com variantes regionais). */}
      <GestosValidadosBiblioteca pesquisa={q} />
    </div>
  );
}
