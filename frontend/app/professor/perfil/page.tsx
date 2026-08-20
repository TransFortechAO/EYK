"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Users } from "lucide-react";
import { PageHeader } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { api, type ProfessorPerfil } from "@/lib/api";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function ProfessorPerfilPage() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<ProfessorPerfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [nomePublico, setNomePublico] = useState("");
  const [area, setArea] = useState("");
  const [bio, setBio] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    api.professor
      .getPerfil()
      .then((p) => {
        setPerfil(p);
        setNomePublico(p.nome_publico);
        setArea(p.area);
        setBio(p.bio || "");
      })
      .finally(() => setLoading(false));
  }, []);

  const guardar = async () => {
    setSaveState("saving");
    try {
      const p = await api.professor.atualizarPerfil({ nome_publico: nomePublico, area, bio });
      setPerfil(p);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    } finally {
      setTimeout(() => setSaveState("idle"), 2500);
    }
  };

  const initials = (nomePublico || "P").trim().slice(0, 2).toUpperCase();

  return (
    <div className="space-y-8">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-2 gap-1.5" onClick={() => router.push("/professor")}>
          <ArrowLeft className="h-4 w-4" /> Painel do Professor
        </Button>
        <PageHeader title="Perfil do Professor" description="Como os alunos te veem na plataforma." />
      </div>

      {loading ? (
        <Card className="p-10 text-center text-muted-foreground shadow-soft">A carregar perfil…</Card>
      ) : (
        <Card className="p-6 shadow-soft space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <Avatar className="h-20 w-20 shadow-md">
              <AvatarFallback className="text-2xl bg-gradient-gold text-primary-foreground font-serif font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <p className="font-serif text-xl font-semibold">{perfil?.nome_publico}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="gap-1 text-xs">
                  <Users className="h-3 w-3" /> {perfil?.seguidores ?? 0} seguidores
                </Badge>
                <Badge className={perfil?.ativo ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-amber-500/15 text-amber-300 border-amber-500/30"}>
                  {perfil?.ativo ? "Perfil ativo" : "Perfil pendente"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nome-publico">Nome público</Label>
              <Input id="nome-publico" value={nomePublico} onChange={(e) => setNomePublico(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area">Área de atuação</Label>
              <Input id="area" value={area} onChange={(e) => setArea(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bio">Biografia</Label>
              <Textarea id="bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void guardar()} disabled={saveState === "saving"} className="gap-2">
              <Save className="h-4 w-4" />
              {saveState === "saving" ? "A guardar…" : saveState === "saved" ? "Guardado ✓" : saveState === "error" ? "Erro — tenta de novo" : "Guardar alterações"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
