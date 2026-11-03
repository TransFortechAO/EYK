"use client";

import { useEffect, useRef, useState } from "react";
import { AtSign, Send } from "lucide-react";
import { toast } from "sonner";
import {
  api,
  mensagemDeErro,
  type Post,
  type UtilizadorPesquisa,
} from "@/lib/api";
import { useAuth } from "@/components/auth-gate";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserInitialsLink } from "@/components/UserAvatar";

const MAXIMO = 2000;
const PLACEHOLDER = "O que estás a aprender hoje? Partilha com a comunidade…";

/**
 * Criar publicação: na página só aparece o campo; ao clicar abre um cartão
 * (modal) com o texto e outras opções, como mencionar alguém.
 */
export function CompositorPost({
  aoPublicar,
}: {
  aoPublicar: (post: Post) => void;
}) {
  const { user } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [aPublicar, setAPublicar] = useState(false);
  const [aMencionar, setAMencionar] = useState(false);
  const [termo, setTermo] = useState("");
  const [pessoas, setPessoas] = useState<UtilizadorPesquisa[]>([]);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!aMencionar || termo.trim().length < 2) {
      setPessoas([]);
      return;
    }
    const t = setTimeout(() => {
      void api
        .pesquisarUtilizadores(termo.trim())
        .then((lista) => setPessoas(lista.slice(0, 6)));
    }, 250);
    return () => clearTimeout(t);
  }, [termo, aMencionar]);

  const mencionar = (p: UtilizadorPesquisa) => {
    const area = areaRef.current;
    const pos = area?.selectionStart ?? texto.length;
    const antes = texto.slice(0, pos);
    const depois = texto.slice(pos);
    const espaco = antes && !/\s$/.test(antes) ? " " : "";
    setTexto(`${antes}${espaco}@${p.username} ${depois}`);
    setAMencionar(false);
    setTermo("");
    requestAnimationFrame(() => area?.focus());
  };

  const publicar = async () => {
    if (!texto.trim() || aPublicar) return;
    setAPublicar(true);
    try {
      const novo = await api.createPost(texto.trim());
      aoPublicar(novo);
      setTexto("");
      setAberto(false);
      toast.success("Publicado na comunidade.");
    } catch (err) {
      // Filtro automático (linguagem proibida, links em conta nova, spam…).
      toast.error(
        mensagemDeErro(err, "Não foi possível publicar. Tenta de novo."),
      );
    } finally {
      setAPublicar(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <UserInitialsLink />
        </Avatar>
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="h-11 min-w-0 flex-1 truncate rounded-full bg-surface px-4 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary"
        >
          {PLACEHOLDER}
        </button>
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90dvh] sm:max-w-lg">
          <DialogHeader className="flex-col items-start gap-0.5">
            <DialogTitle className="font-serif text-2xl">
              Criar publicação
            </DialogTitle>
            <DialogDescription>
              Partilha o teu progresso, uma dúvida ou uma dica com a comunidade.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto p-5">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 shrink-0">
                <UserInitialsLink />
              </Avatar>
              <p className="text-sm font-medium">{user?.name}</p>
            </div>

            <Textarea
              ref={areaRef}
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={PLACEHOLDER}
              maxLength={MAXIMO}
              className="min-h-[140px] resize-none border-transparent bg-surface text-base shadow-none"
            />

            {aMencionar && (
              <div className="space-y-2 rounded-xl border border-border/70 p-3">
                <Input
                  autoFocus
                  value={termo}
                  onChange={(e) => setTermo(e.target.value)}
                  placeholder="Procura alguém para mencionar…"
                  className="h-9"
                />
                {pessoas.length > 0 ? (
                  <ul className="max-h-48 overflow-y-auto">
                    {pessoas.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => mencionar(p)}
                          className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface"
                        >
                          <span className="truncate font-medium">{p.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            @{p.username}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  termo.trim().length >= 2 && (
                    <p className="px-1 text-xs text-muted-foreground">
                      Ninguém encontrado.
                    </p>
                  )
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setAMencionar((v) => !v)}
                  aria-pressed={aMencionar}
                >
                  <AtSign className="h-4 w-4" />
                  Mencionar
                </Button>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {texto.length}/{MAXIMO}
                </span>
              </div>
              <Button
                onClick={() => void publicar()}
                disabled={!texto.trim() || aPublicar}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                {aPublicar ? "A publicar…" : "Publicar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
