"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen, CalendarClock, Camera, Captions, Dumbbell, Lock, Paperclip, PlayCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useInstituicaoAtual } from "@/components/instituicao/contexto";
import { CarregarVideo, CartaoGesto, VideoLga } from "@/components/instituicao/lga";
import { CartaoResposta } from "@/components/instituicao/turma/respostas";
import { Carregando, dataHora, ErroCarregar, erroTexto, Etiqueta, haQuanto, tamanho, useCarregar } from "@/components/instituicao/ui";
import { apiLga, DURACAO_MAX_RESPOSTA_SEG } from "@/lib/instituicoes/lga";
import type { VideoAnexo } from "@/lib/instituicoes/tipos";

export default function AulaPage() {
  const { id: turmaId, aulaId } = useParams<{ id: string; aulaId: string }>();
  const { instituicaoId, papel } = useInstituicaoAtual();
  const [video, setVideo] = useState<VideoAnexo | null>(null);
  const [aEnviar, setAEnviar] = useState(false);

  const { dados, erro, aCarregar, recarregar } = useCarregar(async () => {
    const [aula, respostas, permissao] = await Promise.all([
      apiLga.obterAula(instituicaoId, aulaId),
      apiLga.listarRespostas(instituicaoId, { aulaId }),
      papel === "aluno" ? apiLga.podeResponder(instituicaoId) : Promise.resolve(null),
    ]);
    return { ...aula, respostas, permissao };
  }, [instituicaoId, aulaId, papel]);

  if (aCarregar && !dados) return <Carregando />;
  if (!dados) return <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />;

  const { aula, gestos, conteudo, ensino, respostas, permissao } = dados;
  const ultima = papel === "aluno" ? respostas[0] : undefined;
  const podeGravar = papel === "aluno" && aula.pedeResposta && permissao?.pode && (!ultima || ultima.estado === "repetir");
  const linkConteudo = aula.conteudo
    ? aula.conteudo.origem === "escola"
      ? `/instituicao/conteudos/${aula.conteudo.id}`
      : aula.conteudo.tipo === "curso"
        ? `/cursos/${aula.conteudo.id}`
        : `/videos/${aula.conteudo.id}`
    : null;

  const enviar = async () => {
    if (!video) return;
    setAEnviar(true);
    try {
      await apiLga.enviarResposta(instituicaoId, aula.id, video);
      toast.success("Resposta enviada. O professor vai ver e responder.");
      setVideo(null);
      await recarregar();
    } catch (err) {
      toast.error(erroTexto(err));
    } finally {
      setAEnviar(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link href={`/instituicao/turmas/${turmaId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {dados.turma.nome}
      </Link>

      <div>
        <h2 className="font-serif text-2xl font-semibold">{aula.titulo}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            {aula.autor} · {haQuanto(aula.publicadaEm)}
          </span>
          {aula.legendaPt && (
            <Etiqueta>
              <Captions className="h-3 w-3" aria-hidden /> Legendas em português
            </Etiqueta>
          )}
          {aula.prazo && (
            <Etiqueta tom="aviso">
              <CalendarClock className="h-3 w-3" aria-hidden /> Até {dataHora(aula.prazo)}
            </Etiqueta>
          )}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          {aula.tipo === "aula" ? (
            <VideoLga video={aula.video} glyph={gestos[0]?.glyph ?? "🤟"} motion={gestos[0]?.motion ?? "wave"} titulo={aula.titulo} />
          ) : (
            aula.conteudo &&
            linkConteudo && (
              <Card className="flex items-center gap-4 p-5 shadow-soft">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                  {aula.conteudo.tipo === "curso" ? <BookOpen className="h-6 w-6" aria-hidden /> : <PlayCircle className="h-6 w-6" aria-hidden />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">
                    {aula.conteudo.tipo === "curso" ? "Curso" : "Vídeo"} {aula.conteudo.origem === "escola" ? "da escola" : "do catálogo EYK"}
                    {conteudo ? ` · ${conteudo.duracaoMin} min` : ""}
                  </p>
                  <p className="font-medium">{aula.conteudo.titulo}</p>
                </div>
                <Button asChild>
                  <Link href={linkConteudo}>Abrir</Link>
                </Button>
              </Card>
            )
          )}
          {aula.descricao && <p className="whitespace-pre-line text-sm">{aula.descricao}</p>}

          {aula.recursos.length > 0 && (
            <Card className="p-4 shadow-soft">
              <p className="mb-2 text-sm font-medium">Recursos</p>
              <ul className="space-y-1.5">
                {aula.recursos.map((r) => (
                  <li key={r.nome}>
                    <button
                      type="button"
                      onClick={() => toast.info("Na demonstração o ficheiro não é descarregado.")}
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <Paperclip className="h-3.5 w-3.5" aria-hidden /> {r.nome}
                    </button>
                    <span className="ml-1.5 text-xs text-muted-foreground">{tamanho(r.tamanhoBytes)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {aula.pedeResposta && (
            <Card className="space-y-3 border-primary/40 p-5 shadow-soft">
              <p className="flex items-center gap-2 font-medium">
                <Camera className="h-4 w-4 text-primary" aria-hidden /> Resposta em vídeo
              </p>
              <p className="rounded-lg bg-primary/10 p-3 text-sm">{aula.enunciado}</p>
              {papel === "aluno" && (
                <>
                  {permissao && !permissao.pode && <p className="rounded-md bg-amber-500/10 p-3 text-sm">{permissao.motivo}</p>}
                  {podeGravar && (
                    <div className="space-y-2">
                      {ultima?.estado === "repetir" && <p className="text-xs text-muted-foreground">O professor pediu para repetir. Vê o comentário abaixo e grava de novo.</p>}
                      <CarregarVideo id="resposta" valor={video} onChange={setVideo} captura="user" rotulo="Gravar a minha resposta" />
                      <p className="text-xs text-muted-foreground">Até {DURACAO_MAX_RESPOSTA_SEG} segundos. Só o professor e a tua família vêem.</p>
                      <Button className="w-full gap-1.5" disabled={!video || aEnviar} onClick={() => void enviar()}>
                        <Send className="h-4 w-4" /> {aEnviar ? "A enviar…" : "Enviar ao professor"}
                      </Button>
                    </div>
                  )}
                  {ultima?.estado === "por_rever" && <p className="text-sm text-muted-foreground">Enviaste a resposta. Espera pelo comentário do professor.</p>}
                  {ultima?.estado === "correto" && <p className="text-sm font-medium text-success">Resposta correta. Muito bem!</p>}
                </>
              )}
              {!ensino && papel !== "aluno" && papel !== "familia" && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" aria-hidden /> As respostas só são vistas por quem ensina na turma, pelo aluno e pela família.
                </p>
              )}
            </Card>
          )}

          {gestos.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Gestos desta aula ({gestos.length})</p>
                <Button asChild variant="ghost" size="sm" className="gap-1.5">
                  <Link href="/instituicao/praticar">
                    <Dumbbell className="h-4 w-4" /> Praticar
                  </Link>
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {gestos.slice(0, 12).map((g) => (
                  <CartaoGesto key={g.id} gesto={g} compacto />
                ))}
              </div>
              {gestos.length > 12 && <p className="text-xs text-muted-foreground">e mais {gestos.length - 12} no gestuário.</p>}
            </div>
          )}
        </div>
      </div>

      {aula.pedeResposta && respostas.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-serif text-lg font-semibold">
            {ensino ? `Respostas (${respostas.length})` : papel === "aluno" ? "As minhas tentativas" : "Respostas da criança"}
          </h3>
          <div className="grid gap-4 lg:grid-cols-2">
            {respostas.map((r) => (
              <CartaoResposta key={r.id} resposta={r} turmaId={turmaId} ensino={ensino} tituloAula={ensino ? undefined : aula.titulo} aoMudar={recarregar} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
