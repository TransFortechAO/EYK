"use client";

import { useCallback, useEffect, useState, type ReactNode, type SelectHTMLAttributes } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ROTULO_PAPEL } from "@/lib/instituicoes/permissoes";
import type { Destinatarios, Grupo, Membro, Papel } from "@/lib/instituicoes/tipos";

// ── Formatação ──
// Datas e horas no fuso horário de Angola por omissão (especificação, 7).

export const FUSO = "Africa/Luanda";

export function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric", timeZone: FUSO });
}

export function dataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: FUSO });
}

export function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: FUSO });
}

/** "AAAA-MM-DD" do dia em Luanda. */
export function diaLuanda(data: Date | string) {
  return new Date(data).toLocaleDateString("en-CA", { timeZone: FUSO });
}

/** Valor de um <input type="datetime-local">, lido como hora de Angola (UTC+1, sem hora de verão). */
export function deInputLuanda(valor: string): string {
  return valor ? new Date(`${valor}:00+01:00`).toISOString() : "";
}

export function haQuanto(iso: string | null): string {
  if (!iso) return "nunca";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 0) {
    const dias = Math.round(-s / 86400);
    return dias <= 0 ? "hoje" : dias === 1 ? "amanhã" : `daqui a ${dias} dias`;
  }
  if (s < 60) return "agora mesmo";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

export function tamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function erroTexto(err: unknown, omissao = "Algo correu mal. Tenta de novo."): string {
  return err instanceof Error && err.message ? err.message : omissao;
}

// ── Carregamento ──

/** Carrega dados de uma função assíncrona, com estado de erro e recarregar. */
export function useCarregar<T>(carregar: () => Promise<T>, deps: unknown[]) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aCarregar, setACarregar] = useState(true);

  const executar = useCallback(async () => {
    setACarregar(true);
    setErro(null);
    try {
      setDados(await carregar());
    } catch (err) {
      setErro(erroTexto(err, "Não foi possível carregar."));
    } finally {
      setACarregar(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void executar();
  }, [executar]);

  return { dados, erro, aCarregar, recarregar: executar, setDados };
}

/** Executa uma ação com toast de sucesso/erro; devolve true se correu bem. */
export async function acao(fn: () => Promise<unknown>, sucesso?: string): Promise<boolean> {
  try {
    await fn();
    if (sucesso) toast.success(sucesso);
    return true;
  } catch (err) {
    toast.error(erroTexto(err));
    return false;
  }
}

export function Carregando({ texto = "A carregar…" }: { texto?: string }) {
  return <div className="py-16 text-center text-sm text-muted-foreground">{texto}</div>;
}

export function ErroCarregar({ erro, recarregar }: { erro: string; recarregar: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-3 p-8 text-center">
      <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />
      <p className="text-sm text-muted-foreground">{erro}</p>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={recarregar}>
        <RefreshCw className="h-4 w-4" /> Tentar de novo
      </Button>
    </Card>
  );
}

// ── Formulários ──

export const classeCampo =
  "flex h-9 pointer-coarse:min-h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function Seletor({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(classeCampo, "bg-card pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Campo({ id, rotulo, ajuda, erro, children }: { id: string; rotulo: string; ajuda?: string; erro?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium leading-none">
        {rotulo}
      </label>
      {children}
      {ajuda && !erro && <p className="text-xs text-muted-foreground">{ajuda}</p>}
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}

export function Caixa({
  id,
  checked,
  onChange,
  children,
  descricao,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  descricao?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3", disabled && "cursor-not-allowed opacity-60")}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{children}</span>
        {descricao && <span className="mt-0.5 block text-xs text-muted-foreground">{descricao}</span>}
      </span>
    </label>
  );
}

/** Escolha de destinatários: toda a instituição, um grupo ou uma pessoa. */
export function EscolherDestinatarios({
  id,
  valor,
  onChange,
  grupos,
  membros,
  podeInstituicao,
}: {
  id: string;
  valor: Destinatarios;
  onChange: (d: Destinatarios) => void;
  grupos: Grupo[];
  membros?: Membro[];
  podeInstituicao: boolean;
}) {
  const codigo = valor.tipo === "instituicao" ? "instituicao" : valor.tipo === "grupo" ? `grupo:${valor.grupoId}` : `pessoa:${valor.membroId}`;
  return (
    <Seletor
      id={id}
      value={codigo}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "instituicao") onChange({ tipo: "instituicao" });
        else if (v.startsWith("grupo:")) onChange({ tipo: "grupo", grupoId: v.slice(6) });
        else onChange({ tipo: "pessoa", membroId: v.slice(7) });
      }}
    >
      {podeInstituicao && <option value="instituicao">Toda a instituição</option>}
      {grupos.length > 0 && (
        <optgroup label="Grupos">
          {grupos.map((g) => (
            <option key={g.id} value={`grupo:${g.id}`}>
              {g.nome}
            </option>
          ))}
        </optgroup>
      )}
      {membros && membros.length > 0 && (
        <optgroup label="Pessoas">
          {membros.map((m) => (
            <option key={m.id} value={`pessoa:${m.id}`}>
              {m.nome} · {ROTULO_PAPEL[m.papel]}
            </option>
          ))}
        </optgroup>
      )}
    </Seletor>
  );
}

