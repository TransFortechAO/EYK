// Ensino de LGA de uma instituição real (apps.instituicoes): a mesma forma de apiLga.
// Os vídeos e recursos só são enviados quando se publica (e nunca ficam em /media:
// cada pedido ao ficheiro é verificado pelo servidor).
import { gestosPlataforma } from "./demo-lga";
import { ErroInstituicao } from "./erros";
import { ficheiroDoVideo } from "./media-sessao";
import { json, pedido } from "./servidor";
import type {
  Ambito,
  Aula,
  ComentarioTurma,
  Competencia,
  ConteudoAtribuido,
  ConteudoEscola,
  Convite,
  Desafio,
  Gesto,
  Grupo,
  Membro,
  NivelLga,
  PostTurma,
  PublicoTurmaLga,
  RecursoAula,
  RespostaVideo,
  TemaGesto,
  VideoAnexo,
} from "./tipos";

/** O que este membro guardou na escola. */
export type SalvosEscola = {
  conteudos: ConteudoEscola[];
  aulas: (Aula & { turmaNome: string })[];
  posts: (PostTurma & { turmaNome: string })[];
};

type TurmaLga = Grupo & { lga: NonNullable<Grupo["lga"]> };
type DesafioComProgresso = Desafio & { progresso: number; concluido: boolean; turmaNome: string | null };
type NivelMestria = "por_comecar" | "a_comecar" | "a_progredir" | "dominado";
type Resumo = {
  tarefas: { aula: Aula; turma: string; estado: "por_fazer" | "repetir" }[];
  aulasNovas: { aula: Aula; turma: string }[];
  porRever: number;
  feedbackNovo: RespostaVideo[];
  desafios: DesafioComProgresso[];
  avisosPorLer: number;
  proximoEvento: Awaited<ReturnType<typeof import("./servidor").apiEscolaReal.listarEventos>>[number] | null;
};

async function subir(id: string, ficheiro: File, duracaoSeg?: number | null): Promise<string> {
  const corpo = new FormData();
  corpo.append("ficheiro", ficheiro);
  if (duracaoSeg) corpo.append("duracaoSeg", String(duracaoSeg));
  const r = await pedido<VideoAnexo>(`${id}/anexos/`, { method: "POST", body: corpo });
  if (!r.id) throw new ErroInstituicao("Não foi possível guardar o ficheiro.");
  return r.id;
}

/** Envia o vídeo escolhido e devolve o id; um vídeo já no servidor não volta a ser enviado. */
async function subirVideo(id: string, video: VideoAnexo | null | undefined): Promise<string | null> {
  if (!video) return null;
  if (video.id) return video.id;
  const ficheiro = ficheiroDoVideo(video);
  if (!ficheiro) throw new ErroInstituicao("Escolhe o vídeo de novo: perdeu-se ao recarregar a página.");
  return subir(id, ficheiro, video.duracaoSeg);
}

async function subirRecursos(id: string, recursos: RecursoAula[]): Promise<string[]> {
  return Promise.all(
    recursos.map((r) => {
      if (r.id) return r.id;
      if (!r.ficheiro) throw new ErroInstituicao(`Escolhe «${r.nome}» de novo.`);
      return subir(id, r.ficheiro);
    }),
  );
}

