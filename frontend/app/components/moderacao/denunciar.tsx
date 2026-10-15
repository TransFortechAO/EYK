"use client";

import { useState } from "react";
import { Ban, Flag, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api, mensagemDeErro, type TipoConteudoDenuncia } from "@/lib/api";
import { useAuth } from "@/components/auth-gate";
import { useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Os mesmos ids de apps/moderacao/models.py (MOTIVOS), sem o "automático".
const MOTIVOS: { id: string; label: string; ajuda: string }[] = [
  { id: "assedio", label: "Assédio ou bullying", ajuda: "Insultos, humilhação ou perseguição a alguém." },
  { id: "odio", label: "Discurso de ódio", ajuda: "Ataques por surdez, deficiência, raça, religião, género…" },
  { id: "sexual", label: "Conteúdo sexual", ajuda: "Nudez ou conteúdo sexual explícito." },
  { id: "violencia", label: "Violência ou ameaças", ajuda: "Ameaças, incitação à violência ou automutilação." },
  { id: "spam", label: "Spam ou publicidade", ajuda: "Publicidade, burlas ou mensagens repetidas." },
  { id: "falso", label: "Informação falsa", ajuda: "Informação enganadora que pode prejudicar alguém." },
  { id: "direitos_autor", label: "Direitos de autor", ajuda: "Conteúdo copiado de outra pessoa sem autorização." },
  { id: "outro", label: "Outro", ajuda: "Algo que viola as regras da comunidade." },
];

const NOME_TIPO: Record<TipoConteudoDenuncia, string> = {
  post: "esta publicação",
  comentario: "este comentário",
  comentario_video: "este comentário",
  video: "este vídeo",
  curso: "este curso",
  avaliacao: "esta avaliação",
  utilizador: "este perfil",
};

export function DenunciarDialog({
  tipo,
  id,
  open,
  onOpenChange,
}: {
  tipo: TipoConteudoDenuncia;
  id: number | string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [motivo, setMotivo] = useState<string | null>(null);
  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);

  const fechar = (aberto: boolean) => {
    onOpenChange(aberto);
    if (!aberto) {
      setMotivo(null);
      setDescricao("");
    }
  };

  const enviar = async () => {
    if (!motivo || enviando) return;
    setEnviando(true);
    try {
      const res = await api.moderacao.denunciar(tipo, id, motivo, descricao.trim());
      toast.success(
        res.jaDenunciado
          ? "Já tinhas denunciado isto — a equipa vai analisar."
          : "Recebemos a tua denúncia. Obrigado por ajudares a manter a EYK segura.",
      );
      fechar(false);
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível enviar a denúncia. Tenta de novo."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Denunciar {NOME_TIPO[tipo]}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <DialogDescription>
            A denúncia é anónima: o autor não fica a saber quem denunciou. Vais receber uma notificação com a decisão.
          </DialogDescription>
          <div role="radiogroup" aria-label="Motivo da denúncia" className="grid gap-2">
            {MOTIVOS.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={motivo === m.id}
                onClick={() => setMotivo(m.id)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-left transition hover:bg-surface",
                  motivo === m.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border",
                )}
              >
                <span className="block text-sm font-medium">{m.label}</span>
                <span className="block text-xs text-muted-foreground">{m.ajuda}</span>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="denuncia-descricao">Detalhes (opcional)</Label>
            <Textarea
              id="denuncia-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Conta-nos o que aconteceu, se ajudar a perceber."
            />
          </div>
        </div>

        <DialogFooter className="flex flex-row justify-end gap-2 space-y-0">
          <Button variant="outline" onClick={() => fechar(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void enviar()} disabled={!motivo || enviando} className="gap-2">
            <Flag className="h-4 w-4" />
            {enviando ? "A enviar…" : "Enviar denúncia"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Botão "Denunciar" com o diálogo incluído. `variante="texto"` encaixa nas
 * linhas de ações dos comentários (Responder · Editar · Denunciar). */
export function BotaoDenunciar({
  tipo,
  id,
  autorId,
  variante = "botao",
  className,
}: {
  tipo: TipoConteudoDenuncia;
  id: number | string;
  /** Não mostra o botão no conteúdo do próprio utilizador. */
  autorId?: number | null;
  variante?: "botao" | "texto";
  className?: string;
}) {
  const { user } = useAuth();
  const [aberto, setAberto] = useState(false);
  if (!user || (autorId != null && autorId === user.id)) return null;

  return (
    <>
      {variante === "texto" ? (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition hover:bg-surface/60",
            className,
          )}
        >
          <Flag className="h-3 w-3" /> Denunciar
        </button>
      ) : (
        <Button variant="ghost" size="sm" className={cn("gap-1.5 text-muted-foreground", className)} onClick={() => setAberto(true)}>
          <Flag className="h-4 w-4" /> Denunciar
        </Button>
      )}
      <DenunciarDialog tipo={tipo} id={id} open={aberto} onOpenChange={setAberto} />
    </>
  );
}

/** Pergunta e bloqueia/desbloqueia um utilizador. Devolve o novo estado
 * (ou null se a pessoa cancelou / falhou). */
export function useBloquear() {
  const confirm = useConfirm();
  return async (userId: number, nome: string, jaBloqueado = false): Promise<boolean | null> => {
    if (!jaBloqueado) {
      const ok = await confirm({
        title: `Bloquear ${nome}?`,
        description:
          "Deixas de ver as publicações e comentários desta pessoa, e ela deixa de ver os teus e de te poder responder. " +
          "Ela não é avisada. Podes desbloquear em Configurações → Privacidade.",
        confirmLabel: "Bloquear",
        destructive: true,
      });
      if (!ok) return null;
    }
    try {
      const res = await api.moderacao.alternarBloqueio(userId);
      toast.success(res.bloqueado ? `${nome} foi bloqueado.` : `${nome} foi desbloqueado.`);
      return res.bloqueado;
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível concluir. Tenta de novo."));
      return null;
    }
  };
}

/** Menu "⋯" com Denunciar e Bloquear o autor — para cartões (posts, perfis). */
export function MenuModeracao({
  tipo,
  id,
  autorId,
  autorNome,
  onBloqueado,
  className,
}: {
  tipo: TipoConteudoDenuncia;
  id: number | string;
  autorId: number | null;
  autorNome: string;
  onBloqueado?: (userId: number) => void;
  className?: string;
}) {
  const { user } = useAuth();
  const bloquear = useBloquear();
  const [denunciar, setDenunciar] = useState(false);
  if (!user || autorId === user.id) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className={cn("h-8 w-8", className)} aria-label="Mais opções">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setDenunciar(true)} className="gap-2">
            <Flag className="h-4 w-4" /> Denunciar
          </DropdownMenuItem>
          {autorId != null && (
            <DropdownMenuItem
              className="gap-2 text-red-500 focus:text-red-500"
              onSelect={() => {
                void bloquear(autorId, autorNome).then((bloqueado) => {
                  if (bloqueado) onBloqueado?.(autorId);
                });
              }}
            >
              <Ban className="h-4 w-4" /> Bloquear {autorNome.split(" ")[0]}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <DenunciarDialog tipo={tipo} id={id} open={denunciar} onOpenChange={setDenunciar} />
    </>
  );
}
