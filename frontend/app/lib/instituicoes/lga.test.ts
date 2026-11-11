import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiInstituicoes, definirPessoaDemo, reporDemo, _interno } from "./api";
import { apiLga, PONTOS_RESPOSTA_CORRETA } from "./lga";
import { gerarExercicio, JANELA_MESTRIA, mestria, nivelMestria, paraSoletrar, registarNoProgresso } from "./exercicios";
import type { Competencia, ProgressoCompetencia } from "./tipos";

// Pessoas de demonstração (ver demo.ts e demo-lga.ts).
const ANA = 1001; // administradora
const PAULO = 1002; // coordenador
const MARIA = 1003; // educadora das turmas LGA
const JOAO = 1004; // educador, aprende na turma de professores
const KIESSE = 1006; // aluno da turma LGA da 3.ª A (m-6)
const ROSA = 1008; // família, tutora de Kiesse (m-8)
const DOMINGOS = 1030; // educador surdo (ensina LGA e valida gestos)
const NZINGA = 1102; // aluno (m-a-2)
const MUKUNA = 1103; // aluno com uma resposta para repetir (m-a-3)
const WEZO = 1105; // aluno sem consentimento para respostas em vídeo
const I = "inst-1";

/** Gerador determinístico para os exercícios. */
function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const video = (seg = 20) => ({ nome: "resposta.webm", tamanhoBytes: seg * 1000, duracaoSeg: seg });

// O relógio fica fixo no dia dos dados de demonstração: os prazos (desafios, tarefas)
// são relativos a esse dia e o teste não pode depender da data em que corre.
const DIA_DEMO = Date.UTC(2026, 9, 23, 10);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(DIA_DEMO);
  reporDemo(DIA_DEMO);
  definirPessoaDemo(ANA);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Turmas LGA", () => {
  it("abrir uma turma cria os códigos de entrada certos para o público", async () => {
    definirPessoaDemo(MARIA);
    const surdos = await apiLga.criarTurma(I, { nome: "LGA 4.ª B", publico: "surdos_l1", nivel: "iniciacao", anoLetivo: "2026/2027", descricao: "" });
    const familias = await apiLga.criarTurma(I, { nome: "Pais 4.ª B", publico: "familias", nivel: "iniciacao", anoLetivo: "2026/2027", descricao: "" });
    const profs = await apiLga.criarTurma(I, { nome: "Docentes", publico: "professores", nivel: "intermedio", anoLetivo: "2026/2027", descricao: "" });
    const convites = _interno.carregar().convites;
    const papel = (id: string | null) => convites.find((c) => c.id === id)?.papel;
    expect([papel(surdos.lga.conviteAlunosId), papel(surdos.lga.conviteFamiliasId)]).toEqual(["aluno", "familia"]);
    expect([surdos.lga.conviteAlunosId, papel(familias.lga.conviteFamiliasId)]).not.toContain(undefined);
    expect(familias.lga.conviteAlunosId).toBeNull();
    expect([papel(profs.lga.conviteAlunosId), profs.lga.conviteFamiliasId]).toEqual(["educador", null]);
    // Quem abre a turma fica nela e a abertura fica na auditoria.
    expect((await apiLga.listarTurmas(I)).some((t) => t.id === surdos.id)).toBe(true);
    definirPessoaDemo(ANA);
    expect((await apiInstituicoes.listarAuditoria(I)).some((r) => r.acao === "turma_criada")).toBe(true);
  });

  it("um aluno pode aderir à turma com o código e só vê as suas turmas", async () => {
    definirPessoaDemo(9100);
    await apiInstituicoes.aderir("LGA3A", { nome: "Novo Aluno", email: "" }).catch(() => undefined);
    // A escola aprova pedidos por código: fica pendente.
    definirPessoaDemo(ANA);
    expect((await apiInstituicoes.listarPedidosAdesao(I)).some((p) => p.nome === "Novo Aluno" && p.grupoId === "g-lga1")).toBe(true);
    definirPessoaDemo(KIESSE);
    expect((await apiLga.listarTurmas(I)).map((t) => t.id)).toEqual(["g-lga1"]);
  });

  it("só quem ensina na turma publica aulas", async () => {
    const dados = {
      tipo: "aula" as const, titulo: "Cores", descricao: "", video: video(300), legendaPt: true, gestosIds: [],
      recursos: [], conteudo: null, prazo: null, pedeResposta: false, enunciado: "",
    };
    definirPessoaDemo(KIESSE);
    await expect(apiLga.publicarAula(I, "g-lga1", dados)).rejects.toThrow(/papel não permite/);
    definirPessoaDemo(JOAO); // educador, mas não ensina na 3.ª A
    await expect(apiLga.publicarAula(I, "g-lga1", dados)).rejects.toThrow(/Só quem ensina/);
    definirPessoaDemo(DOMINGOS);
    await expect(apiLga.publicarAula(I, "g-lga1", { ...dados, video: null })).rejects.toThrow(/vídeo sinalizado/);
    const aula = await apiLga.publicarAula(I, "g-lga1", dados);
    expect(aula.autor).toBe("Domingos Sapalo");
  });
});

