"use client";

import Link from "next/link";
import {
  Award, BadgeCheck, BookOpen, Calendar, Coins, Crown, Eye, EyeOff, Flame, GraduationCap, Hand, MessageCircle,
  PlayCircle, Shield, Sparkles, Star, Users, Video, Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatarDataCurta, formatarDuracaoCurta, type PerfilPublico, type PublicacaoPerfil } from "@/lib/api";
import { SectionHeader } from "@/components/eyk";

// Os mesmos ícones da página de gamificação (Badge.icone = nome lucide).
const ICONES_CONQUISTA: Record<string, typeof Sparkles> = {
  PlayCircle, Video, Flame, Shield, Star, Zap, GraduationCap, Award, Users, Calendar, Crown, Coins,
};

export function ConquistasPerfil({ conquistas }: { conquistas: NonNullable<PerfilPublico["conquistas"]> }) {
  return (
    <section>
      <SectionHeader title="Conquistas" />
      {conquistas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ainda sem conquistas desbloqueadas.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {conquistas.map((c) => {
            const Icone = ICONES_CONQUISTA[c.icone] || Sparkles;
            return (
              <li
                key={c.id}
                title={c.descricao}
                className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm"
              >
                <Icone className="h-4 w-4 text-primary" /> {c.nome}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function PublicacoesPerfil({
  publicacoes,
  vazio = "Ainda não publicou nada na comunidade.",
}: {
  publicacoes: PublicacaoPerfil[];
  vazio?: string;
}) {
  return (
    <section>
      <SectionHeader title="Publicações na comunidade" />
      {publicacoes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {publicacoes.map((p) => (
            <Card key={p.id} className="space-y-3 p-4 shadow-soft">
              {p.oculto && (
                <p className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
                  <EyeOff className="h-3.5 w-3.5" /> Ocultada pela moderação — só tu a vês
                </p>
              )}
              <p className="line-clamp-5 whitespace-pre-wrap break-words text-sm leading-relaxed">{p.conteudo}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{p.tempo}</span>
                <span className="inline-flex items-center gap-1"><Hand className="h-3.5 w-3.5" /> {p.gostos}</span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5" /> {p.comentarios}
                </span>
                {!p.oculto && (
                  <Link href={`/comunidade?post=${p.id}`} className="hit ml-auto font-medium text-primary hover:underline">
                    Ver na comunidade
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

export function CursosConcluidosPerfil({
  cursos,
}: {
  cursos: NonNullable<PerfilPublico["listaCursosConcluidos"]>;
}) {
  return (
    <section>
      <SectionHeader title="Cursos concluídos" />
      {cursos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ainda nenhum curso concluído.</p>
      ) : (
        <Card className="divide-y shadow-soft">
          {cursos.map((c) => (
            <div key={c.cursoId} className="flex flex-wrap items-center gap-3 p-4">
              <GraduationCap className="h-5 w-5 shrink-0 text-success" />
              <div className="min-w-0 flex-1">
                <Link href={`/cursos/${c.cursoId}`} className="font-medium hover:underline">
                  {c.titulo}
                </Link>
                {c.concluidoEm && (
                  <p className="text-xs text-muted-foreground">Concluído a {formatarDataCurta(c.concluidoEm)}</p>
                )}
              </div>
              {c.certificado && (
                <Link
                  href={`/certificados/${c.certificado}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <BadgeCheck className="h-3.5 w-3.5" /> Certificado verificado
                </Link>
              )}
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}

export function ConteudoProfessor({ perfil }: { perfil: PerfilPublico }) {
  return (
    <>
      <section>
        <SectionHeader title="Cursos" />
        {perfil.cursos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ainda sem cursos publicados.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {perfil.cursos.map((c) => (
              <Link key={c.id} href={`/cursos/${c.id}`} className="group">
                <Card className="overflow-hidden shadow-soft transition-shadow group-hover:shadow-elevated">
                  <div className="aspect-video bg-gradient-gold">
                    {c.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.thumbnail} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="space-y-1 p-4">
                    <p className="line-clamp-2 font-medium">{c.titulo}</p>
                    <p className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {c.alunos}</span>
                      {c.media !== null && (
                        <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5" /> {c.media}</span>
                      )}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
      <section>
        <SectionHeader title="Vídeos" />
        {perfil.videos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ainda sem vídeos publicados.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {perfil.videos.map((v) => (
              <Link key={v.id} href={`/videos/${v.id}`} className="group">
                <Card className="overflow-hidden shadow-soft transition-shadow group-hover:shadow-elevated">
                  <div className="relative aspect-video bg-black/80">
                    {v.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.thumbnail} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <PlayCircle className="absolute inset-0 m-auto h-10 w-10 text-white/70" />
                    )}
                    {v.duracaoSegundos > 0 && (
                      <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white">
                        {formatarDuracaoCurta(v.duracaoSegundos)}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 p-4">
                    <p className="line-clamp-2 font-medium">{v.titulo}</p>
                    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Eye className="h-3.5 w-3.5" /> {v.views} visualizações
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export function IconeTipoConta({ professor }: { professor: boolean }) {
  return professor ? <GraduationCap className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />;
}
