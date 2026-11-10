"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { SectionHeader } from "@/components/eyk";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, mediaUrl, mensagemDeErro, type FonteDatasetLGA } from "@/lib/api";

export function FontesDatasetLGA() {
  const [lista, setLista] = useState<FonteDatasetLGA[] | null>(null);
  const carregar = () => api.plataforma.adminFontesDatasetLGA().then(setLista).catch(() => setLista([]));
  useEffect(() => { void carregar(); }, []);

  const rever = async (fonte: FonteDatasetLGA, estado: 'aprovada' | 'rejeitada') => {
    const campoInicio = document.getElementById(`fonte-inicio-${fonte.id}`) as HTMLInputElement | null;
    const campoFim = document.getElementById(`fonte-fim-${fonte.id}`) as HTMLInputElement | null;
    const campoPalavra = document.getElementById(`fonte-palavra-${fonte.id}`) as HTMLInputElement | null;
    const campoNota = document.getElementById(`fonte-nota-${fonte.id}`) as HTMLInputElement | null;
    try {
      await api.plataforma.reverFonteDatasetLGA(fonte.id, {
        estado,
        palavra: campoPalavra?.value.trim(),
        inicioSegundos: campoInicio?.value ? Number(campoInicio.value) : null,
        fimSegundos: campoFim?.value ? Number(campoFim.value) : null,
        notaRevisao: campoNota?.value.trim(),
      });
      toast.success(estado === 'aprovada' ? 'Fonte incluída no dataset.' : 'Sugestão rejeitada.');
      await carregar();
    } catch (err) { toast.error(mensagemDeErro(err, 'Não foi possível rever o vídeo.')); }
  };

  return (
    <section>
      <SectionHeader title="Vídeos e aulas sugeridos para o dataset LGA" />
      <Card className="space-y-4 p-6 shadow-soft">
        <p className="text-sm text-muted-foreground">O sistema sugere apenas conteúdo publicado, alojado na EYK e autorizado pelo professor. A pontuação considera relevância para LGA, legendas, duração e contexto de curso. Antes de incluir uma fonte, confirma o gesto e anota a palavra e, se necessário, o intervalo do vídeo.</p>
        {lista?.length ? <ul className="grid gap-4 lg:grid-cols-2">{lista.map((f) => {
          const src = mediaUrl(f.videoUrl);
          return <li key={f.id} className="space-y-3 rounded-xl border border-border/70 p-4">
            {src && <video controls playsInline preload="metadata" className="max-h-64 w-full rounded-lg bg-black" src={src} />}
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-medium">{f.titulo}</p><p className="text-xs text-muted-foreground">{f.professor}{f.curso ? ` · Curso: ${f.curso}` : ''} · {Math.floor(f.duracaoSegundos / 60)}:{String(f.duracaoSegundos % 60).padStart(2, '0')}</p></div><Badge variant={f.estado === 'aprovada' ? 'default' : 'outline'}>{f.estado} · {f.pontuacao} pts</Badge></div>
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">{f.motivos.map((motivo) => <li key={motivo}>{motivo}</li>)}</ul>
            <p className="text-xs text-muted-foreground">Consentimento {f.consentimentoVersao} · {new Date(f.consentimentoEm).toLocaleDateString('pt-PT')}{f.temLegenda ? ' · legendas disponíveis' : ''}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input id={`fonte-palavra-${f.id}`} defaultValue={f.palavra} placeholder="Palavra/gesto visível" maxLength={60} aria-label="Palavra ou gesto" />
              <Input id={`fonte-inicio-${f.id}`} type="number" min={0} max={f.duracaoSegundos} defaultValue={f.inicioSegundos ?? ''} placeholder="Início (s), opcional" aria-label="Início em segundos" />
              <Input id={`fonte-fim-${f.id}`} type="number" min={0} max={f.duracaoSegundos} defaultValue={f.fimSegundos ?? ''} placeholder="Fim (s), opcional" aria-label="Fim em segundos" />
            </div>
            <Input id={`fonte-nota-${f.id}`} defaultValue={f.notaRevisao} placeholder="Nota de revisão (opcional)" maxLength={500} />
            {f.estado === 'sugerida' && <div className="flex justify-end gap-2"><Button variant="outline" className="gap-2" onClick={() => void rever(f, 'rejeitada')}><X className="h-4 w-4" />Rejeitar</Button><Button className="gap-2" onClick={() => void rever(f, 'aprovada')}><Check className="h-4 w-4" />Incluir no dataset</Button></div>}
          </li>;
        })}</ul> : <p className="text-sm text-muted-foreground">{lista ? 'Ainda não há vídeos elegíveis. Os professores podem autorizar a seleção nas definições dos seus vídeos e cursos.' : 'A procurar conteúdo autorizado…'}</p>}
        {lista?.some((f) => f.estado === 'aprovada') && <p className="flex items-center gap-2 text-xs text-muted-foreground"><ExternalLink className="h-3.5 w-3.5" />Os vídeos aprovados ficam referenciados ao original; a EYK não cria cópias públicas.</p>}
      </Card>
    </section>
  );
}
