"use client";

import { useState } from "react";
import { Hand, Search } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/eyk";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lgaCategories, lgaSigns } from "@/lib/lga-data";
import { LGASign } from "@/components/lga-sign";
import { GestosValidadosBiblioteca } from "@/components/instituicao/escola";

export default function BibliotecaPage() {
  const [cat, setCat] = useState("Todos");
  const [q, setQ] = useState("");
  const list = lgaSigns.filter(
    (s) =>
      (cat === "Todos" || s.category === cat) &&
      (q.trim() === "" || s.term.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Biblioteca LGA"
        description="Consulta rápida de gestos da Língua Gestual Angolana — aprende ao teu ritmo."
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar termo, palavra, frase..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 bg-surface"
          />
        </div>
      </div>

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
