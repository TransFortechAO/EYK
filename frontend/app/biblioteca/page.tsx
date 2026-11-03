"use client";

import { useState } from "react";
import { Hand } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/eyk";
import { CampoPesquisaPagina, usePesquisaPagina } from "@/components/pesquisa-pagina";
import { normalizarTexto } from "@/components/filtros/barra-filtros";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lgaCategories, lgaSigns } from "@/lib/lga-data";
import { LGASign } from "@/components/lga-sign";
import { GestosValidadosBiblioteca } from "@/components/instituicao/escola";

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
