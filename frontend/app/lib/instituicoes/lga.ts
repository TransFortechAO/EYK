// API do ensino de LGA nas escolas: Turmas LGA, aulas, respostas em vídeo,
// gestuário, prática por competência, conteúdos da escola (com âmbito),
// comunidade da turma, classificações e desafios.
//
// Como ./api.ts, corre em memória sobre os dados de demonstração; cada função
// corresponde a um endpoint da eyk-api a construir. As regras de privacidade
// e de âmbito aplicadas aqui têm de ser aplicadas também no backend.
import { apiInstituicoes, consentimentosAtuais, ErroInstituicao, _nucleo } from "./api";
import { fimAnoLetivo } from "./demo-lga";
import { registarNoProgresso, mestria, nivelMestria, type NivelMestria } from "./exercicios";
import { competenciaDoTema, ensina, pode, ROTULO_PUBLICO_LGA } from "./permissoes";
import type {
  Ambito,
  Aula,
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

const { carregar, guardar, esperar, novoId, gerarCodigo, instituicao, eu, exigir, auditar } = _nucleo;
const DIA = 24 * 60 * 60 * 1000;

export const PONTOS_ACERTO = 2;
export const PONTOS_RESPOSTA_CORRETA = 10;
export const DURACAO_MAX_RESPOSTA_SEG = 90;

export type TurmaLga = Grupo & { lga: NonNullable<Grupo["lga"]> };
export type DesafioComProgresso = Desafio & { progresso: number; concluido: boolean; turmaNome: string | null };
type EventoProjetado = Awaited<ReturnType<typeof apiInstituicoes.listarEventos>>[number];

// ── Auxiliares ──

function turmaDe(instituicaoId: string, turmaId: string): TurmaLga {
  const t = carregar().grupos.find((g) => g.id === turmaId && g.instituicaoId === instituicaoId && g.tipo === "turma_lga");
  if (!t || !t.lga) throw new ErroInstituicao("Turma não encontrada.");
  return t as TurmaLga;
}

/** Pertence à turma (ou vê todas as turmas: administração e coordenação). */
function acedeTurma(m: Membro, turmaId: string): boolean {
  return m.gruposIds.includes(turmaId) || pode(m.papel, "ver_todos_grupos");
}

/** Ensina nesta turma: educador ou formador que é membro dela. */
function ensinaNaTurma(m: Membro, turmaId: string): boolean {
  return ensina(m.papel) && m.gruposIds.includes(turmaId);
}

function exigirTurma(instituicaoId: string, turmaId: string): { m: Membro; turma: TurmaLga } {
  const m = exigir(instituicaoId, "ver_turmas_lga");
  const turma = turmaDe(instituicaoId, turmaId);
  if (!acedeTurma(m, turmaId)) throw new ErroInstituicao("Não pertences a esta turma.");
  return { m, turma };
}

/** Quem aprende numa turma (os participantes das classificações). */
function aprendizes(turma: TurmaLga): Membro[] {
  const e = carregar();
  const membros = e.membros.filter((x) => x.estado === "ativo" && x.gruposIds.includes(turma.id));
  if (turma.lga.publico === "familias") return membros.filter((x) => x.papel === "familia");
  if (turma.lga.publico === "professores") {
    const autores = new Set(e.aulas.filter((a) => a.turmaId === turma.id).map((a) => a.autorId));
    return membros.filter((x) => (x.papel === "educador" || x.papel === "coordenador") && !autores.has(x.id));
  }
  return membros.filter((x) => x.papel === "aluno");
}

/** Perfil de criança ligado a uma conta de aluno (para verificar consentimentos). */
function perfilDaConta(contaId: string) {
  return carregar().alunos.find((a) => a.contaId === contaId) ?? null;
}

/** Contas de aluno das crianças de quem este membro é tutor. */
function contasDosFilhos(tutorId: string): string[] {
  return carregar()
    .alunos.filter((a) => a.tutoresIds.includes(tutorId) && a.contaId)
    .map((a) => a.contaId!) as string[];
}

function podeVerResposta(m: Membro, r: RespostaVideo): boolean {
  if (r.alunoId === m.id) return true;
  if (ensinaNaTurma(m, r.turmaId)) return true;
  if (m.papel === "familia") return contasDosFilhos(m.id).includes(r.alunoId);
  return false;
}

/** O conteúdo da escola é visível a este membro? */
function veConteudo(m: Membro, c: ConteudoEscola): boolean {
  if (c.instituicaoId !== m.instituicaoId) return false;
  if (c.ambito.tipo === "instituicao") return true;
  return acedeTurma(m, c.ambito.turmaId);
}

function primeiroNome(nome: string): string {
  return nome.split(" ")[0];
}

function somarPontos(membroId: string, n: number) {
  const e = carregar();
  e.pontosEscola[membroId] = (e.pontosEscola[membroId] ?? 0) + n;
}

function progressoDesafio(d: Desafio, membroId: string): number {
  const inicio = new Date(d.terminaEm).getTime() - 7 * DIA;
  return carregar().registosPratica.filter(
    (r) =>
      r.membroId === membroId &&
      r.certo &&
      r.competencia === d.competencia &&
      (!d.tema || r.tema === d.tema) &&
      new Date(r.em).getTime() >= inicio,
  ).length;
}

const GLYPH_TEMA: Record<TemaGesto, string> = {
  alfabeto: "✋", numeros: "🔢", saudacoes: "👋", escola: "🏫", familia: "👪", emocoes: "😊", quotidiano: "🏠", frases: "💬",
};

// ════════════════════════════════════════════════════════════════════

export const apiLga = {
  // ── Turmas LGA ──

  async listarTurmas(instituicaoId: string): Promise<(TurmaLga & { aprendizes: number; professores: number; aulas: number; porRever: number; pendentes: number })[]> {
    await esperar();
    const m = exigir(instituicaoId, "ver_turmas_lga");
    const e = carregar();
    return (e.grupos.filter((g) => g.instituicaoId === instituicaoId && g.tipo === "turma_lga" && g.lga) as TurmaLga[])
      .filter((t) => acedeTurma(m, t.id))
      .map((t) => {
        const aulas = e.aulas.filter((a) => a.turmaId === t.id);
        const membros = e.membros.filter((x) => x.estado === "ativo" && x.gruposIds.includes(t.id));
        const minhas = e.respostasVideo.filter((r) => r.alunoId === m.id);
        const quemAprende = aprendizes(t);
        const idsAprendizes = new Set(quemAprende.map((x) => x.id));
        return {
          ...t,
          aprendizes: quemAprende.length,
          professores: membros.filter((x) => ensina(x.papel) && !idsAprendizes.has(x.id)).length,
          aulas: aulas.length,
          porRever: ensinaNaTurma(m, t.id) ? e.respostasVideo.filter((r) => r.turmaId === t.id && r.estado === "por_rever").length : 0,
          pendentes:
            m.papel === "aluno"
              ? aulas.filter((a) => a.pedeResposta && !minhas.some((r) => r.aulaId === a.id && r.estado !== "repetir")).length
              : 0,
        };
      });
  },

  async obterTurma(instituicaoId: string, turmaId: string): Promise<{
    turma: TurmaLga;
    professores: Membro[];
    aprendizes: Membro[];
    familias: Membro[];
    codigos: { alunos: Convite | null; familias: Convite | null };
    ensino: boolean;
  }> {
    await esperar();
    const { m, turma } = exigirTurma(instituicaoId, turmaId);
    const e = carregar();
    const membros = e.membros.filter((x) => x.estado === "ativo" && x.gruposIds.includes(turmaId));
    const lista = aprendizes(turma);
    const ids = new Set(lista.map((x) => x.id));
    const podeCodigos = ensinaNaTurma(m, turmaId) || pode(m.papel, "gerir_membros");
    const convite = (id: string | null) => (podeCodigos && id ? e.convites.find((c) => c.id === id) ?? null : null);
    return {
      turma,
      professores: membros.filter((x) => (ensina(x.papel) || x.papel === "formador") && !ids.has(x.id)),
      aprendizes: m.papel === "aluno" || m.papel === "familia" ? [] : lista,
      familias: m.papel === "aluno" ? [] : membros.filter((x) => x.papel === "familia" && !ids.has(x.id)),
      codigos: { alunos: convite(turma.lga.conviteAlunosId), familias: convite(turma.lga.conviteFamiliasId) },
      ensino: ensinaNaTurma(m, turmaId),
    };
  },

  /** Abre uma Turma LGA: cria o grupo e os códigos de entrada (alunos e/ou famílias). */
  async criarTurma(
    instituicaoId: string,
    dados: { nome: string; publico: PublicoTurmaLga; nivel: NivelLga; anoLetivo: string; descricao: string },
  ): Promise<TurmaLga> {
    await esperar();
    const m = exigir(instituicaoId, "gerir_turmas_lga");
    if (!dados.nome.trim()) throw new ErroInstituicao("Dá um nome à turma.");
    const e = carregar();
    const id = novoId("g");
    const agora = Date.now();
    const codigo = (papel: Membro["papel"]): string => {
      const c: Convite = {
        id: novoId("cv"),
        instituicaoId,
        canal: "codigo",
        destino: "",
        codigo: gerarCodigo(),
        papel,
        grupoId: id,
        alunoId: null,
        usos: 0,
        usosMax: 60,
        criadoPor: m.nome,
        criadoEm: new Date(agora).toISOString(),
        // Os códigos das turmas duram o ano letivo inteiro (para entregar em papel).
        expiraEm: fimAnoLetivo(agora),
        estado: "pendente",
      };
      e.convites.unshift(c);
      return c.id;
    };
    const turma: TurmaLga = {
      id,
      instituicaoId,
      nome: dados.nome.trim(),
      tipo: "turma_lga",
      anoLetivo: dados.anoLetivo,
      arquivado: false,
      criadoEm: new Date(agora).toISOString(),
      lga: {
        publico: dados.publico,
        nivel: dados.nivel,
        descricao: dados.descricao.trim(),
        conviteAlunosId: dados.publico === "familias" ? null : codigo(dados.publico === "professores" ? "educador" : "aluno"),
        conviteFamiliasId: dados.publico === "professores" ? null : codigo("familia"),
      },
    };
    e.grupos.push(turma);
    if (!m.gruposIds.includes(id)) m.gruposIds.push(id);
    auditar(instituicaoId, "turma_criada", `«${turma.nome}» (${ROTULO_PUBLICO_LGA[dados.publico]}).`);
    guardar();
    return turma;
  },

  // ── Aulas ──

  async listarAulas(instituicaoId: string, turmaId: string): Promise<(Aula & { minhaResposta: RespostaVideo | null; respostas: { total: number; porRever: number } | null })[]> {
    await esperar();
    const { m } = exigirTurma(instituicaoId, turmaId);
    const e = carregar();
    const professor = ensinaNaTurma(m, turmaId);
    return e.aulas
      .filter((a) => a.turmaId === turmaId)
      .sort((x, y) => y.publicadaEm.localeCompare(x.publicadaEm))
      .map((a) => {
        const daAula = e.respostasVideo.filter((r) => r.aulaId === a.id);
        const minhas = daAula.filter((r) => r.alunoId === m.id).sort((x, y) => y.enviadaEm.localeCompare(x.enviadaEm));
        return {
          ...a,
          minhaResposta: minhas[0] ?? null,
          respostas: professor ? { total: new Set(daAula.map((r) => r.alunoId)).size, porRever: daAula.filter((r) => r.estado === "por_rever").length } : null,
        };
      });
  },

  async obterAula(instituicaoId: string, aulaId: string): Promise<{ aula: Aula; turma: TurmaLga; gestos: Gesto[]; conteudo: ConteudoEscola | null; ensino: boolean }> {
    await esperar();
    const e = carregar();
    const aula = e.aulas.find((a) => a.id === aulaId && a.instituicaoId === instituicaoId);
    if (!aula) throw new ErroInstituicao("Aula não encontrada.");
    const { m, turma } = exigirTurma(instituicaoId, aula.turmaId);
    const conteudo = aula.conteudo?.origem === "escola" ? e.conteudos.find((c) => c.id === aula.conteudo!.id) ?? null : null;
    return {
      aula,
      turma,
      gestos: aula.gestosIds.map((id) => e.gestos.find((g) => g.id === id)).filter((g): g is Gesto => !!g),
      conteudo,
      ensino: ensinaNaTurma(m, turma.id),
    };
  },

  async publicarAula(
    instituicaoId: string,
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
    await esperar();
    const m = exigir(instituicaoId, "publicar_aulas");
    const turma = turmaDe(instituicaoId, turmaId);
    if (!ensinaNaTurma(m, turmaId) && !pode(m.papel, "gerir_membros")) throw new ErroInstituicao("Só quem ensina nesta turma pode publicar aulas.");
    if (!dados.titulo.trim()) throw new ErroInstituicao("Dá um título à aula.");
    if (dados.tipo === "aula" && !dados.video) throw new ErroInstituicao("Carrega o vídeo sinalizado da aula.");
    if (dados.tipo === "atribuicao" && !dados.conteudo) throw new ErroInstituicao("Escolhe o curso ou vídeo a atribuir.");
    if (dados.pedeResposta && !dados.enunciado.trim()) throw new ErroInstituicao("Escreve o que o aluno deve gravar.");
    const aula: Aula = {
      id: novoId("au"),
      instituicaoId,
      turmaId,
      ...dados,
      titulo: dados.titulo.trim(),
      descricao: dados.descricao.trim(),
      enunciado: dados.pedeResposta ? dados.enunciado.trim() : "",
      autor: m.nome,
      autorId: m.id,
      publicadaEm: new Date().toISOString(),
    };
    carregar().aulas.push(aula);
    auditar(instituicaoId, "aula_publicada", `«${aula.titulo}» em ${turma.nome}.`);
    guardar();
    return aula;
  },

  // ── Respostas em vídeo ──

  /** Só o professor da turma, o próprio aluno e a família vêem as respostas. */
  async listarRespostas(instituicaoId: string, filtro: { turmaId?: string; aulaId?: string }): Promise<RespostaVideo[]> {
    await esperar();
    const m = eu(instituicaoId);
    return carregar()
      .respostasVideo.filter(
        (r) =>
          r.instituicaoId === instituicaoId &&
          (!filtro.turmaId || r.turmaId === filtro.turmaId) &&
          (!filtro.aulaId || r.aulaId === filtro.aulaId) &&
          podeVerResposta(m, r),
      )
      .sort((x, y) => y.enviadaEm.localeCompare(x.enviadaEm));
  },

  /** Pode este aluno gravar respostas? (consentimento "respostas em vídeo" quando é uma criança com perfil). */
  async podeResponder(instituicaoId: string): Promise<{ pode: boolean; motivo: string | null }> {
    await esperar();
    const m = eu(instituicaoId);
    if (!pode(m.papel, "responder_aulas")) return { pode: false, motivo: "Só os alunos enviam respostas." };
    const perfil = perfilDaConta(m.id);
    if (!perfil) return { pode: true, motivo: null };
    const atual = consentimentosAtuais(carregar().consentimentos.filter((c) => c.instituicaoId === instituicaoId))[perfil.id];
    if (!atual?.respostas_video?.aceite) {
      return { pode: false, motivo: "A tua família ainda não autorizou as respostas em vídeo. Pede-lhes para o fazer em Instituição → Consentimentos." };
    }
    return { pode: true, motivo: null };
  },

  async enviarResposta(instituicaoId: string, aulaId: string, video: VideoAnexo): Promise<RespostaVideo> {
    const permissao = await apiLga.podeResponder(instituicaoId);
    if (!permissao.pode) throw new ErroInstituicao(permissao.motivo ?? "Não podes enviar respostas.");
    const m = eu(instituicaoId);
    const e = carregar();
    const aula = e.aulas.find((a) => a.id === aulaId && a.instituicaoId === instituicaoId);
    if (!aula || !aula.pedeResposta) throw new ErroInstituicao("Esta aula não pede resposta.");
    if (!m.gruposIds.includes(aula.turmaId)) throw new ErroInstituicao("Não pertences a esta turma.");
    if (video.duracaoSeg && video.duracaoSeg > DURACAO_MAX_RESPOSTA_SEG) {
      throw new ErroInstituicao(`A resposta pode ter até ${DURACAO_MAX_RESPOSTA_SEG} segundos. Grava só o que foi pedido.`);
    }
    const anteriores = e.respostasVideo.filter((r) => r.aulaId === aulaId && r.alunoId === m.id);
    if (anteriores.some((r) => r.estado === "por_rever")) throw new ErroInstituicao("A tua resposta ainda está à espera do professor.");
    if (anteriores.some((r) => r.estado === "correto")) throw new ErroInstituicao("Esta resposta já está correta.");
    const r: RespostaVideo = {
      id: novoId("rv"),
      instituicaoId,
      turmaId: aula.turmaId,
      aulaId,
      alunoId: m.id,
      alunoNome: m.nome,
      video,
      enviadaEm: new Date().toISOString(),
      estado: "por_rever",
      feedback: null,
      apagarEm: fimAnoLetivo(Date.now()),
      tentativa: anteriores.length + 1,
    };
    e.respostasVideo.push(r);
    guardar();
    return r;
  },

  async darFeedback(instituicaoId: string, respostaId: string, dados: { estado: "correto" | "repetir"; texto: string; video: VideoAnexo | null }): Promise<RespostaVideo> {
    await esperar();
    const m = exigir(instituicaoId, "rever_respostas");
    const r = carregar().respostasVideo.find((x) => x.id === respostaId && x.instituicaoId === instituicaoId);
    if (!r) throw new ErroInstituicao("Resposta não encontrada.");
    if (!ensinaNaTurma(m, r.turmaId)) throw new ErroInstituicao("Só quem ensina nesta turma corrige as respostas.");
    if (dados.estado === "repetir" && !dados.texto.trim() && !dados.video) throw new ErroInstituicao("Explica ao aluno o que deve corrigir.");
    const primeiraVezCorreta = r.estado !== "correto" && dados.estado === "correto";
    r.estado = dados.estado;
    r.feedback = { texto: dados.texto.trim(), video: dados.video, por: m.nome, em: new Date().toISOString() };
    if (primeiraVezCorreta) somarPontos(r.alunoId, PONTOS_RESPOSTA_CORRETA);
    auditar(instituicaoId, "resposta_revista", `Resposta (tentativa ${r.tentativa}) marcada como «${dados.estado === "correto" ? "correto" : "repetir"}».`);
    guardar();
    return r;
  },

  // ── Gestuário ──

  /**
   * Gestos visíveis: todos os validados; os propostos e rejeitados só a quem os
   * propôs e a quem valida na mesma instituição.
   */
  async listarGestos(instituicaoId: string | null): Promise<Gesto[]> {
    await esperar();
    const e = carregar();
    const m = instituicaoId ? eu(instituicaoId) : null;
    return e.gestos.filter((g) => {
      if (g.estado === "validado") return true;
      if (!m || g.instituicaoId !== m.instituicaoId) return false;
      return g.propostoPor === m.nome || pode(m.papel, "validar_gestos");
    });
  },

  async proporGesto(
    instituicaoId: string,
    dados: { palavra: string; tema: TemaGesto; variante: string; descricao: string; video: VideoAnexo | null },
  ): Promise<Gesto> {
    await esperar();
    const m = exigir(instituicaoId, "propor_gestos");
    if (!dados.palavra.trim()) throw new ErroInstituicao("Escreve a palavra ou frase.");
    if (!dados.video && !dados.descricao.trim()) throw new ErroInstituicao("Grava o gesto em vídeo ou descreve-o.");
    const g: Gesto = {
      id: novoId("ge"),
      palavra: dados.palavra.trim(),
      tema: dados.tema,
      variante: dados.variante.trim() || "Comum",
      descricao: dados.descricao.trim(),
      glyph: GLYPH_TEMA[dados.tema],
      motion: "static",
      video: dados.video,
      estado: "proposto",
      instituicaoId,
      propostoPor: m.nome,
      propostoEm: new Date().toISOString(),
      validacao: null,
    };
    carregar().gestos.push(g);
    auditar(instituicaoId, "gesto_proposto", `«${g.palavra}» (${g.variante}).`);
    guardar();
    return g;
  },

  /** Valida ou rejeita um gesto proposto. Quem propõe não valida o próprio gesto. */
  async validarGesto(instituicaoId: string, gestoId: string, aprovar: boolean, nota: string): Promise<Gesto> {
    await esperar();
    const m = exigir(instituicaoId, "validar_gestos");
    const g = carregar().gestos.find((x) => x.id === gestoId && x.instituicaoId === instituicaoId);
    if (!g) throw new ErroInstituicao("Gesto não encontrado.");
    if (g.estado !== "proposto") throw new ErroInstituicao("Este gesto já foi revisto.");
    if (g.propostoPor === m.nome) throw new ErroInstituicao("Outra pessoa tem de validar o gesto que propuseste.");
    if (!aprovar && !nota.trim()) throw new ErroInstituicao("Explica porque rejeitas, para quem propôs poder corrigir.");
    g.estado = aprovar ? "validado" : "rejeitado";
    g.validacao = { por: m.nome, em: new Date().toISOString(), nota: nota.trim() };
    auditar(instituicaoId, "gesto_validado", `«${g.palavra}» (${g.variante}) ${aprovar ? "validado" : "rejeitado"}.`);
    guardar();
    return g;
  },

  // ── Prática por competência ──

  async registarPratica(
    instituicaoId: string,
    dados: { competencia: Competencia; tema: TemaGesto; certo: boolean },
  ): Promise<{ pontos: number; desafiosConcluidos: Desafio[] }> {
    const m = exigir(instituicaoId, "praticar");
    const e = carregar();
    const prog = (e.progresso[m.id] ??= {});
    prog[dados.competencia] = registarNoProgresso(prog[dados.competencia], dados.certo);
    e.registosPratica.push({ membroId: m.id, instituicaoId, ...dados, em: new Date().toISOString() });
    let pontos = dados.certo ? PONTOS_ACERTO : 0;
    const concluidos: Desafio[] = [];
    if (dados.certo) {
      const feitos = (e.desafiosConcluidos[m.id] ??= []);
      for (const d of e.desafios) {
        if (d.instituicaoId !== instituicaoId || feitos.includes(d.id)) continue;
        if (d.turmaId && !m.gruposIds.includes(d.turmaId)) continue;
        if (new Date(d.terminaEm).getTime() < Date.now()) continue;
        if (progressoDesafio(d, m.id) >= d.meta) {
          feitos.push(d.id);
          pontos += d.recompensa;
          concluidos.push(d);
        }
      }
    }
    if (pontos) somarPontos(m.id, pontos);
    guardar();
    return { pontos, desafiosConcluidos: concluidos };
  },

  async meuProgresso(instituicaoId: string): Promise<{ competencias: Record<Competencia, { mestria: number; nivel: NivelMestria; tentativas: number }>; pontos: number }> {
    await esperar();
    const m = exigir(instituicaoId, "praticar");
    const e = carregar();
    const prog = e.progresso[m.id] ?? {};
    const comp = (c: Competencia) => ({ mestria: mestria(prog[c]), nivel: nivelMestria(prog[c]), tentativas: prog[c]?.tentativas ?? 0 });
    return {
      competencias: { alfabeto: comp("alfabeto"), numeros: comp("numeros"), vocabulario: comp("vocabulario"), frases: comp("frases") },
      pontos: e.pontosEscola[m.id] ?? 0,
    };
  },

  /** Progresso de cada aprendiz da turma — para quem ensina e para a administração. */
  async progressoTurma(instituicaoId: string, turmaId: string): Promise<{ alunos: { id: string; nome: string; competencias: Record<Competencia, number>; respostasCorretas: number }[]; media: Record<Competencia, number> }> {
    await esperar();
    const { m, turma } = exigirTurma(instituicaoId, turmaId);
    if (!ensinaNaTurma(m, turmaId) && !pode(m.papel, "ver_todos_grupos")) throw new ErroInstituicao("Só quem ensina na turma vê o progresso de cada aluno.");
    const e = carregar();
    const comps: Competencia[] = ["alfabeto", "numeros", "vocabulario", "frases"];
    const alunos = aprendizes(turma).map((a) => {
      const prog = e.progresso[a.id] ?? {};
      return {
        id: a.id,
        nome: a.nome,
        competencias: Object.fromEntries(comps.map((c) => [c, mestria(prog[c])])) as Record<Competencia, number>,
        respostasCorretas: e.respostasVideo.filter((r) => r.alunoId === a.id && r.turmaId === turmaId && r.estado === "correto").length,
      };
    });
    const media = Object.fromEntries(
      comps.map((c) => [c, alunos.length ? Math.round(alunos.reduce((s, a) => s + a.competencias[c], 0) / alunos.length) : 0]),
    ) as Record<Competencia, number>;
    return { alunos, media };
  },

  // ── Conteúdos da escola (âmbito escola ou turma) ──

  async listarConteudos(instituicaoId: string, tipo?: ConteudoEscola["tipo"]): Promise<ConteudoEscola[]> {
    await esperar();
    const m = eu(instituicaoId);
    return carregar()
      .conteudos.filter((c) => (!tipo || c.tipo === tipo) && veConteudo(m, c))
      .sort((x, y) => y.publicadoEm.localeCompare(x.publicadoEm));
  },

  async obterConteudo(instituicaoId: string, conteudoId: string): Promise<ConteudoEscola> {
    await esperar();
    const m = eu(instituicaoId);
    const c = carregar().conteudos.find((x) => x.id === conteudoId);
    if (!c || !veConteudo(m, c)) throw new ErroInstituicao("Este conteúdo é só para os membros da escola ou da turma.");
    c.vistas += 1;
    guardar();
    return c;
  },

  async publicarConteudo(
    instituicaoId: string,
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
    await esperar();
    const m = exigir(instituicaoId, "publicar_conteudos");
    if (!dados.titulo.trim()) throw new ErroInstituicao("Dá um título ao conteúdo.");
    if (dados.ambito.instituicaoId !== instituicaoId) throw new ErroInstituicao("Âmbito inválido.");
    if (dados.ambito.tipo === "turma" && !ensinaNaTurma(m, dados.ambito.turmaId) && !pode(m.papel, "gerir_membros")) {
      throw new ErroInstituicao("Só podes publicar para as turmas onde ensinas.");
    }
    const c: ConteudoEscola = {
      id: novoId("ce"),
      instituicaoId,
      ...dados,
      titulo: dados.titulo.trim(),
      descricao: dados.descricao.trim(),
      autor: m.nome,
      autorId: m.id,
      publicadoEm: new Date().toISOString(),
      vistas: 0,
      propostaPublica: null,
    };
    carregar().conteudos.push(c);
    auditar(instituicaoId, "conteudo_publicado", `«${c.titulo}» (${c.ambito.tipo === "turma" ? "só a turma" : "toda a escola"}).`);
    guardar();
    return c;
  },

  /** Propõe um conteúdo da escola para o catálogo público (revisto pela equipa EYK). */
  async proporPublico(instituicaoId: string, conteudoId: string): Promise<ConteudoEscola> {
    await esperar();
    const m = exigir(instituicaoId, "publicar_conteudos");
    const c = carregar().conteudos.find((x) => x.id === conteudoId && x.instituicaoId === instituicaoId);
    if (!c) throw new ErroInstituicao("Conteúdo não encontrado.");
    if (c.autorId !== m.id && !pode(m.papel, "gerir_membros")) throw new ErroInstituicao("Só quem publicou ou a administração pode propor.");
    if (c.propostaPublica === "pendente" || c.propostaPublica === "aceite") throw new ErroInstituicao("Já foi proposto.");
    c.propostaPublica = "pendente";
    guardar();
    return c;
  },

  /** Equipa EYK (isStaff): propostas de conteúdos das escolas para a plataforma geral. */
  async listarPropostasPublicas(): Promise<(ConteudoEscola & { escola: string })[]> {
    await esperar();
    const e = carregar();
    return e.conteudos
      .filter((c) => c.propostaPublica === "pendente")
      .map((c) => ({ ...c, escola: e.instituicoes.find((i) => i.id === c.instituicaoId)?.nome ?? "" }));
  },

  async decidirPropostaPublica(conteudoId: string, aceitar: boolean): Promise<void> {
    await esperar();
    const c = carregar().conteudos.find((x) => x.id === conteudoId);
    if (!c || c.propostaPublica !== "pendente") throw new ErroInstituicao("Proposta não encontrada ou já decidida.");
    c.propostaPublica = aceitar ? "aceite" : "recusada";
    auditar(c.instituicaoId, "conteudo_publicado", `«${c.titulo}» ${aceitar ? "aceite" : "recusado"} para a plataforma geral.`, "Equipa EYK", "equipa_eyk");
    guardar();
  },

  // ── Comunidade da turma ──

  async listarPostsTurma(instituicaoId: string, turmaId: string): Promise<PostTurma[]> {
    await esperar();
    const { m } = exigirTurma(instituicaoId, turmaId);
    const moderador = ensinaNaTurma(m, turmaId) || pode(m.papel, "gerir_membros");
    return carregar()
      .postsTurma.filter((p) => p.turmaId === turmaId && (p.estado === "visivel" || moderador || p.autorId === m.id))
      .sort((x, y) => y.criadoEm.localeCompare(x.criadoEm));
  },

  async publicarPostTurma(instituicaoId: string, turmaId: string, dados: { texto: string; gestoId: string | null }): Promise<PostTurma> {
    await esperar();
    const m = exigir(instituicaoId, "publicar_na_turma");
    turmaDe(instituicaoId, turmaId);
    if (!m.gruposIds.includes(turmaId)) throw new ErroInstituicao("Só os membros da turma publicam aqui.");
    const texto = dados.texto.trim();
    if (!texto) throw new ErroInstituicao("Escreve alguma coisa.");
    if (texto.length > 500) throw new ErroInstituicao("No máximo 500 caracteres.");
    if (/https?:\/\//i.test(texto) && m.papel === "aluno") throw new ErroInstituicao("Os alunos não podem publicar links na turma.");
    const p: PostTurma = {
      id: novoId("pt"),
      instituicaoId,
      turmaId,
      autorId: m.id,
      autorNome: m.nome,
      papel: m.papel,
      texto,
      gestoId: dados.gestoId,
      criadoEm: new Date().toISOString(),
      estado: "visivel",
    };
    carregar().postsTurma.push(p);
    guardar();
    return p;
  },

  async moderarPostTurma(instituicaoId: string, postId: string, visivel: boolean): Promise<void> {
    await esperar();
    const m = exigir(instituicaoId, "moderar_turma");
    const p = carregar().postsTurma.find((x) => x.id === postId && x.instituicaoId === instituicaoId);
    if (!p) throw new ErroInstituicao("Publicação não encontrada.");
    if (!ensinaNaTurma(m, p.turmaId) && !pode(m.papel, "gerir_membros")) throw new ErroInstituicao("Só quem ensina na turma modera as publicações.");
    p.estado = visivel ? "visivel" : "oculto";
    if (!visivel) auditar(instituicaoId, "post_turma_oculto", `Publicação de ${p.autorNome} escondida.`);
    guardar();
  },

  /** Qualquer membro denuncia: a publicação deixa de se ver até o professor rever. */
  async denunciarPostTurma(instituicaoId: string, postId: string): Promise<void> {
    await esperar();
    const m = eu(instituicaoId);
    const p = carregar().postsTurma.find((x) => x.id === postId && x.instituicaoId === instituicaoId);
    if (!p || !acedeTurma(m, p.turmaId)) throw new ErroInstituicao("Publicação não encontrada.");
    if (p.estado === "visivel") p.estado = "denunciado";
    guardar();
  },

  // ── Classificações (turma e escola) ──

  async classificacao(
    instituicaoId: string,
    ambito: { turmaId: string } | "escola",
  ): Promise<{ linhas: { posicao: number; nome: string; pontos: number; eu: boolean }[]; participantes: number }> {
    await esperar();
    const m = eu(instituicaoId);
    const inst = instituicao(instituicaoId);
    if (!inst.escola.rankingVisivel) throw new ErroInstituicao("A escola desligou as classificações.");
    const e = carregar();
    let participantes: Membro[];
    if (ambito === "escola") {
      participantes = e.membros.filter((x) => x.instituicaoId === instituicaoId && x.estado === "ativo" && x.papel === "aluno");
    } else {
      const { turma } = exigirTurma(instituicaoId, ambito.turmaId);
      participantes = aprendizes(turma);
    }
    const linhas = participantes
      .map((x) => ({ id: x.id, nome: primeiroNome(x.nome), pontos: e.pontosEscola[x.id] ?? 0, eu: x.id === m.id }))
      .sort((a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome))
      .map((l, i) => ({ posicao: i + 1, nome: l.nome, pontos: l.pontos, eu: l.eu }));
    return { linhas, participantes: participantes.length };
  },

  // ── Desafios ──

  async listarDesafios(instituicaoId: string): Promise<DesafioComProgresso[]> {
    await esperar();
    const m = eu(instituicaoId);
    const e = carregar();
    const feitos = e.desafiosConcluidos[m.id] ?? [];
    return e.desafios
      .filter((d) => d.instituicaoId === instituicaoId && (!d.turmaId || acedeTurma(m, d.turmaId)))
      .map((d) => ({
        ...d,
        progresso: Math.min(d.meta, progressoDesafio(d, m.id)),
        concluido: feitos.includes(d.id),
        turmaNome: d.turmaId ? e.grupos.find((g) => g.id === d.turmaId)?.nome ?? null : null,
      }))
      .sort((x, y) => x.terminaEm.localeCompare(y.terminaEm));
  },

  async criarDesafio(
    instituicaoId: string,
    dados: { titulo: string; descricao: string; turmaId: string | null; competencia: Competencia; tema: TemaGesto | null; meta: number; recompensa: number; dias: number },
  ): Promise<Desafio> {
    await esperar();
    const m = exigir(instituicaoId, "criar_desafios");
    if (!dados.titulo.trim()) throw new ErroInstituicao("Dá um título ao desafio.");
    if (dados.meta < 1 || dados.meta > 200) throw new ErroInstituicao("A meta tem de estar entre 1 e 200.");
    if (dados.tema && competenciaDoTema(dados.tema) !== dados.competencia) throw new ErroInstituicao("O tema não pertence a esta competência.");
    if (dados.turmaId && !ensinaNaTurma(m, dados.turmaId) && !pode(m.papel, "gerir_membros")) throw new ErroInstituicao("Só para as turmas onde ensinas.");
    const d: Desafio = {
      id: novoId("d"),
      instituicaoId,
      turmaId: dados.turmaId,
      titulo: dados.titulo.trim(),
      descricao: dados.descricao.trim(),
      competencia: dados.competencia,
      tema: dados.tema,
      meta: dados.meta,
      recompensa: Math.max(0, Math.min(200, dados.recompensa)),
      terminaEm: new Date(Date.now() + Math.max(1, Math.min(30, dados.dias)) * DIA).toISOString(),
      criadoPor: m.nome,
    };
    carregar().desafios.push(d);
    guardar();
    return d;
  },

  // ── Plataforma geral (só para alunos) ──

  /**
   * O aluno de uma escola vê só o que a escola publicou, a não ser que escolha ver
   * também a plataforma geral. Professores, famílias e administração vêem sempre.
   */
  async verPlataformaGeral(instituicaoId: string): Promise<boolean> {
    const m = eu(instituicaoId);
    if (m.papel !== "aluno") return true;
    return carregar().verGeral?.[m.id] ?? false;
  },

  async definirVerPlataformaGeral(instituicaoId: string, ver: boolean): Promise<void> {
    await esperar();
    const m = eu(instituicaoId);
    if (m.papel !== "aluno") throw new ErroInstituicao("Esta opção é só para alunos.");
    const e = carregar();
    (e.verGeral ??= {})[m.id] = ver;
    guardar();
  },

  // ── Resumo para o Início ──

  /** O que a escola tem para esta pessoa hoje: trabalhos, aulas novas, respostas por rever, desafios. */
  async resumoEscola(instituicaoId: string): Promise<{
    tarefas: { aula: Aula; turma: string; estado: "por_fazer" | "repetir" }[];
    aulasNovas: { aula: Aula; turma: string }[];
    porRever: number;
    feedbackNovo: RespostaVideo[];
    desafios: DesafioComProgresso[];
    avisosPorLer: number;
    proximoEvento: EventoProjetado | null;
  }> {
    const m = eu(instituicaoId);
    const e = carregar();
    const turmas = e.grupos.filter((g) => g.instituicaoId === instituicaoId && g.tipo === "turma_lga" && m.gruposIds.includes(g.id));
    const nomeTurma = (id: string) => turmas.find((t) => t.id === id)?.nome ?? "";
    const aulas = e.aulas.filter((a) => turmas.some((t) => t.id === a.turmaId));
    const minhas = e.respostasVideo.filter((r) => r.alunoId === m.id);
    const tarefas =
      m.papel === "aluno"
        ? aulas
            .filter((a) => a.pedeResposta)
            .map((a) => {
              const ultima = minhas.filter((r) => r.aulaId === a.id).sort((x, y) => y.enviadaEm.localeCompare(x.enviadaEm))[0];
              const estado: "por_fazer" | "repetir" | null = !ultima ? "por_fazer" : ultima.estado === "repetir" ? "repetir" : null;
              return estado ? { aula: a, turma: nomeTurma(a.turmaId), estado } : null;
            })
            .filter((x): x is { aula: Aula; turma: string; estado: "por_fazer" | "repetir" } => !!x)
        : [];
    const [desafios, avisos, eventos] = await Promise.all([
      apiLga.listarDesafios(instituicaoId),
      pode(m.papel, "ver_avisos") ? apiInstituicoes.listarAvisos(instituicaoId) : Promise.resolve([]),
      pode(m.papel, "ver_agenda") ? apiInstituicoes.listarEventos(instituicaoId) : Promise.resolve([]),
    ]);
    const agora = Date.now();
    return {
      tarefas,
      aulasNovas: aulas
        .filter((a) => agora - new Date(a.publicadaEm).getTime() < 7 * DIA)
        .sort((x, y) => y.publicadaEm.localeCompare(x.publicadaEm))
        .map((a) => ({ aula: a, turma: nomeTurma(a.turmaId) })),
      porRever: ensina(m.papel) ? e.respostasVideo.filter((r) => r.estado === "por_rever" && ensinaNaTurma(m, r.turmaId)).length : 0,
      feedbackNovo: minhas.filter((r) => r.feedback && agora - new Date(r.feedback.em).getTime() < 7 * DIA),
      desafios: desafios.filter((d) => !d.concluido && new Date(d.terminaEm).getTime() > agora),
      avisosPorLer: avisos.filter((a) => !a.lidoPorMim && a.autorId !== m.id).length,
      proximoEvento: eventos.find((ev) => !ev.cancelado && new Date(ev.inicio).getTime() > agora) ?? null,
    };
  },
};

/** Duração em "m:ss". */
export function duracao(seg: number | null | undefined): string {
  if (!seg && seg !== 0) return "—";
  return `${Math.floor(seg / 60)}:${String(Math.round(seg % 60)).padStart(2, "0")}`;
}
