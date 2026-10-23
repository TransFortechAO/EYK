import { beforeEach, describe, expect, it } from "vitest";
import { apiInstituicoes, definirPessoaDemo, reporDemo } from "./api";
import { apiLga } from "./lga";
import { abasTelemovel, navegacaoEscola, restoParaMais } from "./navegacao";
import { PAPEIS } from "./permissoes";

const nada = { porRever: 0, trabalhos: 0, avisosPorLer: 0 };
const urls = (itens: { url: string }[]) => itens.map((i) => i.url);

describe("navegação por papel", () => {
  it("cada papel vê as suas funcionalidades na barra lateral", () => {
    expect(urls(navegacaoEscola("aluno", nada))).toEqual(
      expect.arrayContaining(["/instituicao/turmas", "/instituicao/praticar", "/instituicao/gestuario"]),
    );
    expect(urls(navegacaoEscola("aluno", nada))).not.toContain("/instituicao/membros");
    expect(urls(navegacaoEscola("familia", nada))).toEqual(expect.arrayContaining(["/instituicao/alunos", "/instituicao/consentimentos"]));
    expect(urls(navegacaoEscola("educador", nada))).toEqual(expect.arrayContaining(["/instituicao/respostas", "/instituicao/conteudos"]));
    expect(urls(navegacaoEscola("administrador", nada))).toEqual(expect.arrayContaining(["/instituicao/membros", "/instituicao/definicoes"]));
    // A administração não corrige as respostas em vídeo das crianças.
    expect(urls(navegacaoEscola("administrador", nada))).not.toContain("/instituicao/respostas");
    expect(urls(navegacaoEscola("observador", nada))).toEqual(["/instituicao/relatorios"]);
  });

  it("os contadores aparecem só onde há algo por ver", () => {
    const comNumeros = { porRever: 3, trabalhos: 2, avisosPorLer: 1 };
    expect(navegacaoEscola("educador", comNumeros).find((i) => i.id === "respostas")?.contador).toBe(3);
    expect(navegacaoEscola("aluno", comNumeros).find((i) => i.id === "turmas")?.contador).toBe(2);
    expect(navegacaoEscola("aluno", nada).find((i) => i.id === "turmas")?.contador).toBeUndefined();
  });

  it("no telemóvel há sempre quatro abas, a começar pelo Início", () => {
    for (const papel of [null, ...PAPEIS]) {
      const abas = abasTelemovel(papel, nada);
      expect(abas).toHaveLength(4);
      expect(abas[0].url).toBe("/inicio");
      expect(new Set(urls(abas)).size).toBe(4);
    }
    expect(urls(abasTelemovel(null, nada))).toEqual(["/inicio", "/cursos", "/videos", "/comunidade"]);
    expect(urls(abasTelemovel("aluno", nada))).toEqual(["/inicio", "/instituicao/turmas", "/instituicao/praticar", "/comunidade"]);
    expect(abasTelemovel("formador", { ...nada, porRever: 4 }).find((a) => a.url === "/instituicao/respostas")?.contador).toBe(4);
  });

  it("o que não cabe nas abas vai para o painel Mais, sem repetir", () => {
    const resto = restoParaMais("aluno", nada);
    expect(urls(resto.escola)).not.toContain("/instituicao/turmas");
    expect(urls(resto.escola)).toContain("/instituicao/gestuario");
    expect(urls(resto.geral)).toEqual(["/cursos", "/videos"]);
    expect(restoParaMais(null, nada)).toEqual({ escola: [], geral: [] });
  });
});

describe("plataforma geral, turmas e publicação", () => {
  beforeEach(() => {
    reporDemo(Date.UTC(2026, 9, 23, 10));
    definirPessoaDemo(1001);
  });

  it("os alunos vêem só a escola até escolherem a plataforma geral", async () => {
    definirPessoaDemo(1006); // Kiesse
    expect(await apiLga.verPlataformaGeral("inst-1")).toBe(false);
    await apiLga.definirVerPlataformaGeral("inst-1", true);
    expect(await apiLga.verPlataformaGeral("inst-1")).toBe(true);
    definirPessoaDemo(1102); // Nzinga já tinha escolhido
    expect(await apiLga.verPlataformaGeral("inst-1")).toBe(true);
    definirPessoaDemo(1003); // professores vêem sempre
    expect(await apiLga.verPlataformaGeral("inst-1")).toBe(true);
    await expect(apiLga.definirVerPlataformaGeral("inst-1", false)).rejects.toThrow(/só para alunos/);
  });

  it("a escola põe um professor numa turma e ele passa a poder dar aulas nela", async () => {
    const aula = {
      tipo: "aula" as const, titulo: "Cores", descricao: "", video: { nome: "v.mp4", tamanhoBytes: 1, duracaoSeg: 60 }, legendaPt: false,
      gestosIds: [], recursos: [], conteudo: null, prazo: null, pedeResposta: false, enunciado: "",
    };
    definirPessoaDemo(1004); // João, educador fora da turma
    await expect(apiLga.publicarAula("inst-1", "g-lga1", aula)).rejects.toThrow(/Só quem ensina/);
    definirPessoaDemo(1001); // administração atribui
    await apiInstituicoes.definirMembroNoGrupo("inst-1", "g-lga1", "m-4", true);
    definirPessoaDemo(1004);
    expect((await apiLga.publicarAula("inst-1", "g-lga1", aula)).autor).toBe("João Mateus");
  });

  it("publicar também na plataforma geral passa pela aprovação da equipa EYK", async () => {
    definirPessoaDemo(1003);
    const c = await apiLga.publicarConteudo("inst-1", {
      tipo: "video", titulo: "Dias da semana em LGA", descricao: "", ambito: { tipo: "turma", instituicaoId: "inst-1", turmaId: "g-lga1" },
      duracaoMin: 4, aulas: 0, temLegendas: true, emLga: true,
    });
    await apiLga.proporPublico("inst-1", c.id);
    const propostas = await apiLga.listarPropostasPublicas();
    expect(propostas.map((p) => p.id)).toContain(c.id);
    expect(propostas.find((p) => p.id === c.id)?.escola).toBe("Escola Primária n.º 123 — Luanda");
    await apiLga.decidirPropostaPublica(c.id, true);
    expect((await apiLga.listarPropostasPublicas()).map((p) => p.id)).not.toContain(c.id);
    await expect(apiLga.decidirPropostaPublica(c.id, false)).rejects.toThrow(/já decidida/);
  });
});
