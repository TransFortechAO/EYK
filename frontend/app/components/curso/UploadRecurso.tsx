import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Upload, X } from 'lucide-react';
import { api, type CursoRecurso } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';

interface UploadRecursoProps {
  cursoId: number | string;
  onAdicionado?: (recurso: CursoRecurso) => void;
  onCancelar?: () => void;
}

const TAMANHO_MAX_MB = 50;

export function UploadRecurso({ cursoId, onAdicionado, onCancelar }: UploadRecursoProps) {
  const [nome, setNome] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!arquivo) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(arquivo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!nome.trim() || !arquivo) {
        toast.error('Preenche o nome e seleciona um ficheiro PDF.');
        return;
      }
      if (arquivo.size > TAMANHO_MAX_MB * 1024 * 1024) {
        toast.error(`O ficheiro deve ter no máximo ${TAMANHO_MAX_MB}MB.`);
        return;
      }
      const ext = arquivo.name.split('.').pop()?.toLowerCase();
      if (ext !== 'pdf') {
        toast.error('Apenas são aceites ficheiros PDF.');
        return;
      }

      setIsLoading(true);
      try {
        const recurso = await api.adicionarRecursoCurso(cursoId, {
          nome: nome.trim(),
          arquivo,
          tipo: 'pdf',
        });
        toast.success('Recurso adicionado com sucesso!');
        setNome('');
        setArquivo(null);
        onAdicionado?.(recurso);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Falha ao enviar o recurso.';
        toast.error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [nome, arquivo, cursoId, onAdicionado],
  );

  return (
    <Card className="space-y-4 rounded-2xl border-border/70 p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-foreground">Adicionar recurso (PDF)</h4>
        {onCancelar && (
          <Button type="button" variant="ghost" size="icon" onClick={onCancelar} aria-label="Cancelar">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="recurso-nome">Nome do recurso</Label>
          <Input
            id="recurso-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Apostila de Matemática"
            disabled={isLoading}
          />
        </div>

        <div>
          <Label htmlFor="recurso-arquivo">Ficheiro PDF (máx. {TAMANHO_MAX_MB}MB)</Label>
          <Input
            id="recurso-arquivo"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => setArquivo(e.target.files?.[0] || null)}
            disabled={isLoading}
          />
        </div>

        {previewUrl && (
          <div className="border rounded-lg overflow-hidden bg-surface/40">
            <div className="text-xs text-muted-foreground px-3 py-2 border-b flex items-center justify-between">
              <span>Pré-visualização</span>
              <span>{arquivo ? `${(arquivo.size / (1024 * 1024)).toFixed(2)} MB` : ''}</span>
            </div>
            <iframe
              src={previewUrl}
              className="w-full h-64 bg-white"
              title="Pré-visualização do PDF"
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          {onCancelar && (
            <Button type="button" variant="ghost" onClick={onCancelar} disabled={isLoading}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={isLoading || !nome.trim() || !arquivo}>
            <Upload className="h-4 w-4 mr-2" />
            {isLoading ? 'A enviar…' : 'Enviar recurso'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
