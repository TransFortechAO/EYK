import { beforeEach, describe, expect, it } from "vitest";
import { apiInstituicoes as api, categoriaDoMime, definirPessoaDemo, LIMITE_ANONIMATO, reporDemo, _interno } from "./api";
import { deixaSemAdministrador, eDestinatario, gruposVisiveis, pode } from "./permissoes";
import type { Grupo, Membro } from "./tipos";

// Pessoas de demonstração (ver demo.ts).
const ANA = 1001; // administradora na inst-1, educadora na inst-2
const PAULO = 1002; // coordenador
const MARIA = 1003; // educadora (g-1, g-3)
const OBSERVADOR = 1005;
const ROSA = 1008; // família, tutora de Kiesse (a-1)
const GASPAR = 1023; // administrador da inst-4 (suspensa)

beforeEach(() => {
  reporDemo(Date.UTC(2026, 9, 22, 10));
  definirPessoaDemo(ANA);
});

describe("permissões", () => {
  it("cada papel só faz o que a tabela da especificação permite", () => {
    expect(pode("administrador", "gerir_membros")).toBe(true);
    expect(pode("educador", "gerir_membros")).toBe(false);
    expect(pode("educador", "publicar_avisos")).toBe(true);
    expect(pode("familia", "publicar_avisos")).toBe(false);
    expect(pode("coordenador", "ver_relatorios")).toBe(true);
    expect(pode("observador", "ver_avisos")).toBe(false);
    expect(pode(null, "ver_painel")).toBe(false);
  });

  it("não deixa a instituição sem administrador", () => {
    const membros = [
      { id: "a", papel: "administrador", estado: "ativo" },
      { id: "b", papel: "educador", estado: "ativo" },
    ] as Membro[];
    expect(deixaSemAdministrador(membros, "a", "educador")).toBe(true);
    expect(deixaSemAdministrador(membros, "a", null)).toBe(true);
    expect(deixaSemAdministrador(membros, "b", null)).toBe(false);
    expect(deixaSemAdministrador([...membros, { id: "c", papel: "administrador", estado: "ativo" } as Membro], "a", null)).toBe(false);
  });

  it("educadores só vêem os seus grupos; coordenadores vêem todos", () => {
    const grupos = [{ id: "g1" }, { id: "g2" }] as Grupo[];
    expect(gruposVisiveis(grupos, { papel: "educador", gruposIds: ["g2"] }).map((g) => g.id)).toEqual(["g2"]);
    expect(gruposVisiveis(grupos, { papel: "coordenador", gruposIds: [] })).toHaveLength(2);
  });

  it("destinatários por grupo e por pessoa", () => {
    const familia = { id: "m9", papel: "familia" as const, gruposIds: ["g1"] };
    expect(eDestinatario({ tipo: "grupo", grupoId: "g1" }, familia)).toBe(true);
    expect(eDestinatario({ tipo: "grupo", grupoId: "g2" }, familia)).toBe(false);
    expect(eDestinatario({ tipo: "pessoa", membroId: "m9" }, familia)).toBe(true);
  });
});

describe("espaço da instituição e papéis", () => {
  it("uma pessoa pode pertencer a várias instituições com papéis diferentes", async () => {
    const pertencas = await api.minhasPertencas();
    expect(pertencas.map((p) => [p.instituicao.id, p.membro.papel])).toEqual([
      ["inst-1", "administrador"],
      ["inst-2", "educador"],
    ]);
  });

  it("instituição suspensa: os dados ficam, o acesso é bloqueado", async () => {
    definirPessoaDemo(GASPAR);
    await expect(api.listarMembros("inst-4")).rejects.toThrow(/suspenso/);
  });

  it("dados de uma instituição não são visíveis a quem não pertence", async () => {
    definirPessoaDemo(ROSA);
    await expect(api.listarAvisos("inst-2")).rejects.toThrow(/Não pertences/);
  });

  it("não remove nem despromove o último administrador", async () => {
    await expect(api.alterarPapel("inst-1", "m-1", "educador")).rejects.toThrow(/pelo menos um administrador/);
    await expect(api.removerMembro("inst-1", "m-1")).rejects.toThrow(/pelo menos um administrador/);
    await api.alterarPapel("inst-1", "m-3", "administrador");
    await api.alterarPapel("inst-1", "m-1", "coordenador");
    const registos = await (async () => {
      definirPessoaDemo(MARIA);
      return api.listarAuditoria("inst-1");
    })();
    expect(registos[0].acao).toBe("papel_alterado");
  });

  it("observadores nunca vêem dados pessoais", async () => {
    definirPessoaDemo(OBSERVADOR);
    await expect(api.listarMembros("inst-1")).rejects.toThrow(/dados pessoais/);
    expect(await api.listarAlunos("inst-1")).toEqual([]);
  });
});

