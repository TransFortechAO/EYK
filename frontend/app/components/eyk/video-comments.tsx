"use client";

import { useEffect, useState } from "react";
import { Check, Heart, MessageCircle, Pencil, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { api, type VideoComment } from "@/lib/api";
import { useAuth } from "@/components/auth-gate";

function contarComentarios(lista: VideoComment[]): number {
  return lista.reduce((acc, c) => acc + 1 + c.respostas.length, 0);
}

export function VideoComments({ videoId }: { videoId: string | number }) {
  const { user } = useAuth();
  const [comentarios, setComentarios] = useState<VideoComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoComentario, setNovoComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      setComentarios(await api.comentariosVideo.listar(videoId));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setNovoComentario("");
    setErro(null);
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  const enviarComentario = async () => {
    if (!novoComentario.trim() || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await api.comentariosVideo.criar(videoId, novoComentario.trim());
      setNovoComentario("");
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao comentar.");
    } finally {
      setEnviando(false);
    }
  };

  const total = contarComentarios(comentarios);

  return (
    <Card className="space-y-5 rounded-2xl border-border/70 p-5 shadow-soft sm:p-6">
      <h2 className="flex items-center gap-2 font-serif text-lg font-semibold">
        <MessageCircle className="h-4 w-4" />
        Comentários{total > 0 && ` (${total})`}
      </h2>

      <div className="flex gap-3">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="bg-secondary text-xs">{user?.initials || "?"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-2">
          <Textarea
            placeholder="Escreve um comentário…"
            value={novoComentario}
            onChange={(e) => setNovoComentario(e.target.value)}
            disabled={enviando}
            rows={2}
            className="min-h-0 rounded-xl"
          />
          {erro && <p className="text-xs text-red-400">{erro}</p>}
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => void enviarComentario()}
              disabled={enviando || !novoComentario.trim()}
              className="bg-gradient-gold text-primary-foreground hover:opacity-95"
            >
              {enviando ? "A publicar…" : "Comentar"}
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">A carregar comentários…</p>
      ) : comentarios.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Sê o primeiro a comentar.</p>
      ) : (
        <div className="space-y-5">
          {comentarios.map((c) => (
            <CommentItem key={c.id} comentario={c} videoId={videoId} onChange={carregar} />
          ))}
        </div>
      )}
    </Card>
  );
}

function CommentItem({
  comentario,
  videoId,
  onChange,
  nested = false,
}: {
  comentario: VideoComment;
  videoId: string | number;
  onChange: () => void | Promise<void>;
  nested?: boolean;
}) {
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
      const res = await api.comentariosVideo.reagir(videoId, comentario.id);
      setLiked(res.liked);
      setLikes(res.totalLikes);
    } finally {
      setReagindo(false);
    }
  };

  const guardarEdicao = async () => {
    if (!textoEdicao.trim() || processando) return;
    setProcessando(true);
    try {
      await api.comentariosVideo.editar(videoId, comentario.id, textoEdicao.trim());
      setAEditar(false);
      await onChange();
    } finally {
      setProcessando(false);
    }
  };

  const apagar = async () => {
    if (processando) return;
    if (!window.confirm("Apagar este comentário?")) return;
    setProcessando(true);
    try {
      await api.comentariosVideo.apagar(videoId, comentario.id);
      await onChange();
    } finally {
      setProcessando(false);
    }
  };

  const enviarResposta = async () => {
    if (!textoResposta.trim() || processando) return;
    setProcessando(true);
    try {
      await api.comentariosVideo.criar(videoId, textoResposta.trim(), comentario.id);
      setTextoResposta("");
      setAResponder(false);
      await onChange();
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className={cn("flex gap-3", nested && "ml-11")}>
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarFallback className="bg-secondary text-xs">{comentario.autorInitials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{comentario.autorNome}</span>
          <span className="text-xs text-muted-foreground">
            {comentario.tempo}
            {comentario.editadoEm && " · editado"}
          </span>
        </div>

        {aEditar ? (
          <div className="space-y-2">
            <Textarea
              value={textoEdicao}
              onChange={(e) => setTextoEdicao(e.target.value)}
              rows={2}
              className="min-h-0 rounded-xl"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void guardarEdicao()} disabled={processando || !textoEdicao.trim()} className="gap-1.5">
                <Check className="h-3.5 w-3.5" /> Guardar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setAEditar(false);
                  setTextoEdicao(comentario.conteudo);
                }}
                className="gap-1.5"
              >
                <X className="h-3.5 w-3.5" /> Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{comentario.conteudo}</p>
        )}

        <div className="flex flex-wrap items-center gap-1 pt-0.5 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => void alternarGosto()}
            disabled={reagindo}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-1 transition hover:bg-surface/60",
              liked && "text-primary",
            )}
          >
            <Heart className={cn("h-3.5 w-3.5", liked && "fill-current")} />
            {likes > 0 && likes}
          </button>

          {!nested && (
            <button
              type="button"
              onClick={() => setAResponder((v) => !v)}
              className="rounded-full px-2 py-1 transition hover:bg-surface/60"
            >
              Responder
            </button>
          )}

          {comentario.podeEditar && !aEditar && (
            <button
              type="button"
              onClick={() => setAEditar(true)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 transition hover:bg-surface/60"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
          )}

          {comentario.podeApagar && (
            <button
              type="button"
              onClick={() => void apagar()}
              disabled={processando}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-red-400 transition hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> Apagar
            </button>
          )}
        </div>

        {aResponder && (
          <div className="flex gap-2 pt-1">
            <Textarea
              placeholder="Escreve uma resposta…"
              value={textoResposta}
              onChange={(e) => setTextoResposta(e.target.value)}
              rows={1}
              className="min-h-0 rounded-xl"
            />
            <Button
              size="sm"
              onClick={() => void enviarResposta()}
              disabled={processando || !textoResposta.trim()}
              className="shrink-0"
            >
              Responder
            </Button>
          </div>
        )}

        {comentario.respostas.length > 0 && (
          <div className="space-y-4 pt-2">
            {comentario.respostas.map((r) => (
              <CommentItem
                key={r.id}
                comentario={r}
                videoId={videoId}
                onChange={onChange}
                nested
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
