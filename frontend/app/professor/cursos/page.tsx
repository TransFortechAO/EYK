"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  BarChart3,
  BookOpen,
  X,
  CircleDot,
  Users,
  Eye,
  Upload,
  Film,
  Image as ImageIcon,
  Search,
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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, tempoRelativo, type ProfessorCurso, type ProfessorCursoPayload } from "@/lib/api";

type FiltroEstado = "todos" | "publicado" | "rascunho";

const EMPTY_FORM: ProfessorCursoPayload = {
  titulo: "",
  descricao: "",
  categoria_nome: "",
  preco: "",
  duracao: "",
  ativo: true,
};

export default function ProfessorCursosPage() {
  const [cursos, setCursos] = useState<ProfessorCurso[]>([]);
  const [loading, setLoading] = useState(true);
  const [pesquisa, setPesquisa] = useState("");
  const [filtro, setFiltro] = useState<FiltroEstado>("todos");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<ProfessorCurso | null>(null);
  const [form, setForm] = useState<ProfessorCursoPayload>(EMPTY_FORM);
  const [videosNovos, setVideosNovos] = useState<File[]>([]);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [apagandoVideoId, setApagandoVideoId] = useState<number | null>(null);
  const [submetendo, setSubmetendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const videosInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      setCursos(await api.professor.getCursos());
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
    setVideosNovos([]);
    setThumbnailPreview(null);
    setErro(null);
    setModalAberto(true);
  };

  const abrirEditar = (curso: ProfessorCurso) => {
    setEditando(curso);
    setForm({
      titulo: curso.titulo,
      descricao: curso.descricao,
      categoria_nome: curso.categoria || "",
      preco: curso.preco || "",
      duracao: curso.duracao || "",
      ativo: curso.ativo,
    });
    setVideosNovos([]);
    setThumbnailPreview(curso.thumbnail || null);
    setErro(null);
    setModalAberto(true);
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

  const escolherVideos = () => videosInputRef.current?.click();

  const onVideosSelecionados = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ficheiros = Array.from(e.target.files || []);
    if (ficheiros.length === 0) return;
    setVideosNovos((prev) => [...prev, ...ficheiros]);
    e.target.value = "";
  };

  const removerVideoNovo = (index: number) => {
    setVideosNovos((prev) => prev.filter((_, i) => i !== index));
  };

  const apagarVideoExistente = async (video: { id: number }) => {
    if (!editando) return;
    if (!window.confirm("Remover este vídeo do curso?")) return;
    setApagandoVideoId(video.id);
    try {
      await api.professor.apagarVideoCurso(editando.id, video.id);
      const cursoAtualizado = { ...editando, videos: editando.videos.filter((v) => v.id !== video.id) };
      setEditando(cursoAtualizado);
      setCursos((prev) => prev.map((c) => (c.id === cursoAtualizado.id ? cursoAtualizado : c)));
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao remover o vídeo.");
    } finally {
      setApagandoVideoId(null);
    }
  };

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.descricao.trim()) {
      setErro("Título e descrição são obrigatórios.");
      return;
    }
    const semVideosNoCurso = editando
      ? editando.videos.length === 0 && videosNovos.length === 0
      : videosNovos.length === 0;
    if (semVideosNoCurso) {
      setErro("Faz upload de pelo menos um vídeo para o curso.");
      return;
    }
    setSubmetendo(true);
    setErro(null);
    try {
      if (editando) {
        await api.professor.atualizarCurso(editando.id, form, videosNovos);
      } else {
        await api.professor.criarCurso(form, videosNovos);
      }
      setModalAberto(false);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao guardar o curso.");
    } finally {
      setSubmetendo(false);
    }
  };

  const apagar = async (curso: ProfessorCurso) => {
    if (!window.confirm(`Eliminar o curso "${curso.titulo}"? Esta ação é irreversível.`)) return;
    await api.professor.apagarCurso(curso.id);
    await carregar();
  };

  const cursosFiltrados = cursos.filter((curso) => {
    if (filtro === "publicado" && !curso.ativo) return false;
    if (filtro === "rascunho" && curso.ativo) return false;
    if (pesquisa.trim() && !curso.titulo.toLowerCase().includes(pesquisa.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-8">
      <PageHeader title="Meus Cursos" description="Cria, edita e acompanha o desempenho dos teus cursos.">
        <Button onClick={abrirCriar} className="gap-2 bg-gradient-gold text-primary-foreground hover:opacity-95 shadow-gold">
          <Plus className="h-4 w-4" />
          Criar curso
        </Button>
      </PageHeader>

      {!loading && cursos.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)}
              placeholder="Pesquisar curso…"
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
          <p className="mt-3 text-sm">A carregar cursos…</p>
        </div>
      ) : cursos.length === 0 ? (
        <Card className="p-10 text-center shadow-soft">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-border bg-surface/60">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="mt-4 font-serif text-lg">Ainda não tens cursos.</p>
          <p className="text-sm text-muted-foreground mt-1">Cria o teu primeiro curso para começares.</p>
        </Card>
      ) : cursosFiltrados.length === 0 ? (
        <Card className="p-10 text-center shadow-soft text-muted-foreground">
          Nenhum curso corresponde à pesquisa/filtro.
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {cursosFiltrados.map((curso) => (
            <Card key={curso.id} className="overflow-hidden shadow-soft flex flex-col">
              <div
                className="relative h-28 w-full bg-gradient-gold/20 bg-cover bg-center"
                style={curso.thumbnail ? { backgroundImage: `url('${curso.thumbnail}')` } : undefined}
              >
                <div className="absolute right-3 top-3">
                  {curso.ativo ? (
                    <Badge className="bg-emerald-500/90 text-white border-0 shadow">Publicado</Badge>
                  ) : (
                    <Badge className="bg-amber-500/90 text-white border-0 shadow">Rascunho</Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-3 p-5">
                <div>
                  <p className="font-serif text-lg font-semibold truncate">{curso.titulo}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                    <span>{curso.categoria || "Sem categoria"}</span>
                    <span>·</span>
                    <span>{curso.videos.length} aula{curso.videos.length === 1 ? "" : "s"}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> atualizado {tempoRelativo(curso.atualizado_em)}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {curso.total_inscritos}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" /> {curso.total_visualizacoes}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Conclusão média</span>
                    <span className="font-medium tabular-nums text-foreground">{curso.conclusao_media}%</span>
                  </div>
                  <Progress value={curso.conclusao_media} className="h-1.5" />
                </div>

                <div className="mt-auto flex items-center gap-2 pt-2 border-t border-border/60">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => abrirEditar(curso)}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Link href={`/professor/cursos/${curso.id}`}>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <BarChart3 className="h-3.5 w-3.5" /> Engajamento
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 ml-auto text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                    onClick={() => void apagar(curso)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? "Editar curso" : "Criar curso"}</DialogTitle>
          </DialogHeader>

          <form id="form-curso" onSubmit={submeter} className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className="space-y-2">
                <Label htmlFor="c-titulo">Título</Label>
                <Input id="c-titulo" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-descricao">Descrição</Label>
                <Textarea id="c-descricao" rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="c-categoria">Categoria</Label>
                  <Input
                    id="c-categoria"
                    value={form.categoria_nome}
                    onChange={(e) => setForm({ ...form, categoria_nome: e.target.value })}
                    placeholder="Ex: Programação"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-duracao">Duração</Label>
                  <Input
                    id="c-duracao"
                    value={form.duracao}
                    onChange={(e) => setForm({ ...form, duracao: e.target.value })}
                    placeholder="Ex: 10 horas"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-preco">Preço (AOA)</Label>
                <Input
                  id="c-preco"
                  type="number"
                  value={form.preco ?? ""}
                  onChange={(e) => setForm({ ...form, preco: e.target.value })}
                />
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
                  Se não escolheres uma, é usado automaticamente um frame do primeiro vídeo.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Vídeos do curso</Label>
                <input
                  ref={videosInputRef}
                  type="file"
                  accept="video/*"
                  multiple
                  onChange={onVideosSelecionados}
                  disabled={submetendo}
                  className="sr-only"
                />
                <button
                  type="button"
                  onClick={escolherVideos}
                  disabled={submetendo}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 px-4 py-4 text-sm text-muted-foreground transition hover:border-amber-400/60 hover:text-foreground disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  {editando ? "Adicionar mais vídeos" : "Fazer upload de vídeos (1 ou mais)"}
                </button>

                {editando && editando.videos.length > 0 && (
                  <ul className="space-y-1.5">
                    {editando.videos.map((video) => (
                      <li
                        key={video.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs"
                      >
                        <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                          <Film className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{video.titulo}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => void apagarVideoExistente(video)}
                          disabled={apagandoVideoId === video.id}
                          className="shrink-0 text-red-400 hover:text-red-300 disabled:opacity-50"
                          aria-label={`Remover ${video.titulo}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {videosNovos.length > 0 && (
                  <ul className="space-y-1.5">
                    {videosNovos.map((ficheiro, index) => (
                      <li
                        key={`${ficheiro.name}-${index}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Film className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                          <span className="truncate">{ficheiro.name}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removerVideoNovo(index)}
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
                  <p className="text-sm font-medium">Publicar curso</p>
                  <p className="text-xs text-muted-foreground">Cursos não publicados ficam como rascunho.</p>
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
                form="form-curso"
                disabled={submetendo}
                className="bg-gradient-gold text-primary-foreground hover:opacity-95 shadow-gold"
              >
                {submetendo ? "A guardar…" : editando ? "Guardar alterações" : "Criar curso"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