describe("convites e adesão", () => {
  it("rejeita convites expirados e códigos esgotados", async () => {
    await expect(api.consultarCodigo("Z9W1R4")).rejects.toThrow(/expirou/);
    const c = await api.criarConvite("inst-1", { canal: "codigo", destino: "", papel: "familia", grupoId: "g-1", alunoId: null, usosMax: 1 });
    definirPessoaDemo(9001);
    await api.aderir(c.codigo, { nome: "Pessoa Um", email: "um@exemplo.ao" });
    await expect(api.consultarCodigo(c.codigo)).rejects.toThrow(/máximo de utilizações/);
  });

  it("educadores só convidam famílias e alunos para os seus grupos", async () => {
    definirPessoaDemo(MARIA);
    await expect(
      api.criarConvite("inst-1", { canal: "email", destino: "x@exemplo.ao", papel: "educador", grupoId: "g-1", alunoId: null, usosMax: 1 }),
    ).rejects.toThrow(/Educadores só podem convidar/);
    await expect(
      api.criarConvite("inst-1", { canal: "email", destino: "x@exemplo.ao", papel: "familia", grupoId: "g-2", alunoId: null, usosMax: 1 }),
    ).rejects.toThrow(/teus grupos/);
  });

  it("com aprovação ativa, quem usa um código fica pendente até ser aprovado", async () => {
    definirPessoaDemo(9002);
    const r = await api.aderir("TURMA3A", { nome: "Nova Família", email: "nova@exemplo.ao" });
    expect(r.resultado).toBe("pendente");
    definirPessoaDemo(ANA);
    const pedido = (await api.listarPedidosAdesao("inst-1")).find((p) => p.nome === "Nova Família")!;
    await api.decidirPedido("inst-1", pedido.id, true);
    expect((await api.listarMembros("inst-1")).some((m) => m.nome === "Nova Família")).toBe(true);
  });
});

describe("vínculo família-aluno e consentimentos", () => {
  it("a família só vê as suas crianças", async () => {
    definirPessoaDemo(ROSA);
    const alunos = await api.listarAlunos("inst-1");
    expect(alunos.length).toBeGreaterThan(0);
    expect(alunos.every((a) => a.tutoresIds.includes("m-8"))).toBe(true);
  });

  it("sem consentimento de utilização não há perfil ativo", async () => {
    definirPessoaDemo(MARIA);
    const aluno = await api.criarAluno("inst-1", { nome: "Nkosi", grupoId: "g-1" });
    expect(aluno.estado).toBe("aguarda_consentimento");
    const convite = await api.criarConvite("inst-1", { canal: "sms", destino: "+244 923 456 789", papel: "familia", grupoId: "g-1", alunoId: aluno.id, usosMax: 1 });

    definirPessoaDemo(9003);
    await expect(api.aderir(convite.codigo, { nome: "Tutor Nkosi", email: "t@exemplo.ao", consentimentos: { utilizacao: false } })).rejects.toThrow(
      /consentimento de utilização/,
    );
    await api.aderir(convite.codigo, { nome: "Tutor Nkosi", email: "t@exemplo.ao", consentimentos: { utilizacao: true, fotografias: false } });
    const atualizado = _interno.carregar().alunos.find((a) => a.id === aluno.id)!;
    expect(atualizado.estado).toBe("ativo");
    expect(atualizado.tutoresIds).toHaveLength(1);
  });

  it("retirar o consentimento tira a criança dos relatórios e fica na auditoria", async () => {
    definirPessoaDemo(ROSA);
    await api.registarConsentimento("inst-1", "a-1", "utilizacao", false);
    expect(_interno.carregar().alunos.find((a) => a.id === "a-1")!.estado).toBe("consentimento_retirado");
    definirPessoaDemo(ANA);
    const [ultimo] = await api.listarAuditoria("inst-1");
    expect(ultimo.acao).toBe("consentimento_alterado");
    expect(ultimo.detalhe).toMatch(/retirado/);
  });
});