describe("respostas em vídeo", () => {
  it("só o professor da turma, o próprio aluno e a família vêem as respostas", async () => {
    definirPessoaDemo(MARIA);
    expect((await apiLga.listarRespostas(I, { turmaId: "g-lga1" })).length).toBe(5);
    definirPessoaDemo(KIESSE);
    expect((await apiLga.listarRespostas(I, { turmaId: "g-lga1" })).every((r) => r.alunoId === "m-6")).toBe(true);
    definirPessoaDemo(ROSA);
    const daFamilia = await apiLga.listarRespostas(I, {});
    expect(daFamilia.length).toBeGreaterThan(0);
    expect(daFamilia.every((r) => r.alunoId === "m-6")).toBe(true);
    // A administração e a coordenação não vêem os vídeos das crianças.
    definirPessoaDemo(ANA);
    expect(await apiLga.listarRespostas(I, {})).toEqual([]);
    definirPessoaDemo(PAULO);
    expect(await apiLga.listarRespostas(I, {})).toEqual([]);
  });

  it("sem o consentimento de respostas em vídeo, o aluno não pode gravar", async () => {
    definirPessoaDemo(WEZO);
    expect((await apiLga.podeResponder(I)).pode).toBe(false);
    await expect(apiLga.enviarResposta(I, "au-1", video())).rejects.toThrow(/autorizou/);
  });

  it("não reenvia enquanto espera o professor; depois de «repetir», nova tentativa", async () => {
    definirPessoaDemo(KIESSE);
    await expect(apiLga.enviarResposta(I, "au-1", video())).rejects.toThrow(/à espera do professor/);
    definirPessoaDemo(MUKUNA);
    await expect(apiLga.enviarResposta(I, "au-1", video(200))).rejects.toThrow(/até 90 segundos/);
    const r = await apiLga.enviarResposta(I, "au-1", video());
    expect(r.tentativa).toBe(2);
    expect(r.estado).toBe("por_rever");
  });

  it("o feedback «correto» dá pontos uma só vez e só quem ensina na turma corrige", async () => {
    definirPessoaDemo(JOAO);
    await expect(apiLga.darFeedback(I, "rv-1", { estado: "correto", texto: "", video: null })).rejects.toThrow(/Só quem ensina/);
    definirPessoaDemo(MARIA);
    await expect(apiLga.darFeedback(I, "rv-1", { estado: "repetir", texto: "", video: null })).rejects.toThrow(/Explica/);
    const antes = _interno.carregar().pontosEscola["m-6"] ?? 0;
    await apiLga.darFeedback(I, "rv-1", { estado: "correto", texto: "Muito bem!", video: null });
    await apiLga.darFeedback(I, "rv-1", { estado: "correto", texto: "Muito bem!", video: null });
    expect(_interno.carregar().pontosEscola["m-6"]).toBe(antes + PONTOS_RESPOSTA_CORRETA);
  });
});

