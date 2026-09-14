import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FileText, Trash2, Download } from 'lucide-react';
import { api, type CursoRecurso } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ListaRecursosProps {
  cursoId: number | string;
  podeEditar?: boolean;
  onAtualizado?: () => void;
}

export function ListaRecursos({ cursoId, podeEditar = false, onAtualizado }: ListaRecursosProps) {
  const [recursos, setRecursos] = useState<CursoRecurso[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [aApagar, setAapagar] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.listarRecursosCurso(cursoId);
      setRecursos(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar recursos.';
      toast.error(msg);
      setRecursos([]);
    } finally {
      setIsLoading(false);
    }
  }, [cursoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    onAtualizado?.();
  }, [recursos, onAtualizado]);

  const handleApagar = useCallback(
    async (id: number) => {
      if (aApagar !== null) return;
      setAapagar(id);
      try {
        await api.apagarRecursoCurso(cursoId, id);
        toast.success('Recurso removido.');
        setRecursos((prev) => prev.filter((r) => r.id !== id));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Falha ao apagar recurso.';
        toast.error(msg);
      } finally {
        setAapagar(null);
      }
    },
    [cursoId, aApagar],
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    );
  }

  if (recursos.length === 0) {
    return (
      <Card className="rounded-2xl border-dashed border-border/70 p-6 text-center bg-surface/30">
        <FileText className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
        <p className="text-sm font-medium text-foreground/80">Sem recursos disponíveis</p>
        <p className="text-xs text-muted-foreground mt-1">
          {podeEditar
            ? 'Adiciona PDFs para enriquecer o teu curso.'
            : 'Este curso ainda não tem materiais para download.'}
        </p>
      </Card>
    );
  }

  return (
    <ul className="space-y-2">
      {recursos.map((r) => (
        <li key={r.id}>
          <Card className="flex items-center gap-3 rounded-xl border-border/70 p-3 shadow-soft transition-colors hover:bg-surface/40">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{r.nome}</p>
              <p className="text-xs text-muted-foreground">
                {r.tipo.toUpperCase()} · {r.tamanhoMb.toFixed(2)} MB
                {r.criadoEm ? ` · ${new Date(r.criadoEm).toLocaleDateString('pt-PT')}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
              >
                <a
                  href={r.arquivoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar
                </a>
              </Button>
              {podeEditar && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => void handleApagar(r.id)}
                  disabled={aApagar === r.id}
                  aria-label="Apagar recurso"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
