"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Award, BadgeCheck, BookOpen, Camera, Coins, Copy, Download, Eye, Flame, GraduationCap, MailWarning, MessageCircle,
  Pencil, Save, Star, TrendingUp, X, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionHeader, StatCard } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/auth-gate";
import { ConquistasPerfil, PublicacoesPerfil } from "@/components/perfil/secoes";
import { Escolha, LinhaInterruptor, useGuardarPreferencias } from "@/configuracoes/_componentes/preferencias";
import { api, formatarDataCurta, mensagemDeErro, type MeuPerfil } from "@/lib/api";

/** O meu perfil (privado): como eu o vejo e giro — dados, estatísticas,
 * certificados, publicações e o que aparece no perfil público. */
export default function MeuPerfilPage() {
  const { user, refresh } = useAuth();
  const guardarPreferencias = useGuardarPreferencias();
  const [dados, setDados] = useState<MeuPerfil | null>(null);
  const [erro, setErro] = useState(false);

  const carregar = useCallback(() => {
    api.perfil
      .meu()
      .then(setDados)
      .catch(() => setErro(true));
  }, []);
  useEffect(carregar, [carregar]);

  if (erro) return <div className="py-24 text-center text-muted-foreground">Não foi possível carregar o teu perfil.</div>;
  if (!dados || !user) return <div className="py-24 text-center text-muted-foreground">A carregar perfil…</div>;

  const { perfil, estatisticas: est } = dados;
  const privacidade = user.privacidade;

  // Muda uma definição de privacidade e recarrega o perfil (as secções
  // públicas mudam com ela).
  const mudarPrivacidade = async (campos: Parameters<typeof guardarPreferencias>[0]) => {
    if (await guardarPreferencias(campos)) carregar();
  };

  return (
    <div className="space-y-8">
      <PageHeader title="O meu perfil" description="Gere o teu perfil e escolhe o que os outros podem ver.">
        <Button asChild variant="outline" className="gap-2">
          <Link href={`/perfil/${perfil.id}?visitante=1`}>
            <Eye className="h-4 w-4" /> Ver como os outros veem
          </Link>
        </Button>
      </PageHeader>

      <EditarPerfil
        perfil={perfil}
        onGuardado={async () => {
          await refresh();
          carregar();
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {!perfil.isTeacher && (
          <>
            <StatCard icon={Coins} label="Moedas" value={est.moedas} tone="gold" />
            <StatCard icon={Zap} label="XP" value={est.xp} hint={`Nível ${est.nivel}`} />
            <StatCard icon={Flame} label="Ofensiva" value={`${est.ofensiva} dias`} tone="streak" />
            <StatCard icon={GraduationCap} label="Cursos concluídos" value={`${est.cursosConcluidos}/${est.cursosInscritos}`} tone="success" />
          </>
        )}
        <StatCard icon={MessageCircle} label="Publicações" value={est.publicacoes} />
        <StatCard icon={MessageCircle} label="Comentários" value={est.comentarios} />
        {perfil.isTeacher && (
          <>
            <StatCard icon={BookOpen} label="Cursos" value={perfil.totalCursos ?? 0} tone="gold" />
            <StatCard icon={TrendingUp} label="Seguidores" value={perfil.seguidores ?? 0} />
          </>
        )}
      </div>

      {/* O que aparece no perfil público */}
      <section>
        <SectionHeader title="O que os outros veem" />
        <Card className="space-y-5 p-6 shadow-soft">
          <div className="space-y-3">
            <p className="text-sm font-medium">Quem pode ver o meu perfil</p>
            <Escolha
              rotulo="Quem pode ver o meu perfil"
              valor={privacidade?.perfilVisibilidade ?? "todos"}
              onChange={(v) => void mudarPrivacidade({ perfil_visibilidade: v })}
              opcoes={[
                { valor: "todos", label: "Toda a gente" },
                { valor: "cursos", label: "Só colegas de curso" },
              ]}
            />
          </div>
          <div className="divide-y border-t pt-4">
            {!perfil.isTeacher && (
              <LinhaInterruptor
                id="perfil-cursos"
                titulo="Cursos concluídos e certificados"
                descricao="Mostra a lista com o link de verificação de cada certificado."
                valor={privacidade?.mostrarCursos ?? true}
                onChange={(v) => void mudarPrivacidade({ mostrar_cursos_perfil: v })}
              />
            )}
            <LinhaInterruptor
              id="perfil-conquistas"
              titulo="Conquistas e nível"
              descricao="Os badges que já desbloqueaste."
              valor={privacidade?.mostrarConquistas ?? true}
              onChange={(v) => void mudarPrivacidade({ mostrar_conquistas_perfil: v })}
            />
            <LinhaInterruptor
              id="perfil-publicacoes"
              titulo="Publicações na comunidade"
              descricao="As últimas publicações que fizeste."
              valor={privacidade?.mostrarPublicacoes ?? true}
              onChange={(v) => void mudarPrivacidade({ mostrar_publicacoes_perfil: v })}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Email, nome de utilizador, moedas e a tua atividade nunca aparecem no perfil público. Mais opções em{" "}
            <Link href="/configuracoes?tab=privacidade" className="text-primary hover:underline">
              Configurações → Privacidade
            </Link>
            .
          </p>
        </Card>
      </section>

      {!perfil.isTeacher && <Certificados dados={dados} />}

      {dados.emCurso.length > 0 && (
        <section>
          <SectionHeader title="Cursos em andamento" />
          <Card className="divide-y shadow-soft">
            {dados.emCurso.map((c) => (
              <Link key={c.cursoId} href={`/cursos/${c.cursoId}`} className="flex items-center gap-3 p-4 hover:bg-surface/60">
                <BookOpen className="h-5 w-5 shrink-0 text-primary" />
                <span className="flex-1 font-medium">{c.curso}</span>
                <span className="text-xs text-muted-foreground">Inscrito a {formatarDataCurta(c.inscritoEm)}</span>
              </Link>
            ))}
          </Card>
        </section>
      )}

      {perfil.conquistas && <ConquistasPerfil conquistas={perfil.conquistas} />}

      <PublicacoesPerfil
        publicacoes={dados.publicacoes}
        vazio="Ainda não publicaste nada. Partilha o teu progresso na Comunidade!"
      />

      {dados.avaliacoes.length > 0 && (
        <section>
          <SectionHeader title="As minhas avaliações" />
          <Card className="divide-y shadow-soft">
            {dados.avaliacoes.map((a) => (
              <div key={a.cursoId} className="space-y-1 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/cursos/${a.cursoId}`} className="font-medium hover:underline">
                    {a.curso}
                  </Link>
                  <span className="inline-flex items-center gap-0.5 text-sm text-primary">
                    {a.estrelas} <Star className="h-3.5 w-3.5 fill-current" />
                  </span>
                  <span className="text-xs text-muted-foreground">{a.tempo}</span>
                  {a.oculto && <Badge variant="outline" className="text-[10px]">Ocultada pela moderação</Badge>}
                </div>
                {a.comentario && <p className="text-sm text-muted-foreground">{a.comentario}</p>}
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

function EditarPerfil({ perfil, onGuardado }: { perfil: MeuPerfil["perfil"]; onGuardado: () => Promise<void> }) {
  const [aEditar, setAEditar] = useState(false);
  const [bio, setBio] = useState(perfil.bio);
  const [nomePublico, setNomePublico] = useState(perfil.nomePublico || perfil.name);
  const [area, setArea] = useState(perfil.area || "");
  const [aGuardar, setAGuardar] = useState(false);
  const fotoRef = useRef<HTMLInputElement>(null);

  const guardar = async (foto?: File | null) => {
    setAGuardar(true);
    try {
      if (perfil.isTeacher) {
        await api.professor.atualizarPerfil({ bio, nome_publico: nomePublico, area }, foto);
      } else {
        const res = await api.perfil.atualizarAluno(bio, foto);
        if (res && (res as { ok?: boolean; error?: string }).ok === false) {
          throw new Error((res as { error?: string }).error || "");
        }
      }
      await onGuardado();
      setAEditar(false);
      toast.success(foto ? "Foto atualizada." : "Perfil atualizado.");
    } catch (err) {
      toast.error(mensagemDeErro(err, err instanceof Error && err.message ? err.message : "Não foi possível guardar."));
    } finally {
      setAGuardar(false);
    }
  };

  return (
    <Card className="space-y-5 p-6 shadow-soft">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-gradient-gold font-serif text-3xl font-bold text-primary-foreground shadow-md">
            {perfil.foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={perfil.foto} alt="" className="h-full w-full object-cover" />
            ) : (
              perfil.initials
            )}
          </div>
          <input
            ref={fotoRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void guardar(f);
            }}
          />
          <button
            type="button"
            onClick={() => fotoRef.current?.click()}
            disabled={aGuardar}
            aria-label="Alterar foto de perfil"
            className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border border-border bg-background shadow-sm transition hover:bg-surface"
          >
            <Camera className="h-4 w-4" />
          </button>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          {aEditar ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {perfil.isTeacher && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="meu-nome">Nome público</Label>
                    <Input id="meu-nome" value={nomePublico} onChange={(e) => setNomePublico(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minha-area">Área</Label>
                    <Input id="minha-area" value={area} onChange={(e) => setArea(e.target.value)} />
                  </div>
                </>
              )}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="minha-bio">Biografia</Label>
                <Textarea id="minha-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={1000} />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Button onClick={() => void guardar()} disabled={aGuardar} className="gap-2">
                  <Save className="h-4 w-4" /> {aGuardar ? "A guardar…" : "Guardar"}
                </Button>
                <Button variant="ghost" onClick={() => setAEditar(false)} className="gap-2">
                  <X className="h-4 w-4" /> Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-serif text-2xl font-semibold">{perfil.nomePublico || perfil.name}</h2>
                <Badge variant="outline">{perfil.isTeacher ? "Professor" : "Aluno"}</Badge>
              </div>
              {perfil.isTeacher && perfil.area && <p className="text-sm text-muted-foreground">{perfil.area}</p>}
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {perfil.bio || "Ainda não escreveste uma biografia. Conta aos outros quem és e o que estás a aprender."}
              </p>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setAEditar(true)}>
                <Pencil className="h-4 w-4" /> Editar perfil
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function Certificados({ dados }: { dados: MeuPerfil }) {
  const copiar = (codigo: string) => {
    void navigator.clipboard?.writeText(`${window.location.origin}/certificados/${codigo}`);
    toast.success("Link de verificação copiado.");
  };

  return (
    <section>
      <SectionHeader title="Os meus certificados" />
      {!dados.conta.emailVerificado && dados.certificados.length > 0 && (
        <p className="mb-3 inline-flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          <MailWarning className="h-4 w-4" /> Confirma o teu email para descarregares os certificados.
        </p>
      )}
      {dados.certificados.length === 0 ? (
        <Card className="flex items-center gap-3 p-5 text-sm text-muted-foreground shadow-soft">
          <Award className="h-5 w-5" /> Conclui um curso para receberes o teu primeiro certificado.
        </Card>
      ) : (
        <Card className="divide-y shadow-soft">
          {dados.certificados.map((c) => (
            <div key={c.codigo} className="flex flex-wrap items-center gap-3 p-4">
              <Award className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <Link href={`/cursos/${c.cursoId}`} className="font-medium hover:underline">
                  {c.curso}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {c.professor}
                  {c.concluidoEm && ` · concluído a ${formatarDataCurta(c.concluidoEm)}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {dados.conta.emailVerificado && (
                  <Button asChild size="sm" className="gap-1.5">
                    <a href={api.certificadoUrl(c.cursoId)} download>
                      <Download className="h-3.5 w-3.5" /> PDF
                    </a>
                  </Button>
                )}
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <Link href={`/certificados/${c.codigo}`}>
                    <BadgeCheck className="h-3.5 w-3.5" /> Verificar
                  </Link>
                </Button>
                <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => copiar(c.codigo)}>
                  <Copy className="h-3.5 w-3.5" /> Copiar link
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}
