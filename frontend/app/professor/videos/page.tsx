"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  BarChart3,
  Video as VideoIcon,
  X,
  CircleDot,
  Heart,
  Eye,
  MessageCircle,
  ArrowUp,
  ArrowDown,
  Upload,
  Film,
  FileText,
  Image as ImageIcon,
  Search,
  PlayCircle,
  Clock,
} from "lucide-react";
import { PageHeader } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirm } from "@/components/confirm-dialog";
import { api, tempoRelativo, formatarDuracaoCurta, type ProfessorVideo, type ProfessorVideoPayload } from "@/lib/api";

type FiltroEstado = "todos" | "publicado" | "rascunho";

const EMPTY_FORM: ProfessorVideoPayload = {
  titulo: "",
  descricao: "",
  url_externa: "",
  ativo: true,
};

export default function ProfessorVideosPage() {
  const confirm = useConfirm();
  const [videos, setVideos] = useState<ProfessorVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<ProfessorVideo | null>(null);
  const [form, setForm] = useState<ProfessorVideoPayload>(EMPTY_FORM);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [recursosNovos, setRecursosNovos] = useState<File[]>([]);
  const [apagandoRecursoId, setApagandoRecursoId] = useState<number | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [submetendo, setSubmetendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [reordenando, setReordenando] = useState(false);
  const [pesquisa, setPesquisa] = useState("");
  const [filtro, setFiltro] = useState<FiltroEstado>("todos");
  const videoInputRef = useRef<HTMLInputElement>(null);
  const recursosInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      setVideos(await api.professor.getVideos());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const abrirCriar = () => {
    setEditando(null);
    setForm(EMPTY_FORM);
    setVideoFile(null);
    setRecursosNovos([]);
    setThumbnailPreview(null);
    setErro(null);
    setModalAberto(true);
  };

  const abrirEditar = (video: ProfessorVideo) => {
    setEditando(video);
    setForm({
      titulo: video.titulo,
      descricao: video.descricao,
      url_externa: video.url_externa,
      ativo: video.ativo,
    });
    setVideoFile(null);
    setRecursosNovos([]);
    setThumbnailPreview(video.thumbnail || null);
    setErro(null);
    setModalAberto(true);
  };

  const RECURSO_TAMANHO_MAX_MB = 50;

  const escolherRecursos = () => recursosInputRef.current?.click();

  const onRecursosSelecionados = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ficheiros = Array.from(e.target.files || []);
    e.target.value = "";
    if (ficheiros.length === 0) return;
    for (const f of ficheiros) {
      if (!f.name.toLowerCase().endsWith(".pdf")) {
        setErro("Os recursos têm de ser ficheiros PDF.");
        return;
      }
      if (f.size > RECURSO_TAMANHO_MAX_MB * 1024 * 1024) {
        setErro(`Cada recurso deve ter no máximo ${RECURSO_TAMANHO_MAX_MB}MB.`);
        return;
      }
    }
    setRecursosNovos((prev) => [...prev, ...ficheiros]);
  };

  const removerRecursoNovo = (index: number) => {
    setRecursosNovos((prev) => prev.filter((_, i) => i !== index));
  };

  const apagarRecursoExistente = async (recurso: { id: number }) => {
    if (!editando) return;
    const confirmado = await confirm({
      title: "Remover recurso",
      description: "O recurso será removido do vídeo. Esta ação não pode ser desfeita.",
      confirmLabel: "Remover",
      destructive: true,
    });
    if (!confirmado) return;
    setApagandoRecursoId(recurso.id);
    try {
      await api.professor.apagarRecursoVideo(editando.id, recurso.id);
      const videoAtualizado = { ...editando, recursos: editando.recursos.filter((r) => r.id !== recurso.id) };
      setEditando(videoAtualizado);
      setVideos((prev) => prev.map((v) => (v.id === videoAtualizado.id ? videoAtualizado : v)));
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao remover o recurso.");
    } finally {
      setApagandoRecursoId(null);
    }
  };

  const escolherVideo = () => videoInputRef.current?.click();

  const onVideoSelecionado = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ficheiro = e.target.files?.[0] || null;
    if (ficheiro) setVideoFile(ficheiro);
    e.target.value = "";
  };

  const escolherThumbnail = () => thumbnailInputRef.current?.click();

  const onThumbnailSelecionada = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ficheiro = e.target.files?.[0] || null;
    if (!ficheiro) return;
    if (!ficheiro.type.startsWith("image/")) {
      setErro("Escolhe um ficheiro de imagem válido.");
      return;
    }
    setForm((prev) => ({ ...prev, thumbnail: ficheiro }));
    setThumbnailPreview((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(ficheiro);
    });
    e.target.value = "";
  };

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) {
      setErro("O título é obrigatório.");
      return;
    }
    const temFicheiroExistente = Boolean(editando?.arquivo) && !videoFile;
    if (!videoFile && !form.url_externa?.trim() && !temFicheiroExistente) {
      setErro("Faz upload de um vídeo ou indica um link externo (ex: YouTube).");
      return;
    }
    setSubmetendo(true);
    setErro(null);
    try {
      const payload: ProfessorVideoPayload = { ...form, arquivo: videoFile };
      if (editando) {
        await api.professor.atualizarVideo(editando.id, payload, recursosNovos);
      } else {
        await api.professor.criarVideo(payload, recursosNovos);
      }
      setModalAberto(false);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao guardar o vídeo.");
    } finally {
      setSubmetendo(false);
    }
  };

  const apagar = async (video: ProfessorVideo) => {
    const confirmado = await confirm({
      title: `Eliminar o vídeo "${video.titulo}"?`,
      description: "Esta ação é irreversível.",
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!confirmado) return;
    await api.professor.apagarVideo(video.id);
    await carregar();
  };

  const mover = async (index: number, direcao: -1 | 1) => {
    const alvo = index + direcao;
    if (alvo < 0 || alvo >= videos.length) return;
    const nova = [...videos];
    [nova[index], nova[alvo]] = [nova[alvo], nova[index]];
    setVideos(nova);
    setReordenando(true);
    try {
      await api.professor.reordenarVideos(nova.map((v) => v.id));
    } finally {
      setReordenando(false);
    }
  };

  const semFiltroAtivo = filtro === "todos" && !pesquisa.trim();
  const videosFiltrados = videos.filter((video) => {
    if (filtro === "publicado" && !video.ativo) return false;
    if (filtro === "rascunho" && video.ativo) return false;
    if (pesquisa.trim() && !video.titulo.toLowerCase().includes(pesquisa.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-8">
      <PageHeader title="Meus Vídeos" description="Publica e organiza os teus vídeos.">
        <Button onClick={abrirCriar} className="gap-2 bg-gradient-gold text-primary-foreground hover:opacity-95 shadow-gold">
          <Plus className="h-4 w-4" />
          Publicar vídeo
        </Button>
      </PageHeader>

      {!loading && videos.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)}
              placeholder="Pesquisar vídeo…"
              className="rounded-full pl-9"
            />
          </div>
          <Tabs value={filtro} onValueChange={(v) => setFiltro(v as FiltroEstado)}>
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="publicado">Publicado</TabsTrigger>
              <TabsTrigger value="rascunho">Rascunho</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-muted-foreground">
          <CircleDot className="mx-auto h-8 w-8 animate-spin text-amber-400" />
          <p className="mt-3 text-sm">A carregar vídeos…</p>
        </div>
      ) : videos.length === 0 ? (
        <Card className="p-10 text-center shadow-soft">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-border bg-surface/60">
            <VideoIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="mt-4 font-serif text-lg">Ainda não tens vídeos.</p>
          <p className="text-sm text-muted-foreground mt-1">Publica o teu primeiro vídeo para começares.</p>
        </Card>
      ) : videosFiltrados.length === 0 ? (
        <Card className="p-10 text-center shadow-soft text-muted-foreground">
          Nenhum vídeo corresponde à pesquisa/filtro.
        </Card>
      ) : (
        <div className="space-y-3">
          {videosFiltrados.map((video) => {
            const index = videos.indexOf(video);
            return (
              <Card key={video.id} className="p-4 shadow-soft flex items-center gap-4">
                {semFiltroAtivo && (
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={index === 0 || reordenando}
                      onClick={() => void mover(index, -1)}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition"
                      aria-label="Mover para cima"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={index === videos.length - 1 || reordenando}
                      onClick={() => void mover(index, 1)}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition"
                      aria-label="Mover para baixo"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <div
                  className="relative grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary bg-cover bg-center text-secondary-foreground"
                  style={video.thumbnail ? { backgroundImage: `url('${video.thumbnail}')` } : undefined}
                >
                  {!video.thumbnail && <PlayCircle className="h-6 w-6 opacity-60" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{video.titulo}</p>
                    {video.ativo ? (
                      <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shrink-0">Publicado</Badge>
                    ) : (
                      <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 shrink-0">Rascunho</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                    {video.duracao_segundos > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {formatarDuracaoCurta(video.duracao_segundos)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" /> {video.total_visualizacoes}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5" /> {video.total_likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5" /> {video.total_comentarios}
                    </span>
                    <span className="flex items-center gap-1">{tempoRelativo(video.atualizado_em)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => abrirEditar(video)}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Link href={`/professor/videos/${video.id}`}>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <BarChart3 className="h-3.5 w-3.5" /> Engajamento
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                    onClick={() => void apagar(video)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editando ? "Editar vídeo" : "Publicar vídeo"}
              {editando && editando.duracao_segundos > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> {formatarDuracaoCurta(editando.duracao_segundos)}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <form id="form-video" onSubmit={submeter} className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className="space-y-2">
                <Label htmlFor="v-titulo">Título</Label>
                <Input id="v-titulo" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-descricao">Descrição</Label>
                <Textarea id="v-descricao" rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Imagem de capa (opcional)</Label>
                <input
                  ref={thumbnailInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onThumbnailSelecionada}
                  disabled={submetendo}
                  className="sr-only"
                />
                {thumbnailPreview ? (
                  <button
                    type="button"
                    onClick={escolherThumbnail}
                    disabled={submetendo}
                    className="group relative block w-full overflow-hidden rounded-xl border border-border/60 disabled:opacity-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbnailPreview} alt="Pré-visualização da capa" className="h-32 w-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-xs font-medium text-transparent transition group-hover:bg-black/50 group-hover:text-white">
                      Trocar imagem
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={escolherThumbnail}
                    disabled={submetendo}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 px-4 py-4 text-sm text-muted-foreground transition hover:border-amber-400/60 hover:text-foreground disabled:opacity-50"
                  >
                    <ImageIcon className="h-4 w-4" />
                    Escolher imagem de capa
                  </button>
                )}
                <p className="text-xs text-muted-foreground">
                  Se não escolheres uma, é usado automaticamente um frame do vídeo.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Ficheiro de vídeo</Label>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  onChange={onVideoSelecionado}
                  disabled={submetendo}
                  className="sr-only"
                />
                <button
                  type="button"
                  onClick={escolherVideo}
                  disabled={submetendo}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 px-4 py-4 text-sm text-muted-foreground transition hover:border-amber-400/60 hover:text-foreground disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  Fazer upload de vídeo
                </button>

                {videoFile ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
                    <span className="flex min-w-0 items-center gap-2">
                      <Film className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <span className="truncate">{videoFile.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setVideoFile(null)}
                      disabled={submetendo}
                      className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-50"
                      aria-label="Remover ficheiro"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : editando?.arquivo ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Film className="h-3.5 w-3.5 shrink-0" /> Já tem um ficheiro de vídeo enviado.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Recursos (PDF, opcional)</Label>
                <input
                  ref={recursosInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  onChange={onRecursosSelecionados}
                  disabled={submetendo}
                  className="sr-only"
                />
                <button
                  type="button"
                  onClick={escolherRecursos}
                  disabled={submetendo}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 px-4 py-4 text-sm text-muted-foreground transition hover:border-amber-400/60 hover:text-foreground disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  Adicionar recurso(s) em PDF
                </button>

                {editando && editando.recursos.length > 0 && (
                  <ul className="space-y-1.5">
                    {editando.recursos.map((recurso) => (
                      <li
                        key={recurso.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs"
                      >
                        <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{recurso.nome}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => void apagarRecursoExistente(recurso)}
                          disabled={apagandoRecursoId === recurso.id}
                          className="shrink-0 text-red-400 hover:text-red-300 disabled:opacity-50"
                          aria-label={`Remover ${recurso.nome}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {recursosNovos.length > 0 && (
                  <ul className="space-y-1.5">
                    {recursosNovos.map((ficheiro, index) => (
                      <li
                        key={`${ficheiro.name}-${index}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                          <span className="truncate">{ficheiro.name}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removerRecursoNovo(index)}
                          disabled={submetendo}
                          className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-50"
                          aria-label={`Remover ${ficheiro.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Publicar vídeo</p>
                  <p className="text-xs text-muted-foreground">Vídeos não publicados ficam como rascunho.</p>
                </div>
                <Switch checked={Boolean(form.ativo)} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              </div>

            </form>

          <DialogFooter>
            {erro && <p className="text-sm text-red-400">{erro}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setModalAberto(false)} disabled={submetendo}>
                Cancelar
              </Button>
              <Button
                type="submit"
                form="form-video"
                disabled={submetendo}
                className="bg-gradient-gold text-primary-foreground hover:opacity-95 shadow-gold"
              >
                {submetendo ? "A guardar…" : editando ? "Guardar alterações" : "Publicar vídeo"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