describe("gestuário", () => {
  it("quem propõe não valida o próprio gesto; rejeitar exige explicação", async () => {
    definirPessoaDemo(DOMINGOS);
    await expect(apiLga.validarGesto(I, "ge-p-2", true, "")).rejects.toThrow(/Outra pessoa/);
    await expect(apiLga.validarGesto(I, "ge-p-1", false, "")).rejects.toThrow(/Explica/);
    const g = await apiLga.validarGesto(I, "ge-p-1", true, "Variante confirmada na Huíla.");
    expect(g.estado).toBe("validado");
    definirPessoaDemo(PAULO);
    expect((await apiLga.validarGesto(I, "ge-p-2", true, "")).estado).toBe("validado");
  });

  it("os gestos por validar só são vistos por quem propôs e por quem valida", async () => {
    definirPessoaDemo(KIESSE);
    const doAluno = await apiLga.listarGestos(I);
    expect(doAluno.every((g) => g.estado === "validado")).toBe(true);
    definirPessoaDemo(DOMINGOS);
    expect((await apiLga.listarGestos(I)).some((g) => g.estado === "proposto")).toBe(true);
    expect((await apiLga.listarGestos(null)).every((g) => g.estado === "validado")).toBe(true);
  });

  it("alunos e famílias não propõem gestos", async () => {
    definirPessoaDemo(KIESSE);
    await expect(apiLga.proporGesto(I, { palavra: "Bola", tema: "quotidiano", variante: "", descricao: "x", video: null })).rejects.toThrow(/papel não permite/);
  });
});

describe("exercícios e mestria", () => {
  it("as opções têm sempre representações diferentes e incluem a resposta", async () => {
    const gestos = _interno.carregar().gestos;
    const comps: Competencia[] = ["alfabeto", "numeros", "vocabulario", "frases"];
    for (const c of comps) {
      for (let s = 1; s <= 30; s++) {
        const ex = gerarExercicio(gestos, c, { rand: lcg(s * 97 + c.length) })!;
        expect(ex).not.toBeNull();
        expect(ex.opcoes).toHaveLength(4);
        expect(ex.opcoes.some((o) => o.id === ex.respostaId)).toBe(true);
        if (ex.tipo === "soletrar") {
          expect(new Set(ex.opcoes.map((o) => o.id)).size).toBe(4);
          expect(ex.gestos.map((g) => g.palavra).join("")).toBe(ex.respostaId);
        } else {
          const glyphs = ex.opcoes.map((o) => gestos.find((g) => g.id === o.id)!.glyph);
          expect(new Set(glyphs).size).toBe(4);
        }
      }
    }
  });

  it("não gera exercícios sem gestos validados suficientes", () => {
    expect(gerarExercicio([], "numeros")).toBeNull();
  });

  it("a mestria usa as respostas recentes e «dominado» exige respostas suficientes", () => {
    let p: ProgressoCompetencia | undefined;
    for (let i = 0; i < 5; i++) p = registarNoProgresso(p, true);
    expect(mestria(p)).toBe(100);
    expect(nivelMestria(p)).toBe("a_progredir");
    for (let i = 0; i < JANELA_MESTRIA; i++) p = registarNoProgresso(p, true);
    expect(nivelMestria(p)).toBe("dominado");
    for (let i = 0; i < 6; i++) p = registarNoProgresso(p, false);
    expect(mestria(p)).toBe(40);
    expect(p!.tentativas).toBe(21);
    expect(paraSoletrar("Olá, Nzinga!")).toBe("OLANZINGA");
  });

  it("praticar conta para os desafios e a recompensa é dada uma só vez", async () => {
    definirPessoaDemo(KIESSE);
    const desafio = (await apiLga.listarDesafios(I)).find((d) => d.id === "d-1")!;
    let bonus = 0;
    for (let i = desafio.progresso; i < desafio.meta + 3; i++) {
      const r = await apiLga.registarPratica(I, { competencia: "vocabulario", tema: "familia", certo: true });
      bonus += r.desafiosConcluidos.filter((d) => d.id === "d-1").length;
    }
    expect(bonus).toBe(1);
    expect((await apiLga.listarDesafios(I)).find((d) => d.id === "d-1")!.concluido).toBe(true);
    expect((await apiLga.meuProgresso(I)).competencias.vocabulario.tentativas).toBeGreaterThan(0);
  });
});