describe("avisos, agenda e ficheiros", () => {
  it("o remetente vê contagens e cada destinatário pode confirmar a leitura", async () => {
    definirPessoaDemo(MARIA);
    const aviso = await api.publicarAviso("inst-1", {
      titulo: "Teste", mensagem: "Olá", destinatarios: { tipo: "grupo", grupoId: "g-1" }, pedirConfirmacao: true, anexosIds: [],
    });
    expect(aviso.lidos).toBe(0);
    definirPessoaDemo(ROSA);
    await api.marcarAvisoLido("inst-1", aviso.id, true);
    definirPessoaDemo(MARIA);
    const visto = (await api.listarAvisos("inst-1")).find((a) => a.id === aviso.id)!;
    expect(visto.lidos).toBe(1);
    expect(visto.confirmados).toBe(1);
  });

  it("só a administração escreve para toda a instituição", async () => {
    definirPessoaDemo(MARIA);
    await expect(
      api.publicarAviso("inst-1", { titulo: "x", mensagem: "y", destinatarios: { tipo: "instituicao" }, pedirConfirmacao: false, anexosIds: [] }),
    ).rejects.toThrow(/toda a instituição/);
  });

  it("presenças contam as respostas", async () => {
    definirPessoaDemo(ROSA);
    await api.responderPresenca("inst-1", "ev-2", "talvez");
    const ev = (await api.listarEventos("inst-1")).find((e) => e.id === "ev-2")!;
    expect(ev.minhaResposta).toBe("talvez");
  });

  it("fotos de crianças exigem o consentimento de todas as crianças do grupo", async () => {
    definirPessoaDemo(MARIA);
    await expect(
      api.carregarFicheiro("inst-1", { nome: "fotos.jpg", tamanhoBytes: 1000, mime: "image/jpeg", visibilidade: { tipo: "grupo", grupoId: "g-1" }, temCriancas: true }),
    ).rejects.toThrow(/consentimento para fotografias/);
  });

  it("aplica o limite por ficheiro e os tipos permitidos", async () => {
    definirPessoaDemo(MARIA);
    await expect(
      api.carregarFicheiro("inst-1", { nome: "grande.mp4", tamanhoBytes: 500 * 1024 * 1024, mime: "video/mp4", visibilidade: { tipo: "grupo", grupoId: "g-1" }, temCriancas: false }),
    ).rejects.toThrow(/limite de 100 MB/);
    await expect(
      api.carregarFicheiro("inst-1", { nome: "programa.exe", tamanhoBytes: 1000, mime: "application/x-msdownload", visibilidade: { tipo: "grupo", grupoId: "g-1" }, temCriancas: false }),
    ).rejects.toThrow(/não permitido/);
    expect(categoriaDoMime("application/pdf", "plano.pdf")).toBe("documento");
  });
});

describe("relatórios", () => {
  it("grupos com menos de 5 pessoas não mostram detalhe", async () => {
    definirPessoaDemo(PAULO);
    const r = await api.relatorio("inst-1");
    for (const g of r.grupos) {
      expect(g.oculto).toBe(g.membros < LIMITE_ANONIMATO);
      if (g.oculto) expect(g.ativos30d).toBeNull();
    }
    expect(r.grupos.some((g) => g.oculto)).toBe(true);
    expect(r.grupos.some((g) => !g.oculto)).toBe(true);
  });

  it("famílias não vêem relatórios", async () => {
    definirPessoaDemo(ROSA);
    await expect(api.relatorio("inst-1")).rejects.toThrow(/papel não permite/);
  });
});

describe("administração EYK", () => {
  it("criar uma instituição envia convite de administrador e fica na auditoria", async () => {
    const inst = await api.eyk.criarInstituicao({
      nome: "Escola Nova", tipo: "escola", provincia: "Huambo", responsavelNome: "Diretora", responsavelEmail: "diretora@exemplo.ao",
    });
    expect(inst.estado).toBe("preparacao");
    const e = _interno.carregar();
    expect(e.convites.some((c) => c.instituicaoId === inst.id && c.papel === "administrador")).toBe(true);
    expect(e.auditoria.some((r) => r.instituicaoId === inst.id && r.origem === "equipa_eyk")).toBe(true);
  });

  it("o acesso da equipa EYK à auditoria exige motivo e fica registado", async () => {
    await expect(api.eyk.consultarAuditoria("inst-1", "")).rejects.toThrow(/motivo/);
    const registos = await api.eyk.consultarAuditoria("inst-1", "Pedido de apoio n.º 20");
    expect(registos[0].acao).toBe("acesso_equipa_eyk");
  });
});
