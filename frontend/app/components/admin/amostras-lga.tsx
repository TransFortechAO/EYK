"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { SectionHeader } from "@/components/eyk";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { API_BASE_URL, api, mensagemDeErro, type AmostraLGA } from "@/lib/api";

export function AmostrasLGA() {
  const [lista, setLista] = useState<AmostraLGA[] | null>(null);
  const carregar = () => api.plataforma.adminAmostrasLGA().then(setLista).catch(() => setLista([]));
  useEffect(() => { void carregar(); }, []);

  const rever = async (amostra: AmostraLGA, estado: AmostraLGA['estado']) => {
    try {
      await api.plataforma.reverAmostraLGA(amostra.id, estado);
      toast.success(estado === 'validada' ? 'Amostra validada.' : 'Amostra rejeitada.');
      await carregar();
    } catch (err) { toast.error(mensagemDeErro(err, 'Não foi possível rever a amostra.')); }
  };

  return (
    <section>
      <SectionHeader title="Amostras para investigação de LGA" />
      <Card className="space-y-4 p-6 shadow-soft">
        <p className="text-sm text-muted-foreground">Os vídeos desta fila são privados. Revê a qualidade do enquadramento e confirma o gesto com pessoas surdas utilizadoras de LGA antes de validar.</p>
        {lista?.length ? <ul className="grid gap-4 lg:grid-cols-2">{lista.map((a) => <li key={a.id} className="space-y-3 rounded-xl border border-border/70 p-4">
          <video controls playsInline preload="metadata" className="max-h-64 w-full rounded-lg bg-black" src={`${API_BASE_URL}/api/plataforma/admin/amostras-lga/${a.id}/`} />
          <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{a.palavra}{a.variante ? ` · ${a.variante}` : ''}</p><p className="text-xs text-muted-foreground">{a.autor} · {new Date(a.criadoEm).toLocaleString('pt-PT')}</p></div><Badge variant={a.estado === 'validada' ? 'default' : 'outline'}>{a.estadoLabel}</Badge></div>
          <p className="text-xs text-muted-foreground">Consentimento {a.consentimentoVersao} registado · {a.representanteConfirmado ? 'confirmação de maioridade/responsável registada' : 'sem confirmação'}</p>
          {a.estado === 'pendente' && <div className="flex justify-end gap-2"><Button variant="outline" className="gap-2" onClick={() => void rever(a, 'rejeitada')}><X className="h-4 w-4" />Rejeitar</Button><Button className="gap-2" onClick={() => void rever(a, 'validada')}><Check className="h-4 w-4" />Validar</Button></div>}
        </li>)}</ul> : <p className="text-sm text-muted-foreground">{lista ? 'Não há amostras na fila.' : 'A carregar…'}</p>}
      </Card>
    </section>
  );
}
