"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Hand, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, mensagemDeErro, type GestoLGA } from "@/lib/api";
import { SectionHeader } from "@/components/eyk";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useConfirm } from "@/components/confirm-dialog";

/**
 * Administração → Plataforma → Gestos de LGA. A equipa carrega o vídeo curto de
 * cada gesto (gravado com pessoas surdas) e marca-o como validado; só então aparece
 * ao lado das palavras na plataforma (ex.: títulos das páginas). Ver docs/lga-icones-palavras.md.
 */
export function GestosLGA() {
  const confirm = useConfirm();
  const [lista, setLista] = useState<GestoLGA[] | null>(null);
  const [palavra, setPalavra] = useState("");
  const [validadoPor, setValidadoPor] = useState("");
  const [validado, setValidado] = useState(false);
  const [video, setVideo] = useState<File | null>(null);
  const [aEnviar, setAEnviar] = useState(false);
  const ficheiroRef = useRef<HTMLInputElement>(null);

  const carregar = () => api.plataforma.listarGestos().then(setLista).catch(() => setLista([]));
  useEffect(() => {
    void carregar();
  }, []);

  const enviar = async () => {
    if (!palavra.trim() || !video || aEnviar) return;
    setAEnviar(true);
    try {
      await api.plataforma.enviarGesto({ palavra: palavra.trim(), video, validado, validadoPor });
      toast.success(`Gesto "${palavra.trim()}" guardado.`);
      setPalavra("");
      setValidadoPor("");
      setValidado(false);
      setVideo(null);
      await carregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível guardar o gesto."));
    } finally {
      setAEnviar(false);
    }
  };

  const alternarValidado = async (g: GestoLGA) => {
    try {
      await api.plataforma.atualizarGesto(g.id, { validado: !g.validado });
      await carregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível atualizar."));
    }
  };

  const apagar = async (g: GestoLGA) => {
    const ok = await confirm({ title: `Apagar o gesto "${g.palavra}"?`, confirmLabel: "Apagar", destructive: true });
    if (!ok) return;
    await api.plataforma.apagarGesto(g.id).catch(() => toast.error("Não foi possível apagar."));
    await carregar();
  };

  return (
    <section>
      <SectionHeader title="Gestos de LGA" />
      <Card className="space-y-5 p-6 shadow-soft">
        <p className="text-sm text-muted-foreground">
          Vídeo curto (1–2 s, sem som, MP4 ou WebM, até 20 MB) de cada gesto, gravado e confirmado por pessoas surdas
          que usam LGA. Aparece ao lado da palavra na plataforma (ex.: no título &quot;Cursos&quot;) só depois de validado.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input value={palavra} onChange={(e) => setPalavra(e.target.value)} placeholder='Palavra (ex: "Cursos", "Olá")' maxLength={60} />
          <Input value={validadoPor} onChange={(e) => setValidadoPor(e.target.value)} placeholder="Validado por (pessoa ou associação)" maxLength={120} />
          <div className="flex items-center gap-3">
            <input
              ref={ficheiroRef}
              type="file"
              accept="video/mp4,video/webm"
              className="hidden"
              onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
            />
            <Button type="button" variant="outline" className="gap-2" onClick={() => ficheiroRef.current?.click()}>
              <Upload className="h-4 w-4" /> {video ? video.name : "Escolher vídeo"}
            </Button>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={validado} onCheckedChange={setValidado} />
            Já validado pela comunidade surda
          </label>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => void enviar()} disabled={!palavra.trim() || !video || aEnviar} className="gap-2">
            <Hand className="h-4 w-4" /> {aEnviar ? "A guardar…" : "Guardar gesto"}
          </Button>
        </div>

        {lista && lista.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lista.map((g) => (
              <li key={g.id} className="flex items-center gap-3 rounded-xl border border-border/70 p-3">
                {g.video && (
                  <video src={g.video} className="h-16 w-16 shrink-0 rounded-lg bg-surface object-cover" muted loop playsInline autoPlay />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate font-medium">{g.palavra}</p>
                  {g.validado ? (
                    <Badge className="gap-1 bg-success/15 text-success"><CheckCircle2 className="h-3 w-3" /> Validado</Badge>
                  ) : (
                    <Badge variant="outline">Por validar</Badge>
                  )}
                  {g.validado_por && <p className="truncate text-xs text-muted-foreground">{g.validado_por}</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Switch checked={g.validado} onCheckedChange={() => void alternarValidado(g)} aria-label="Validado" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => void apagar(g)} aria-label="Apagar">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          lista && <p className="text-sm text-muted-foreground">Ainda não há gestos carregados.</p>
        )}
      </Card>
    </section>
  );
}
