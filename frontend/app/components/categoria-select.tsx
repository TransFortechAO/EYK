"use client";

import { Check, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

type Props = {
  id: string;
  value: string;
  categorias: string[];
  placeholder?: string;
  onChange: (value: string) => void;
};

export function CategoriaSelect({ id, value, categorias, placeholder, onChange }: Props) {
  const [aberto, setAberto] = useState(false);
  const pesquisa = value.trim().replace(/^#/, "").trim();
  const resultados = useMemo(
    () => categorias.filter((categoria) => categoria.toLocaleLowerCase().includes(pesquisa.toLocaleLowerCase())),
    [categorias, pesquisa],
  );
  const nomeNovo = value.trim().startsWith("#") ? pesquisa : "";
  const existe = nomeNovo && categorias.some((categoria) => categoria.toLocaleLowerCase() === nomeNovo.toLocaleLowerCase());

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={aberto}
        aria-controls={`${id}-opcoes`}
        value={value}
        placeholder={placeholder}
        onFocus={() => setAberto(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setAberto(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setAberto(false);
          if (event.key === "Enter" && nomeNovo && !existe) {
            event.preventDefault();
            onChange(nomeNovo);
            setAberto(false);
          }
        }}
        onBlur={() => setAberto(false)}
      />
      {aberto && (
        <div id={`${id}-opcoes`} role="listbox" className="absolute inset-x-0 top-full z-[80] mt-1 overflow-hidden rounded-md border border-border/70 bg-popover p-1.5 text-popover-foreground shadow-xl">
          <div className="max-h-56 overflow-y-auto">
          {resultados.map((categoria) => (
            <button
              key={categoria}
              type="button"
              role="option"
              aria-selected={value === categoria}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(categoria);
                setAberto(false);
              }}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none"
            >
              <span>{categoria}</span>
              {value === categoria && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
          {nomeNovo && !existe && (
            <button
              type="button"
              role="option"
              aria-selected="false"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(nomeNovo);
                setAberto(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
            >
              <Plus className="h-4 w-4" />
              Criar categoria “{nomeNovo}”
            </button>
          )}
          {resultados.length === 0 && !nomeNovo && (
            <p className="px-3 py-2 text-sm text-muted-foreground">Sem resultados. Usa # para criar uma categoria.</p>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
