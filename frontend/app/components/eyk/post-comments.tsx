"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Heart,
  MessageCircle,
  Pencil,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api, mensagemDeErro, type Comentario } from "@/lib/api";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/UserAvatar";
import { useConfirm } from "@/components/confirm-dialog";
import { BotaoDenunciar } from "@/components/moderacao/denunciar";

const COMENTARIOS_POR_PAGINA = 2;

const contarComentarios = (lista: Comentario[]): number =>
  lista.reduce((acc, c) => acc + 1 + (c.respostas?.length ?? 0), 0);

type PostCommentsProps = {
  postId: string;
  initialCount?: number;
  onCommentAdded?: () => void;
};

export function PostComments({
  postId,
  initialCount = 0,
  onCommentAdded,
}: PostCommentsProps) {
  const [aberto, setAberto] = useState(false);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [total, setTotal] = useState(initialCount);
  const [texto, setTexto] = useState("");
  const [visiveis, setVisiveis] = useState(COMENTARIOS_POR_PAGINA);
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [carregado, setCarregado] = useState(false);

  // Mantém o contador sincronizado com o post enquanto a lista não foi carregada
  useEffect(() => {
    if (!carregado) setTotal(initialCount);
  }, [initialCount, carregado]);

  // `silencioso` = recarregar sem esconder a lista atual com o "A carregar..."
  const carregarComentarios = useCallback(
    async (silencioso = false): Promise<Comentario[] | null> => {
      if (!silencioso) setCarregando(true);

      try {
        const lista = await api.getComentarios(postId);
        setComentarios(lista);
        setTotal(contarComentarios(lista));
        setCarregado(true);
        return lista;
      } catch (error) {
        console.error("Erro ao carregar comentários:", error);
        toast.error("Não foi possível carregar os comentários.");
        return null;
      } finally {
        if (!silencioso) setCarregando(false);
      }
    },
    [postId],
  );

  useEffect(() => {
    if (aberto && !carregado) {
      void carregarComentarios();
    }
  }, [aberto, carregado, carregarComentarios]);

  const enviarComentario = async () => {
    const conteudo = texto.trim();

    if (!conteudo || enviando) return;

    setEnviando(true);

    try {
      await api.createComentario(postId, conteudo);
      setTexto("");

      const lista = await carregarComentarios(true);

      // Garante que o comentário acabado de publicar fica visível
      if (lista) {
        setVisiveis((anteriores) => Math.max(anteriores, lista.length));
      }

      onCommentAdded?.();
      toast.success("Comentário publicado.");
    } catch (error) {
      console.error("Erro ao publicar comentário:", error);
      toast.error(mensagemDeErro(error, "Não foi possível publicar o comentário."));
    } finally {
      setEnviando(false);
    }
  };

  const mostrarMais = () => {
    setVisiveis((anteriores) =>
      Math.min(anteriores + COMENTARIOS_POR_PAGINA, comentarios.length),
    );
  };

  const mostrarMenos = () => {
    setVisiveis(COMENTARIOS_POR_PAGINA);
  };

  const existemMais = visiveis < comentarios.length;

  return (
    <div className="space-y-3 border-t border-border/60 pt-4">
      <button
        type="button"
        onClick={() => setAberto((anterior) => !anterior)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        aria-expanded={aberto}
      >
        <MessageCircle className="h-4 w-4" />
        {aberto ? "Ocultar comentários" : `Ver comentários (${total})`}
        {aberto ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {aberto && (
        <div className="space-y-3">
          {carregando && (
            <p className="text-sm text-muted-foreground">
              A carregar comentários...
            </p>
          )}

          {!carregando && carregado && comentarios.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ainda não há comentários. Sê o primeiro a comentar.
            </p>
          )}

          {comentarios.length > 0 && (
            <ul className="space-y-3">
              {comentarios.slice(0, visiveis).map((comentario) => (
                <ComentarioItem
                  key={comentario.id}
                  postId={postId}
                  comentario={comentario}
                  onChange={async () => {
                    await carregarComentarios(true);
                  }}
                />
              ))}
            </ul>
          )}

          {!carregando && comentarios.length > COMENTARIOS_POR_PAGINA && (
            <div className="flex justify-center">
              {existemMais ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={mostrarMais}
                >
                  Ver mais
                  <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={mostrarMenos}
                >
                  Ver menos
                  <ChevronUp className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          <div className="space-y-2 border-t border-border/60 pt-3">
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escreve um comentário..."
              className="min-h-[75px] resize-none bg-background"
              maxLength={2000}
              disabled={enviando}
            />

            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                className="gap-2"
                disabled={!texto.trim() || enviando}
                onClick={() => void enviarComentario()}
              >
                <Send className="h-4 w-4" />
                {enviando ? "A publicar..." : "Comentar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Comentário (editar / apagar / reagir / responder) ---------- */
function ComentarioItem({
  postId,
  comentario,
  onChange,
  nested = false,
}: {
  postId: string;
  comentario: Comentario;
  onChange: () => void | Promise<void>;
  nested?: boolean;
}) {
  const confirm = useConfirm();
  const [liked, setLiked] = useState(comentario.liked);
  const [likes, setLikes] = useState(comentario.likes);
  const [reagindo, setReagindo] = useState(false);
  const [aEditar, setAEditar] = useState(false);
  const [textoEdicao, setTextoEdicao] = useState(comentario.conteudo);
  const [aResponder, setAResponder] = useState(false);
  const [textoResposta, setTextoResposta] = useState("");
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    setLiked(comentario.liked);
    setLikes(comentario.likes);
  }, [comentario.liked, comentario.likes]);

  const alternarGosto = async () => {
    if (reagindo) return;
    setReagindo(true);
    try {
      const res = await api.reagirComentario(postId, comentario.id);
      setLiked(res.liked);
      setLikes(res.totalLikes);
    } catch (error) {
      console.error("Erro ao reagir ao comentário:", error);
      toast.error("Não foi possível reagir ao comentário.");
    } finally {
      setReagindo(false);
    }
  };

  const guardarEdicao = async () => {
    if (!textoEdicao.trim() || processando) return;
    setProcessando(true);
    try {
      await api.editarComentario(postId, comentario.id, textoEdicao.trim());
      setAEditar(false);
      await onChange();
    } catch (error) {
      console.error("Erro ao editar comentário:", error);
      toast.error(mensagemDeErro(error, "Não foi possível editar o comentário."));
    } finally {
      setProcessando(false);
    }
  };

  const apagar = async () => {
    if (processando) return;
    const confirmado = await confirm({
      title: "Apagar comentário",
      description: "Esta ação não pode ser desfeita.",
      confirmLabel: "Apagar",
      destructive: true,
    });
    if (!confirmado) return;
    setProcessando(true);
    try {
      await api.apagarComentario(postId, comentario.id);
      await onChange();
    } catch (error) {
      console.error("Erro ao apagar comentário:", error);
      toast.error("Não foi possível apagar o comentário.");
    } finally {
      setProcessando(false);
    }
  };

  const enviarResposta = async () => {
    if (!textoResposta.trim() || processando) return;
    setProcessando(true);
    try {
      await api.createComentario(postId, textoResposta.trim(), comentario.id);
      setTextoResposta("");
      setAResponder(false);
      await onChange();
    } catch (error) {
      console.error("Erro ao responder ao comentário:", error);
      toast.error(mensagemDeErro(error, "Não foi possível publicar a resposta."));
    } finally {
      setProcessando(false);
    }
  };

  return (
    <li className={cn("flex items-start gap-2.5", nested && "ml-9")}>
      <Avatar className="h-7 w-7 shrink-0">
        <UserAvatar
          name={comentario.autor_nome}
          initials={comentario.autor_initials}
          foto={comentario.autor_foto}
          userId={comentario.autorId || undefined}
          size={28}
        />
      </Avatar>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="rounded-xl bg-surface/60 px-3 py-2">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-medium">{comentario.autor_nome}</span>
            <span className="text-[11px] text-muted-foreground">
              {comentario.time_ago}
              {comentario.editadoEm && " · editado"}
              {comentario.oculto && " · oculto pela moderação (só tu o vês)"}
            </span>
          </div>

          {aEditar ? (
            <div className="mt-1 space-y-2">
              <Textarea
                value={textoEdicao}
                onChange={(e) => setTextoEdicao(e.target.value)}
                rows={2}
                className="min-h-0 rounded-lg text-xs"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => void guardarEdicao()}
                  disabled={processando || !textoEdicao.trim()}
                >
                  <Check className="h-3 w-3" /> Guardar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => {
                    setAEditar(false);
                    setTextoEdicao(comentario.conteudo);
                  }}
                >
                  <X className="h-3 w-3" /> Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground">
              {comentario.conteudo}
            </p>
          )}
        </div>

        {!aEditar && (
          <div className="flex flex-wrap items-center gap-1 pl-1 text-[11px] text-muted-foreground">
            <button
              type="button"
              onClick={() => void alternarGosto()}
              disabled={reagindo}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition hover:bg-surface/60",
                liked && "text-primary",
              )}
            >
              <Heart className={cn("h-3 w-3", liked && "fill-current")} />
              {likes > 0 && likes}
            </button>
            {!nested && (
              <button
                type="button"
                onClick={() => setAResponder((v) => !v)}
                className="rounded-full px-1.5 py-0.5 transition hover:bg-surface/60"
              >
                Responder
              </button>
            )}
            {comentario.podeEditar && (
              <button
                type="button"
                onClick={() => setAEditar(true)}
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition hover:bg-surface/60"
              >
                <Pencil className="h-3 w-3" /> Editar
              </button>
            )}
            <BotaoDenunciar tipo="comentario" id={comentario.id} autorId={comentario.autorId} variante="texto" />
            {comentario.podeApagar && (
              <button
                type="button"
                onClick={() => void apagar()}
                disabled={processando}
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-red-400 transition hover:bg-red-500/10"
              >
                <Trash2 className="h-3 w-3" /> Apagar
              </button>
            )}
          </div>
        )}

        {aResponder && (
          <div className="flex gap-2 pt-1">
            <Textarea
              placeholder="Escreve uma resposta…"
              value={textoResposta}
              onChange={(e) => setTextoResposta(e.target.value)}
              rows={1}
              className="min-h-0 rounded-lg text-xs"
            />
            <Button
              size="sm"
              className="h-7 shrink-0 px-2 text-xs"
              onClick={() => void enviarResposta()}
              disabled={processando || !textoResposta.trim()}
            >
              Responder
            </Button>
          </div>
        )}

        {(comentario.respostas?.length ?? 0) > 0 && (
          <ul className="space-y-3 pt-2">
            {comentario.respostas.map((r) => (
              <ComentarioItem
                key={r.id}
                postId={postId}
                comentario={r}
                onChange={onChange}
                nested
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}