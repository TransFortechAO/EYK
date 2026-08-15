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
} from "lucide-react";
import { PageHeader } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, type ProfessorCurso, type ProfessorCursoPayload } from "@/lib/api";

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
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<ProfessorCurso | null>(null);
  const [form, setForm] = useState<ProfessorCursoPayload>(EMPTY_FORM);
  const [videosNovos, setVideosNovos] = useState<File[]>([]);
  const [apagandoVideoId, setApagandoVideoId] = useState<number | null>(null);
  const [submetendo, setSubmetendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const videosInputRef = useRef<HTMLInputElement>(null);

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
    setErro(null);
    setModalAberto(true);
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

  return (
    <div className="space-y-8">
      <PageHeader title="Meus Cursos" description="Cria, edita e acompanha o desempenho dos teus cursos.">
        <Button onClick={abrirCriar} className="gap-2 bg-gradient-gold text-primary-foreground hover:opacity-95 shadow-gold">
          <Plus className="h-4 w-4" />
          Criar curso
        </Button>
      </PageHeader>

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
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cursos.map((curso) => (
            <Card key={curso.id} className="p-5 shadow-soft flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{curso.titulo}</p>
                  <p className="text-xs text-muted-foreground">{curso.categoria || "Sem categoria"}</p>
                </div>
                {curso.ativo ? (
                  <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shrink-0">Publicado</Badge>
                ) : (
                  <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 shrink-0">Rascunho</Badge>
                )}
              </div>

              <p className="text-sm text-muted-foreground line-clamp-2">{curso.descricao}</p>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {curso.total_inscritos} inscritos
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" /> {curso.total_visualizacoes} vistas
                </span>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border/60">
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