export function rotuloDestinatarios(d: Destinatarios, grupos: Grupo[], membros: Membro[] = []): string {
  if (d.tipo === "instituicao") return "Toda a instituição";
  if (d.tipo === "grupo") return grupos.find((g) => g.id === d.grupoId)?.nome ?? "Grupo";
  return membros.find((m) => m.id === d.membroId)?.nome ?? "Uma pessoa";
}

// ── Etiquetas ──

const TOM_PAPEL: Record<Papel, string> = {
  administrador: "bg-primary/15 text-primary",
  coordenador: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  educador: "bg-success/15 text-success",
  familia: "bg-streak/15 text-streak",
  aluno: "bg-secondary text-secondary-foreground",
};

export function EtiquetaPapel({ papel, className }: { papel: Papel; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", TOM_PAPEL[papel], className)}>
      {ROTULO_PAPEL[papel]}
    </span>
  );
}

export function Etiqueta({ tom = "neutro", children }: { tom?: "neutro" | "sucesso" | "aviso" | "perigo" | "marca"; children: ReactNode }) {
  const tons = {
    neutro: "bg-secondary text-secondary-foreground",
    sucesso: "bg-success/15 text-success",
    aviso: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    perigo: "bg-destructive/15 text-destructive",
    marca: "bg-primary/15 text-primary",
  } as const;
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", tons[tom])}>{children}</span>;
}

/**
 * O link do convite (o que segue por email/SMS): quem o abre, com sessão
 * iniciada, fica membro da escola com esta conta.
 */
export function LinkConvite({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);
  const link = typeof window === "undefined" ? `/instituicao/aderir?codigo=${codigo}` : `${window.location.origin}/instituicao/aderir?codigo=${codigo}`;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-surface p-2 text-left">
      <code className="min-w-0 flex-1 truncate text-xs">{link}</code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1500);
          } catch {
            /* o link está visível */
          }
        }}
      >
        {copiado ? "Copiado" : "Copiar link"}
      </Button>
    </div>
  );
}

/** Barra simples de proporção (armazenamento, leituras). */
export function Barra({ valor, max, rotulo }: { valor: number; max: number; rotulo: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((valor / max) * 100)) : 0;
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-secondary"
      role="progressbar"
      aria-label={rotulo}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn("h-full rounded-full", pct >= 90 ? "bg-destructive" : pct >= 75 ? "bg-amber-500" : "bg-primary")} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Linha de tabela em cartão, consistente com as páginas de administração. */
export function Tabela({ cabecalho, children }: { cabecalho: string[]; children: ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="min-w-full border-separate border-spacing-y-2 text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-muted-foreground">
            {cabecalho.map((c, i) => (
              <th key={i} className="py-2 pr-4 text-left font-medium last:pr-0">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const celula = "bg-surface/40 py-2.5 pr-4 align-middle first:rounded-l-xl first:pl-3 last:rounded-r-xl last:pr-3";
