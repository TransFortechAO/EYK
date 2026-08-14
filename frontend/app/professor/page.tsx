"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Video, Users, Save, Shield } from "lucide-react";
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
      <PageHeader title="Painel do Professor" description="Gere o teu perfil público, cursos e vídeos." />

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/professor/cursos">
          <Card className="p-5 shadow-soft hover:shadow-elevated transition-shadow cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15 text-amber-300">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Meus Cursos</p>
                <p className="text-xs text-muted-foreground">Criar, editar e ver engajamento</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/professor/videos">
          <Card className="p-5 shadow-soft hover:shadow-elevated transition-shadow cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-500/15 text-sky-300">
                <Video className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Meus Vídeos</p>
                <p className="text-xs text-muted-foreground">Publicar e gerir vídeos</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/configuracoes">
          <Card className="p-5 shadow-soft hover:shadow-elevated transition-shadow cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Segurança da conta</p>
                <p className="text-xs text-muted-foreground">Palavra-passe, 2FA, apagar conta</p>
              </div>
            </div>
          </Card>
        </Link>
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
