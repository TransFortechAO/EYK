"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Hand, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, SectionHeader } from "@/components/eyk";
import { api, mensagemDeErro, type RecolhaLGA } from "@/lib/api";

export default function ContribuirLgaPage() {
  const [dados, setDados] = useState<RecolhaLGA | null>(null);
  const [palavra, setPalavra] = useState("");
  const [variante, setVariante] = useState("");
  const [video, setVideo] = useState<File | null>(null);
  const [consentimento, setConsentimento] = useState(false);
  const [representante, setRepresentante] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  const ficheiro = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => video ? URL.createObjectURL(video) : null, [video]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const carregar = () => api.plataforma.recolhaLGA().then(setDados).catch(() => toast.error("Não foi possível carregar a recolha."));
  useEffect(() => { void carregar(); }, []);

  const enviar = async () => {
    if (!dados || !palavra || !video || !consentimento || !representante || aEnviar) return;
    setAEnviar(true);
    try {
      await api.plataforma.enviarAmostraLGA({ palavra, variante, video, consentimentoVersao: dados.versaoConsentimento });
      toast.success("Amostra enviada para revisão. Obrigado pela contribuição!");
      setVideo(null);
      setConsentimento(false);
      setRepresentante(false);
      if (ficheiro.current) ficheiro.current.value = "";
      await carregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível enviar a amostra."));
    } finally {
      setAEnviar(false);
    }
  };

  const apagar = async (id: number) => {
    try {
      await api.plataforma.apagarAmostraLGA(id);
      toast.success("Amostra apagada.");
      await carregar();
    } catch (err) { toast.error(mensagemDeErro(err, "Não foi possível apagar a amostra.")); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader title="Contribuir para a IA de LGA" description="Ajuda a preparar exemplos de palavras em Língua Gestual Angolana para investigação e desenvolvimento de ferramentas de reconhecimento." />

      <Card className="space-y-5 p-6 shadow-soft">
        <div>
          <h2 className="font-semibold">Contribuição voluntária</h2>
          <p className="mt-1 text-sm text-muted-foreground">Escolhe uma palavra e envia um vídeo curto com o gesto. A contribuição não é necessária para usar a EYK.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="palavra-lga">Palavra a gestuar</Label>
            <select id="palavra-lga" value={palavra} onChange={(e) => setPalavra(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Seleciona uma palavra</option>
              {dados?.palavras.map((p) => <option key={p.nome} value={p.nome}>{p.nome} · {p.amostrasValidadas} exemplos validados</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="variante-lga">Província ou variante regional (opcional)</Label>
            <Input id="variante-lga" value={variante} onChange={(e) => setVariante(e.target.value)} maxLength={80} placeholder="Ex.: Luanda" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="video-lga">Vídeo do gesto</Label>
          <input ref={ficheiro} id="video-lga" type="file" accept="video/mp4,video/webm,video/quicktime" capture="user" className="sr-only" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} />
          <Button type="button" variant="outline" className="gap-2" onClick={() => ficheiro.current?.click()}><Upload className="h-4 w-4" />{video ? video.name : "Gravar ou escolher vídeo"}</Button>
          <p className="text-xs text-muted-foreground">MP4, WebM ou MOV · máximo 40 MB. Grava a pessoa e as mãos com boa luz e sem outras pessoas no enquadramento.</p>
          {preview && <video controls playsInline className="mt-3 max-h-64 rounded-lg bg-black" src={preview} />}
        </div>

        <div className="space-y-3 rounded-xl border border-border/70 p-4 text-sm">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-1 accent-primary" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} />
            <span>Autorizo voluntariamente a EYK/Transfortech a guardar este vídeo e os dados da palavra e variante para desenvolver e avaliar sistemas de reconhecimento de LGA. Compreendo que o vídeo fica privado, acessível apenas a pessoas autorizadas para revisão, e que a minha contribuição não será publicada no gestuário.</span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-1 accent-primary" checked={representante} onChange={(e) => setRepresentante(e.target.checked)} />
            <span>Confirmo que sou maior de idade ou que tenho autorização do responsável legal da pessoa filmada.</span>
          </label>
          <p className="text-xs text-muted-foreground">Podes retirar a amostra a qualquer momento apagando-a abaixo. O vídeo só entra no conjunto de investigação depois de revisto.</p>
        </div>

        <div className="flex justify-end"><Button onClick={() => void enviar()} disabled={!palavra || !video || !consentimento || !representante || aEnviar} className="gap-2"><Hand className="h-4 w-4" />{aEnviar ? "A enviar…" : "Enviar amostra"}</Button></div>
      </Card>

      <section className="space-y-4">
        <SectionHeader title="As minhas contribuições" />
        {dados?.amostras.length ? <ul className="space-y-2">{dados.amostras.map((a) => <li key={a.id} className="flex items-center gap-3 rounded-xl border border-border/70 p-4"><div className="min-w-0 flex-1"><p className="font-medium">{a.palavra}{a.variante ? ` · ${a.variante}` : ""}</p><p className="text-sm text-muted-foreground">{a.estadoLabel} · {new Date(a.criadoEm).toLocaleDateString("pt-PT")}{a.notaRevisao ? ` · ${a.notaRevisao}` : ""}</p></div><Button variant="ghost" size="icon" aria-label="Apagar amostra" onClick={() => void apagar(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></li>)}</ul> : <p className="text-sm text-muted-foreground">Ainda não enviaste amostras.</p>}
      </section>
    </div>
  );
}
