"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, BookOpen, Calendar, Eye, GraduationCap, Lock, Pencil, TrendingUp, Users, Video as VideoIcon } from "lucide-react";
import { StatCard } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MenuModeracao, useBloquear } from "@/components/moderacao/denunciar";
import {
  ConquistasPerfil,
  ConteudoProfessor,
  CursosConcluidosPerfil,
  IconeTipoConta,
  PublicacoesPerfil,
} from "@/components/perfil/secoes";
import { api, formatarDataCurta, type PerfilPublico } from "@/lib/api";

export default function PerfilPublicoPage() {
  return (
    <Suspense fallback={null}>
      <PerfilPublicoConteudo />
    </Suspense>
  );
}

/** Perfil público: o que os outros veem (respeita as definições de privacidade
 * do dono). `?visitante=1` no próprio perfil = pré-visualizar como visitante. */
function PerfilPublicoConteudo() {
  const params = useParams<{ id: string }>();
  const comoVisitante = useSearchParams().get("visitante") === "1";
  const router = useRouter();
  const bloquear = useBloquear();
  const [perfil, setPerfil] = useState<PerfilPublico | null>(null);
  const [loading, setLoading] = useState(true);
  const [aSeguir, setASeguir] = useState(false);
  const [seguidores, setSeguidores] = useState(0);
  const [seguindoLoading, setSeguindoLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const dados = await api.getPerfilPublico(params.id, comoVisitante);
      if (!alive) return;
      setPerfil(dados);
      setASeguir(dados?.aSeguir ?? false);
      setSeguidores(dados?.seguidores ?? 0);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [params.id, comoVisitante]);

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

  return (
    <div className="space-y-8">
      <Button variant="ghost" size="sm" className="-ml-2 gap-1.5" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      {comoVisitante && (
        <div className="flex flex-col gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            Estás a ver o teu perfil como um visitante que não partilha cursos contigo o vê.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/perfil">Voltar ao meu perfil</Link>
          </Button>
        </div>
      )}

      <Card className="space-y-6 p-6 shadow-soft">
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
                <IconeTipoConta professor={perfil.isTeacher} />
                {perfil.isTeacher ? "Professor" : "Aluno"}
              </Badge>
              {perfil.nivel !== null && !perfil.privado && (
                <Badge variant="outline" className="text-xs">Nível {perfil.nivel}</Badge>
              )}
            </div>
            {perfil.isTeacher && perfil.area && <p className="text-sm text-muted-foreground">{perfil.area}</p>}
            {perfil.membroDesde && (
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" /> Membro desde {formatarDataCurta(perfil.membroDesde)}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {perfil.souEu ? (
              <Button variant="outline" className="gap-2" onClick={() => router.push("/perfil")}>
                <Pencil className="h-4 w-4" /> Gerir o meu perfil
              </Button>
            ) : perfil.bloqueado ? (
              <Button
                variant="outline"
                onClick={() =>
                  void bloquear(perfil.id, nomeExibido, true).then((b) => {
                    if (b === false) setPerfil({ ...perfil, bloqueado: false });
                  })
                }
              >
                Desbloquear
              </Button>
            ) : (
              perfil.isTeacher &&
              perfil.professorId &&
              !perfil.privado && (
                <Button
                  variant={aSeguir ? "outline" : "default"}
                  className="gap-2"
                  disabled={seguindoLoading}
                  onClick={() => void alternarSeguir()}
                >
                  <Users className="h-4 w-4" /> {aSeguir ? "A seguir" : "Seguir"}
                </Button>
              )
            )}
            {!perfil.souEu && !comoVisitante && !perfil.bloqueado && (
              <MenuModeracao
                tipo="utilizador"
                id={perfil.id}
                autorId={perfil.id}
                autorNome={nomeExibido}
                onBloqueado={() => setPerfil({ ...perfil, bloqueado: true })}
              />
            )}
          </div>
        </div>

        {!perfil.privado && perfil.bio && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{perfil.bio}</p>
        )}
      </Card>

      {perfil.privado ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center shadow-soft">
          <Lock className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Este perfil é privado</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {perfil.bloqueado
              ? "Bloqueaste este utilizador."
              : "Só quem está inscrito nos mesmos cursos pode ver o perfil completo."}
          </p>
        </Card>
      ) : (
        <>
          {perfil.isTeacher ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard icon={Users} label="Seguidores" value={seguidores} tone="gold" />
              <StatCard icon={BookOpen} label="Cursos publicados" value={perfil.totalCursos ?? 0} />
              <StatCard icon={VideoIcon} label="Vídeos publicados" value={perfil.totalVideos ?? 0} />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard icon={GraduationCap} label="Cursos concluídos" value={perfil.cursosConcluidos ?? 0} tone="success" />
              {perfil.nivel !== null && <StatCard icon={TrendingUp} label="Nível" value={perfil.nivel} />}
            </div>
          )}

          {perfil.isTeacher && <ConteudoProfessor perfil={perfil} />}
          {perfil.listaCursosConcluidos && <CursosConcluidosPerfil cursos={perfil.listaCursosConcluidos} />}
          {perfil.conquistas && <ConquistasPerfil conquistas={perfil.conquistas} />}
          {perfil.publicacoes && <PublicacoesPerfil publicacoes={perfil.publicacoes} />}
        </>
      )}
    </div>
  );
}
