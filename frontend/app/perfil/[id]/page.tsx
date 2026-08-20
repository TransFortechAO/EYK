"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Calendar, GraduationCap, Pencil, Users, Video as VideoIcon } from "lucide-react";
import { StatCard } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, formatarDataCurta, type PerfilPublico } from "@/lib/api";

export default function PerfilPublicoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [perfil, setPerfil] = useState<PerfilPublico | null>(null);
  const [loading, setLoading] = useState(true);
  const [aSeguir, setASeguir] = useState(false);
  const [seguidores, setSeguidores] = useState(0);
  const [seguindoLoading, setSeguindoLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const dados = await api.getPerfilPublico(params.id);
      if (!alive) return;
      setPerfil(dados);
      setASeguir(dados?.aSeguir ?? false);
      setSeguidores(dados?.seguidores ?? 0);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [params.id]);

  const alternarSeguir = async () => {
    if (!perfil?.professorId || seguindoLoading) return;
    setSeguindoLoading(true);
    try {
      const res = await api.toggleSeguirProfessor(perfil.professorId);
      setASeguir(res.seguindo);
      setSeguidores(res.seguidores);
    } finally {
      setSeguindoLoading(false);
    }
  };

  if (loading) {
    return <div className="py-24 text-center text-muted-foreground">A carregar perfil…</div>;
  }

  if (!perfil) {
    return (
      <div className="py-24 text-center">
        <p className="text-muted-foreground">Perfil não encontrado.</p>
        <Button variant="outline" className="mt-4 gap-1.5" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
      </div>
    );
  }

  const nomeExibido = perfil.isTeacher ? perfil.nomePublico || perfil.name : perfil.name;
  const editarHref = perfil.isTeacher ? "/professor/perfil" : "/configuracoes";

  return (
    <div className="space-y-8">
      <Button variant="ghost" size="sm" className="-ml-2 gap-1.5" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      <Card className="p-6 shadow-soft space-y-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div
            className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-gold text-2xl font-serif font-bold text-primary-foreground shadow-md"
            aria-hidden
          >
            {perfil.foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={perfil.foto} alt="" className="h-full w-full object-cover" />
            ) : (
              perfil.initials
            )}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-serif text-xl font-semibold">{nomeExibido}</h1>
              <Badge variant="outline" className="gap-1 text-xs">
                {perfil.isTeacher ? <GraduationCap className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}
                {perfil.isTeacher ? "Professor" : "Aluno"}
              </Badge>
            </div>
            {perfil.isTeacher && perfil.area && (
              <p className="text-sm text-muted-foreground">{perfil.area}</p>
            )}
            {perfil.membroDesde && (
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" /> Membro desde {formatarDataCurta(perfil.membroDesde)}
              </p>
            )}
          </div>

          {perfil.souEu ? (
            <Button variant="outline" className="gap-2 shrink-0" onClick={() => router.push(editarHref)}>
              <Pencil className="h-4 w-4" /> Editar perfil
            </Button>
          ) : perfil.isTeacher && perfil.professorId ? (
            <Button
              variant={aSeguir ? "outline" : "default"}
              className="gap-2 shrink-0"
              disabled={seguindoLoading}
              onClick={() => void alternarSeguir()}
            >
              <Users className="h-4 w-4" /> {aSeguir ? "A seguir" : "Seguir"}
            </Button>
          ) : null}
        </div>

        {perfil.bio && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{perfil.bio}</p>
        )}
      </Card>

      {perfil.isTeacher ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={Users} label="Seguidores" value={seguidores} tone="gold" />
          <StatCard icon={BookOpen} label="Cursos publicados" value={perfil.totalCursos ?? 0} />
          <StatCard icon={VideoIcon} label="Vídeos publicados" value={perfil.totalVideos ?? 0} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard icon={GraduationCap} label="Cursos concluídos" value={perfil.cursosConcluidos ?? 0} tone="success" />
        </div>
      )}
    </div>
  );
}