export const apiLgaReal = {
  // ── Turmas ──
  listarTurmas(id: string): Promise<(TurmaLga & { aprendizes: number; professores: number; aulas: number; porRever: number; pendentes: number })[]> {
    return pedido(`${id}/turmas/`);
  },

  obterTurma(
    id: string,
    turmaId: string,
  ): Promise<{
    turma: TurmaLga;
    professores: Membro[];
    aprendizes: Membro[];
    familias: Membro[];
    codigos: { alunos: Convite | null; familias: Convite | null };
    ensino: boolean;
  }> {
    return pedido(`${id}/turmas/${turmaId}/`);
  },

  criarTurma(
    id: string,
    dados: { nome: string; publico: PublicoTurmaLga; nivel: NivelLga; anoLetivo: string; descricao: string },
  ): Promise<TurmaLga> {
    return pedido(`${id}/turmas/`, json(dados));
  },

  // ── Aulas ──
  listarAulas(id: string, turmaId: string): Promise<(Aula & { minhaResposta: RespostaVideo | null; respostas: { total: number; porRever: number } | null })[]> {
    return pedido(`${id}/turmas/${turmaId}/aulas/`);
  },

  async obterAula(id: string, aulaId: string): Promise<{ aula: Aula; turma: TurmaLga; gestos: Gesto[]; conteudo: ConteudoEscola | null; ensino: boolean }> {
    const r = await pedido<{ aula: Aula; turma: TurmaLga; gestos: Gesto[]; conteudo: ConteudoEscola | null; ensino: boolean }>(`${id}/aulas/${aulaId}/`);
    const todos = [...gestosPlataforma(Date.now()), ...r.gestos];
    return { ...r, gestos: r.aula.gestosIds.map((g) => todos.find((x) => x.id === g)).filter((g): g is Gesto => !!g) };
  },

  async publicarAula(
    id: string,
    turmaId: string,
    dados: {
      tipo: Aula["tipo"];
      titulo: string;
      descricao: string;
      video: VideoAnexo | null;
      legendaPt: boolean;
      gestosIds: string[];
      recursos: RecursoAula[];
      conteudo: ConteudoAtribuido | null;
      prazo: string | null;
      pedeResposta: boolean;
      enunciado: string;
    },
  ): Promise<Aula> {
    const { video, recursos, ...resto } = dados;
    const [videoId, recursosIds] = await Promise.all([subirVideo(id, video), subirRecursos(id, recursos)]);
    return pedido(`${id}/turmas/${turmaId}/aulas/`, json({ ...resto, videoId, recursosIds }));
  },

  // ── Respostas em vídeo ──
  listarRespostas(id: string, filtro: { turmaId?: string; aulaId?: string }): Promise<RespostaVideo[]> {
    const q = new URLSearchParams(filtro as Record<string, string>).toString();
    return pedido(`${id}/respostas/${q ? `?${q}` : ""}`);
  },

  podeResponder(id: string): Promise<{ pode: boolean; motivo: string | null }> {
    return pedido(`${id}/respostas/pode/`);
  },

  async enviarResposta(id: string, aulaId: string, video: VideoAnexo): Promise<RespostaVideo> {
    return pedido(`${id}/aulas/${aulaId}/respostas/`, json({ videoId: await subirVideo(id, video) }));
  },

  async darFeedback(id: string, respostaId: string, dados: { estado: "correto" | "repetir"; texto: string; video: VideoAnexo | null }): Promise<RespostaVideo> {
    const videoId = await subirVideo(id, dados.video);
    return pedido(`${id}/respostas/${respostaId}/feedback/`, json({ estado: dados.estado, texto: dados.texto, videoId }));
  },

  // ── Gestuário: o da plataforma mais os contributos das escolas ──
  async listarGestos(id: string): Promise<Gesto[]> {
    const daEscola = await pedido<Gesto[]>(`${id}/gestos/`);
    return [...gestosPlataforma(Date.now()), ...daEscola];
  },

  /** Para a Biblioteca LGA (fora de uma escola). Sem sessão, ficam os gestos da plataforma. */
  async gestosBiblioteca(): Promise<Gesto[]> {
    const daEscola = await pedido<Gesto[]>("gestos-validados/").catch(() => []);
    return [...gestosPlataforma(Date.now()), ...daEscola];
  },

  async proporGesto(
    id: string,
    dados: { palavra: string; tema: TemaGesto; variante: string; descricao: string; video: VideoAnexo | null },
  ): Promise<Gesto> {
    const { video, ...resto } = dados;
    return pedido(`${id}/gestos/`, json({ ...resto, videoId: await subirVideo(id, video) }));
  },

  validarGesto(id: string, gestoId: string, aprovar: boolean, nota: string): Promise<Gesto> {
    return pedido(`${id}/gestos/${gestoId}/validar/`, json({ aprovar, nota }));
  },

  // ── Prática ──
  registarPratica(id: string, dados: { competencia: Competencia; tema: TemaGesto; certo: boolean }): Promise<{ pontos: number; desafiosConcluidos: Desafio[] }> {
    return pedido(`${id}/pratica/`, json(dados));
  },

  meuProgresso(id: string): Promise<{ competencias: Record<Competencia, { mestria: number; nivel: NivelMestria; tentativas: number }>; pontos: number }> {
    return pedido(`${id}/progresso/`);
  },

  progressoTurma(id: string, turmaId: string): Promise<{ alunos: { id: string; nome: string; competencias: Record<Competencia, number>; respostasCorretas: number }[]; media: Record<Competencia, number> }> {
    return pedido(`${id}/turmas/${turmaId}/progresso/`);
  },

  // ── Conteúdos ──
  listarConteudos(id: string, tipo?: ConteudoEscola["tipo"]): Promise<ConteudoEscola[]> {
    return pedido(`${id}/conteudos/${tipo ? `?tipo=${tipo}` : ""}`);
  },

  obterConteudo(id: string, conteudoId: string): Promise<ConteudoEscola> {
    return pedido(`${id}/conteudos/${conteudoId}/`);
  },

  async publicarConteudo(
    id: string,
    dados: {
      tipo: ConteudoEscola["tipo"];
      titulo: string;
      descricao: string;
      ambito: Exclude<Ambito, { tipo: "publico" }>;
      duracaoMin: number;
      aulas: number;
      temLegendas: boolean;
      emLga: boolean;
      video?: VideoAnexo | null;
    },
  ): Promise<ConteudoEscola> {
    const { video, ...resto } = dados;
    return pedido(`${id}/conteudos/`, json({ ...resto, videoId: await subirVideo(id, video) }));
  },

  proporPublico(id: string, conteudoId: string): Promise<ConteudoEscola> {
    return pedido(`${id}/conteudos/${conteudoId}/propor/`, { method: "POST" });
  },

  /** Equipa EYK: propostas das escolas para a plataforma geral. */
  listarPropostasPublicas(): Promise<(ConteudoEscola & { escola: string })[]> {
    return pedido("admin/propostas/");
  },

  async decidirPropostaPublica(conteudoId: string, aceitar: boolean): Promise<void> {
    await pedido(`admin/propostas/${conteudoId}/`, json({ aceitar }));
  },

  // ── Comunidade da turma ──
  listarPostsTurma(id: string, turmaId: string): Promise<PostTurma[]> {
    return pedido(`${id}/turmas/${turmaId}/posts/`);
  },

  async publicarPostTurma(
    id: string,
    turmaId: string,
    dados: { texto: string; gestoId: string | null; foto?: File | null; temCriancas?: boolean },
  ): Promise<PostTurma> {
    const { foto, ...resto } = dados;
    return pedido(`${id}/turmas/${turmaId}/posts/`, json({ ...resto, fotoId: foto ? await subir(id, foto) : null }));
  },

  gostarPostTurma(id: string, postId: string): Promise<{ gostei: boolean; gostos: number }> {
    return pedido(`${id}/posts/${postId}/gosto/`, { method: "POST" });
  },

  listarComentariosTurma(id: string, postId: string): Promise<ComentarioTurma[]> {
    return pedido(`${id}/posts/${postId}/comentarios/`);
  },

  comentarPostTurma(id: string, postId: string, texto: string): Promise<ComentarioTurma> {
    return pedido(`${id}/posts/${postId}/comentarios/`, json({ texto }));
  },

  async moderarComentarioTurma(id: string, comentarioId: string, visivel: boolean): Promise<void> {
    await pedido(`${id}/comentarios/${comentarioId}/moderar/`, json({ visivel }));
  },

  async denunciarComentarioTurma(id: string, comentarioId: string): Promise<void> {
    await pedido(`${id}/comentarios/${comentarioId}/denunciar/`, { method: "POST" });
  },

  async moderarPostTurma(id: string, postId: string, visivel: boolean): Promise<void> {
    await pedido(`${id}/posts/${postId}/moderar/`, json({ visivel }));
  },

  async denunciarPostTurma(id: string, postId: string): Promise<void> {
    await pedido(`${id}/posts/${postId}/denunciar/`, { method: "POST" });
  },

  // ── Salvos ──
  async salvosIds(id: string): Promise<string[]> {
    return (await pedido<{ ids: string[] }>(`${id}/salvos/ids/`)).ids;
  },

  listarSalvos(id: string): Promise<SalvosEscola> {
    return pedido(`${id}/salvos/`);
  },

  alternarSalvo(id: string, tipo: "conteudo" | "aula" | "post_turma", itemId: string): Promise<{ salvo: boolean }> {
    return pedido(`${id}/salvos/`, json({ tipo, id: itemId }));
  },

  // ── Classificações e desafios ──
  classificacao(id: string, ambito: { turmaId: string } | "escola"): Promise<{ linhas: { posicao: number; nome: string; pontos: number; eu: boolean }[]; participantes: number }> {
    return pedido(`${id}/classificacao/${ambito === "escola" ? "" : `?turmaId=${ambito.turmaId}`}`);
  },

  listarDesafios(id: string): Promise<DesafioComProgresso[]> {
    return pedido(`${id}/desafios/`);
  },

  criarDesafio(
    id: string,
    dados: { titulo: string; descricao: string; turmaId: string | null; competencia: Competencia; tema: TemaGesto | null; meta: number; recompensa: number; dias: number },
  ): Promise<Desafio> {
    return pedido(`${id}/desafios/`, json(dados));
  },

  // ── Plataforma geral e resumo ──
  async verPlataformaGeral(id: string): Promise<boolean> {
    return (await pedido<{ ver: boolean }>(`${id}/ver-geral/`)).ver;
  },

  async definirVerPlataformaGeral(id: string, ver: boolean): Promise<void> {
    await pedido(`${id}/ver-geral/`, json({ ver }, "PUT"));
  },

  resumoEscola(id: string): Promise<Resumo> {
    return pedido(`${id}/resumo/`);
  },
};