describe("conteúdos da escola e âmbito", () => {
  it("cada conteúdo só é visível dentro do seu âmbito", async () => {
    definirPessoaDemo(KIESSE); // só na turma g-lga1
    const ids = (await apiLga.listarConteudos(I)).map((c) => c.id);
    expect(ids).toContain("ce-1"); // da sua turma
    expect(ids).toContain("ce-2"); // de toda a escola
    expect(ids).not.toContain("ce-4"); // da turma das famílias
    expect(ids).not.toContain("ce-5"); // de outra instituição
    await expect(apiLga.obterConteudo(I, "ce-4")).rejects.toThrow(/só para os membros/);
    definirPessoaDemo(ROSA); // família, na turma das famílias
    expect((await apiLga.listarConteudos(I)).map((c) => c.id)).toContain("ce-4");
  });

  it("só se publica para turmas onde se ensina", async () => {
    definirPessoaDemo(JOAO);
    await expect(
      apiLga.publicarConteudo(I, {
        tipo: "video", titulo: "x", descricao: "", ambito: { tipo: "turma", instituicaoId: I, turmaId: "g-lga1" },
        duracaoMin: 3, aulas: 0, temLegendas: false, emLga: true,
      }),
    ).rejects.toThrow(/turmas onde ensinas/);
    definirPessoaDemo(MARIA);
    const c = await apiLga.publicarConteudo(I, {
      tipo: "video", titulo: "Cores em LGA", descricao: "", ambito: { tipo: "instituicao", instituicaoId: I },
      duracaoMin: 3, aulas: 0, temLegendas: true, emLga: true,
    });
    expect((await apiLga.proporPublico(I, c.id)).propostaPublica).toBe("pendente");
    await expect(apiLga.proporPublico(I, c.id)).rejects.toThrow(/Já foi proposto/);
  });
});

describe("comunidade da turma e classificações", () => {
  it("famílias lêem mas não publicam; publicações escondidas não aparecem aos alunos", async () => {
    definirPessoaDemo(ROSA);
    await expect(apiLga.publicarPostTurma(I, "g-lga1", { texto: "Olá", gestoId: null })).rejects.toThrow(/papel não permite/);
    definirPessoaDemo(NZINGA);
    expect((await apiLga.listarPostsTurma(I, "g-lga1")).some((p) => p.id === "pt-5")).toBe(false);
    await expect(apiLga.publicarPostTurma(I, "g-lga1", { texto: "vejam https://x.ao", gestoId: null })).rejects.toThrow(/links/);
    const p = await apiLga.publicarPostTurma(I, "g-lga1", { texto: "Aprendi o gesto de obrigado!", gestoId: "ge-obrigado" });
    definirPessoaDemo(KIESSE);
    await apiLga.denunciarPostTurma(I, p.id);
    definirPessoaDemo(MUKUNA);
    expect((await apiLga.listarPostsTurma(I, "g-lga1")).some((x) => x.id === p.id)).toBe(false);
    definirPessoaDemo(MARIA);
    expect((await apiLga.listarPostsTurma(I, "g-lga1")).find((x) => x.id === p.id)!.estado).toBe("denunciado");
  });

  it("as classificações mostram só o primeiro nome e respeitam a definição da escola", async () => {
    definirPessoaDemo(KIESSE);
    const turma = await apiLga.classificacao(I, { turmaId: "g-lga1" });
    expect(turma.linhas.length).toBe(6);
    expect(turma.linhas.every((l) => !l.nome.includes(" "))).toBe(true);
    expect(turma.linhas.filter((l) => l.eu)).toHaveLength(1);
    definirPessoaDemo(ANA);
    await apiInstituicoes.atualizarDefinicoes(I, { escola: { comunidadePublicaParaAlunos: false, rankingVisivel: false } });
    definirPessoaDemo(KIESSE);
    await expect(apiLga.classificacao(I, "escola")).rejects.toThrow(/desligou/);
  });
});
