"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ClipboardList, Clock, FileText, Link2, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/auth-gate";
import { API_BASE_URL, api, mensagemDeErro, type Candidatura, type TipoDocumentoCandidatura } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Candidatura a professor (Fase 1): quem se registou como professor entra como aluno e
 * completa aqui o formulário de competências. Enquanto espera pela equipa EYK, uma faixa
 * no topo diz em que ponto está.
 */

const ADIADO = "eyk:candidatura-adiada";
const EDITAVEIS = new Set(["por_completar", "correcao_pedida"]);
const TIPOS: { valor: TipoDocumentoCandidatura; rotulo: string }[] = [
  { valor: "diploma", rotulo: "Diploma" },
  { valor: "certificado", rotulo: "Certificado" },
  { valor: "video", rotulo: "Vídeo de demonstração" },
  { valor: "portefolio", rotulo: "Portefólio" },
  { valor: "outro", rotulo: "Outra evidência" },
];
const MAX_MB = 200;

function tamanho(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function Formulario({ aoSubmeter, aoAdiar }: { aoSubmeter: () => void; aoAdiar: () => void }) {
  const [c, setC] = useState<Candidatura | null>(null);
  const [aGuardar, setAGuardar] = useState(false);
  const [tipoDoc, setTipoDoc] = useState<TipoDocumentoCandidatura>("certificado");
  const [link, setLink] = useState("");
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void api.candidatura.obter().then(setC).catch(() => toast.error("Não foi possível abrir a tua candidatura."));
  }, []);

  if (!c) return <p className="p-5 text-sm text-muted-foreground">A carregar…</p>;
  const mudar = (campo: keyof Candidatura, valor: string) => setC({ ...c, [campo]: valor });

  const guardar = async () => {
    const r = await api.candidatura.guardar({
      area: c.area,
      telefone: c.telefone,
      apresentacao: c.apresentacao,
      tipoQualificacao: c.tipoQualificacao ?? "",
      experiencia: c.experiencia,
      portefolioUrl: c.portefolioUrl,
    });
    setC(r);
    return r;
  };

  const juntar = async (ficheiro?: File) => {
    if (ficheiro && ficheiro.size > MAX_MB * 1024 * 1024) {
      toast.error(`O ficheiro pode ter até ${MAX_MB} MB. Para vídeos maiores, junta um link.`);
      return;
    }
    if (!ficheiro && !link.trim()) return;
    setAGuardar(true);
    try {
      const doc = await api.candidatura.carregarDocumento({ tipo: tipoDoc, ficheiro, link: ficheiro ? undefined : link.trim() });
      setC((atual) => (atual ? { ...atual, documentos: [...atual.documentos, doc] } : atual));
      setLink("");
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível juntar o documento."));
    } finally {
      setAGuardar(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  const remover = async (id: number) => {
    try {
      await api.candidatura.removerDocumento(id);
      setC((atual) => (atual ? { ...atual, documentos: atual.documentos.filter((d) => d.id !== id) } : atual));
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível remover."));
    }
  };

  const adiar = async () => {
    setAGuardar(true);
    try {
      await guardar();
      aoAdiar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível guardar."));
    } finally {
      setAGuardar(false);
    }
  };

  const submeter = async () => {
    setAGuardar(true);
    try {
      await guardar();
      await api.candidatura.submeter();
      aoSubmeter();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível enviar a candidatura."));
    } finally {
      setAGuardar(false);
    }
  };

  const formal = c.tipoQualificacao === "formal";
  return (
    <div className="space-y-5 overflow-y-auto p-5">
      {c.estado === "correcao_pedida" && c.mensagem && (
        <div role="alert" className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
          <p className="font-medium">A equipa EYK pediu uma correção:</p>
          <p className="mt-1 whitespace-pre-line">{c.mensagem}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="cand-area">Área em que queres ensinar</Label>
        <Input id="cand-area" value={c.area} onChange={(e) => mudar("area", e.target.value)} placeholder="ex: Língua Gestual Angolana, Matemática…" maxLength={100} />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Tipo de qualificação</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { valor: "formal", titulo: "Formal", texto: "Tenho diploma ou certificado nesta área." },
            { valor: "competencia", titulo: "Competência demonstrada", texto: "Não tenho certificado, mas mostro que domino a área." },
          ].map((op) => (
            <label
              key={op.valor}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-sm transition-colors",
                c.tipoQualificacao === op.valor ? "border-primary bg-primary/10" : "border-border hover:bg-accent",
              )}
            >
              <input type="radio" name="cand-tipo" value={op.valor} checked={c.tipoQualificacao === op.valor} onChange={() => mudar("tipoQualificacao", op.valor)} className="sr-only" />
              <span className="font-medium">{op.titulo}</span>
              <span className="text-xs text-muted-foreground">{op.texto}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="cand-exp">Experiência profissional {formal && <span className="text-muted-foreground">(opcional)</span>}</Label>
        <Textarea id="cand-exp" rows={4} maxLength={4000} value={c.experiencia} onChange={(e) => mudar("experiencia", e.target.value)} placeholder="O que já ensinaste ou fizeste nesta área, onde e durante quanto tempo." />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cand-port">Portefólio <span className="text-muted-foreground">(link, opcional)</span></Label>
        <Input id="cand-port" type="url" value={c.portefolioUrl} onChange={(e) => mudar("portefolioUrl", e.target.value)} placeholder="https://" />
      </div>

      <section className="space-y-3">
        <div>
          <p className="text-sm font-medium">Documentos e evidências</p>
          <p className="text-xs text-muted-foreground">
            {formal ? "Junta pelo menos um diploma ou certificado." : "Diplomas, certificados, vídeos de demonstração ou aulas experimentais."} Só a equipa EYK os vê. Até {MAX_MB} MB por ficheiro.
          </p>
        </div>
        {c.documentos.length > 0 && (
          <ul className="space-y-2">
            {c.documentos.map((d) => (
              <li key={d.id} className="flex items-center gap-3 rounded-xl bg-surface p-3 text-sm">
                {d.link ? <Link2 className="h-4 w-4 shrink-0 text-primary" aria-hidden /> : <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{TIPOS.find((t) => t.valor === d.tipo)?.rotulo}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {d.link ? d.link : d.url ? <a href={`${API_BASE_URL}${d.url}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{d.nome}</a> : d.nome}
                    {!d.link && ` · ${tamanho(d.tamanhoBytes)}`}
                  </span>
                </span>
                {c.editavel && (
                  <Button type="button" variant="ghost" size="icon" aria-label="Remover documento" onClick={() => void remover(d.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3 sm:flex-row sm:items-center">
          <select
            aria-label="Tipo de documento"
            value={tipoDoc}
            onChange={(e) => setTipoDoc(e.target.value as TipoDocumentoCandidatura)}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm pointer-coarse:min-h-11"
          >
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.rotulo}
              </option>
            ))}
          </select>
          <input ref={entrada} type="file" accept=".pdf,.doc,.docx,image/*,video/*" className="sr-only" aria-label="Escolher ficheiro" onChange={(e) => void juntar(e.target.files?.[0])} />
          <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={aGuardar} onClick={() => entrada.current?.click()}>
            <Upload className="h-4 w-4" /> Ficheiro
          </Button>
          <span className="text-center text-xs text-muted-foreground">ou</span>
          <div className="flex flex-1 gap-2">
            <Input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link (ex: vídeo no YouTube)" aria-label="Link do documento" />
            <Button type="button" variant="outline" size="sm" disabled={aGuardar || !link.trim()} onClick={() => void juntar()}>
              <Paperclip className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" disabled={aGuardar} onClick={() => void adiar()}>
          Guardar e continuar depois
        </Button>
        <Button type="button" disabled={aGuardar} onClick={() => void submeter()}>
          {aGuardar ? "A guardar…" : "Enviar candidatura"}
        </Button>
      </div>
    </div>
  );
}

/** Faixa no topo da app e modal do formulário, para quem tem uma candidatura em curso. */
export function CandidaturaProfessor() {
  const { user, refresh } = useAuth();
  const estado = user?.candidaturaProfessor?.estado ?? null;
  const [aberto, setAberto] = useState(false);
  const [enviada, setEnviada] = useState(false);

  // No primeiro login (e quando a equipa pede correção) o formulário abre sozinho, uma vez por sessão.
  useEffect(() => {
    if (!estado || !EDITAVEIS.has(estado)) return;
    try {
      if (sessionStorage.getItem(ADIADO) === estado) return;
    } catch {
      /* sem sessionStorage: abre na mesma */
    }
    setAberto(true);
  }, [estado]);

  const fechar = useCallback(() => {
    setAberto(false);
    try {
      if (estado) sessionStorage.setItem(ADIADO, estado);
    } catch {
      /* ignora */
    }
  }, [estado]);

  if (!estado || user?.isTeacher) return null;
  const editavel = EDITAVEIS.has(estado);
  const mensagem = user?.candidaturaProfessor?.mensagem;

  const textos: Record<string, string> = {
    por_completar: "Completa a tua candidatura a professor para a equipa EYK a poder analisar.",
    correcao_pedida: "A equipa EYK pediu uma correção à tua candidatura a professor.",
    submetida: "A tua candidatura a professor foi enviada e aguarda a decisão da equipa EYK (avisamos-te na app e por email). Enquanto esperas, usa a EYK como aluno.",
    em_analise: "A tua candidatura a professor está em análise. Enquanto esperas, usa a EYK como aluno.",
    rejeitada: `A tua candidatura a professor não foi aprovada${mensagem ? `: ${mensagem}` : "."}`,
    suspensa: "A tua autorização de professor está suspensa.",
  };

  return (
    <>
      <div role="status" className="flex items-center gap-3 border-b border-primary/20 bg-primary/10 px-4 py-2 text-xs sm:text-sm">
        {editavel ? <ClipboardList className="h-4 w-4 shrink-0 text-primary" aria-hidden /> : <Clock className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
        <p className="min-w-0 flex-1">
          {textos[estado] ?? ""}{" "}
          {editavel && (
            <button type="button" onClick={() => setAberto(true)} className="font-semibold text-primary underline-offset-2 hover:underline">
              Completar agora
            </button>
          )}
        </p>
      </div>

      <Dialog open={aberto} onOpenChange={(v) => (v ? setAberto(true) : enviada ? (setAberto(false), setEnviada(false)) : fechar())}>
        <DialogContent className="max-h-[90dvh]">
          {enviada ? (
            <div className="space-y-4 p-6 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden />
              <DialogTitle className="font-serif text-2xl">Candidatura enviada</DialogTitle>
              <DialogDescription>
                A equipa EYK vai analisar a tua candidatura e avisa-te quando houver uma decisão. Enquanto esperas, podes explorar a plataforma e aprender como aluno.
              </DialogDescription>
              <Button className="w-full sm:w-auto" onClick={() => (setAberto(false), setEnviada(false))}>
                Explorar a EYK
              </Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <div>
                  <DialogTitle>Completa a tua candidatura a professor</DialogTitle>
                  <DialogDescription>Mostra-nos o que sabes ensinar. Sem certificado também podes: basta demonstrares que dominas a área.</DialogDescription>
                </div>
              </DialogHeader>
              <Formulario
                aoAdiar={() => {
                  toast.success("Guardado. Podes continuar quando quiseres.");
                  fechar();
                }}
                aoSubmeter={() => {
                  setEnviada(true);
                  void refresh();
                }}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

