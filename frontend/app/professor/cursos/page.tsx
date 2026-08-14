"use client";

import { useEffect, useState, type FormEvent } from "react";
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
} from "lucide-react";
import { PageHeader } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  const [submetendo, setSubmetendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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
    setErro(null);
    setModalAberto(true);
  };

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.descricao.trim()) {
      setErro("Título e descrição são obrigatórios.");
      return;
    }
    setSubmetendo(true);
    setErro(null);
    try {
      if (editando) {
        await api.professor.atualizarCurso(editando.id, form);
      } else {
        await api.professor.criarCurso(form);
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

      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModalAberto(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <Card className="w-full max-w-lg shadow-2xl border-border">
            <div className="flex items-center justify-between gap-4 border-b border-border p-5">
              <h2 className="font-serif text-xl font-semibold">{editando ? "Editar curso" : "Criar curso"}</h2>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="text-muted-foreground hover:text-foreground transition rounded-md p-1"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submeter} className="p-5 space-y-4">
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
              <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Publicar curso</p>
                  <p className="text-xs text-muted-foreground">Cursos não publicados ficam como rascunho.</p>
                </div>
                <Switch checked={Boolean(form.ativo)} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              </div>

              {erro && <p className="text-sm text-red-400">{erro}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setModalAberto(false)} disabled={submetendo}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submetendo} className="bg-gradient-gold text-primary-foreground hover:opacity-95 shadow-gold">
                  {submetendo ? "A guardar…" : editando ? "Guardar alterações" : "Criar curso"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
