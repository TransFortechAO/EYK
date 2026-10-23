// Dados de demonstração do ensino de LGA nas escolas: Turmas LGA, aulas,
// respostas em vídeo, gestuário, prática, conteúdos da escola, comunidade da
// turma e desafios. Determinísticos (sem Math.random).
//
// Recebe as listas base (membros, perfis de alunos, convites, grupos) e
// acrescenta-lhes o que as turmas precisam: um formador, contas de aluno
// ligadas aos perfis das crianças, os grupos das turmas e os seus códigos.
import { lgaAlphabet, lgaWords, type LgaWord } from "@/lib/lga-data";
import type {
  Aula,
  Competencia,
  ConteudoEscola,
  Convite,
  Desafio,
  Gesto,
  Grupo,
  Membro,
  PerfilAluno,
  PostTurma,
  ProgressoCompetencia,
  RegistoPratica,
  RespostaVideo,
  TemaGesto,
} from "./tipos";

const DIA = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

/** Fim do ano letivo (31 de julho seguinte): quando as respostas em vídeo são apagadas. */
export function fimAnoLetivo(agora: number): string {
  const d = new Date(agora);
  const ano = d.getUTCMonth() >= 7 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
  return new Date(Date.UTC(ano, 6, 31, 23, 59)).toISOString();
}

const TEMA_DA_CATEGORIA: Record<LgaWord["category"], TemaGesto> = {
  Saudações: "saudacoes",
  Emoções: "emocoes",
  Escola: "escola",
  Família: "familia",
  Quotidiano: "quotidiano",
};

const NUMEROS: [string, string, string][] = [
  ["1", "☝️", "Indicador levantado, palma para a frente."],
  ["2", "✌️", "Indicador e médio levantados."],
  ["3", "🤟", "Polegar, indicador e médio levantados."],
  ["4", "🖖", "Quatro dedos levantados, polegar dobrado."],
  ["5", "🖐️", "Mão aberta, todos os dedos afastados."],
  ["6", "🤙", "Polegar e mindinho esticados."],
  ["7", "👌", "Polegar toca no anelar."],
  ["8", "🤌", "Polegar toca no médio."],
  ["9", "🫰", "Polegar toca no indicador."],
  ["10", "👍", "Polegar levantado, pequeno movimento de rotação."],
];

const FRASES: [string, string, string, Gesto["motion"]][] = [
  ["Bom dia, professora", "🌅", "Bom dia seguido do gesto de professor(a), com expressão facial de cumprimento.", "updown"],
  ["Como te chamas?", "❓", "Apontar para a pessoa e soletrar no ar, sobrancelhas franzidas (pergunta).", "circle"],
  ["O meu nome é…", "🙋", "Mão no peito, depois soletrar o nome com o alfabeto manual.", "tap"],
  ["Até amanhã", "👋", "Aceno seguido do gesto de amanhã (mão passa para a frente junto à cara).", "wave"],
  ["Preciso de ajuda", "🙏", "Mão fechada sobre a palma da outra, ambas sobem.", "updown"],
];

export function criarDemoLga(
  agora: number,
  base: { membros: Membro[]; alunos: PerfilAluno[]; convites: Convite[]; grupos: Grupo[] },
) {
  const { membros, alunos, convites, grupos } = base;
  const fimAno = fimAnoLetivo(agora);
  const membro = (id: string) => membros.find((m) => m.id === id)!;

  // ── Pessoas: um formador de LGA e contas de aluno ligadas aos perfis ──
  membros.push({
    id: "m-f1",
    instituicaoId: "inst-1",
    utilizadorId: 1030,
    nome: "Domingos Sapalo",
    email: "domingos.sapalo@exemplo.ao",
    papel: "formador",
    estado: "ativo",
    desde: iso(agora - 40 * DIA),
    ultimoAcesso: iso(agora - 3 * 60 * 60 * 1000),
    gruposIds: [],
  });

  // Kiesse (m-6) já tem conta de aluno; liga-se ao perfil a-1.
  alunos.find((a) => a.id === "a-1")!.contaId = "m-6";
  const contas: [string, string, number][] = [
    ["a-2", "Nzinga Bento", 1102],
    ["a-3", "Mukuna Manuel", 1103],
    ["a-4", "Ndalu Cassoma", 1104],
    ["a-5", "Wezo Sebastião", 1105],
    ["a-6", "Yola Tchivinda", 1106],
  ];
  for (const [alunoId, nome, utilizadorId] of contas) {
    const id = `m-${alunoId}`;
    membros.push({
      id,
      instituicaoId: "inst-1",
      utilizadorId,
      nome,
      email: `${nome.split(" ")[0].toLowerCase()}@aluno.exemplo.ao`,
      papel: "aluno",
      estado: "ativo",
      desde: iso(agora - 35 * DIA),
      ultimoAcesso: iso(agora - (utilizadorId % 4) * DIA - 2 * 60 * 60 * 1000),
      gruposIds: ["g-1"],
    });
    alunos.find((a) => a.id === alunoId)!.contaId = id;
  }
  const contasAlunos = ["m-6", ...contas.map(([a]) => `m-${a}`)];
  const tutoresTurma = Array.from(new Set(alunos.filter((a) => contasAlunos.includes(a.contaId ?? "")).flatMap((a) => a.tutoresIds)));

  // ── Turmas LGA (grupos do tipo turma_lga) e os seus códigos ──
  const turma = (id: string, nome: string, lga: Omit<NonNullable<Grupo["lga"]>, "conviteAlunosId" | "conviteFamiliasId">, codigos: [string | null, string | null], papelAlunos: Membro["papel"] = "aluno") => {
    const [codAlunos, codFamilias] = codigos;
    const mk = (codigo: string, papel: Membro["papel"]): string => {
      const c: Convite = {
        id: `cv-${id}-${papel}`,
        instituicaoId: "inst-1",
        canal: "codigo",
        destino: "",
        codigo,
        papel,
        grupoId: id,
        alunoId: null,
        usos: papel === "aluno" ? 6 : 4,
        usosMax: 40,
        criadoPor: "Maria Kiala",
        criadoEm: iso(agora - 30 * DIA),
        expiraEm: iso(agora + 30 * DIA),
        estado: "pendente",
      };
      convites.push(c);
      return c.id;
    };
    grupos.push({
      id,
      instituicaoId: "inst-1",
      nome,
      tipo: "turma_lga",
      anoLetivo: "2026/2027",
      arquivado: false,
      criadoEm: iso(agora - 30 * DIA),
      lga: {
        ...lga,
        conviteAlunosId: codAlunos ? mk(codAlunos, papelAlunos) : null,
        conviteFamiliasId: codFamilias ? mk(codFamilias, "familia") : null,
      },
    });
  };

  turma(
    "g-lga1",
    "LGA Iniciação — 3.ª Classe A",
    {
      publico: "surdos_l1",
      nivel: "iniciacao",
      descricao: "Alfabeto manual, saudações e vocabulário da escola para os alunos surdos da 3.ª A. As famílias acompanham as aulas.",
    },
    ["LGA3A", "FAM3A"],
  );
  turma(
    "g-lga2",
    "LGA em casa — famílias",
    {
      publico: "familias",
      nivel: "iniciacao",
      descricao: "Gestos do dia a dia para pais e tutores de crianças surdas. Uma pequena aula por semana, ligada ao que as crianças aprendem.",
    },
    [null, "LGAFAM"],
  );
  turma(
    "g-lga3",
    "Formação de professores em LGA",
    {
      publico: "professores",
      nivel: "iniciacao",
      descricao: "Formação para os docentes da escola comunicarem com alunos surdos. Conclui com certificado.",
    },
    ["PROFLGA", null],
    "educador",
  );

  const juntar = (membroId: string, ...ids: string[]) => {
    const m = membro(membroId);
    m.gruposIds = Array.from(new Set([...m.gruposIds, ...ids]));
  };
  juntar("m-3", "g-lga1", "g-lga2", "g-lga3"); // Maria Kiala, educadora
  juntar("m-f1", "g-lga1", "g-lga2", "g-lga3"); // Domingos Sapalo, formador
  juntar("m-4", "g-lga3"); // João Mateus em formação
  for (const id of contasAlunos) juntar(id, "g-lga1");
  for (const id of tutoresTurma) juntar(id, "g-lga1", "g-lga2");
  for (const id of ["m-14", "m-15"]) juntar(id, "g-lga2");

  // ── Gestuário ──
  const gestos: Gesto[] = [];
  const plataforma = (g: Omit<Gesto, "estado" | "instituicaoId" | "propostoPor" | "propostoEm" | "validacao" | "video" | "variante"> & { variante?: string }) => {
    gestos.push({
      variante: "Comum",
      video: null,
      estado: "validado",
      instituicaoId: null,
      propostoPor: "Equipa EYK",
      propostoEm: iso(agora - 90 * DIA),
      validacao: { por: "Domingos Sapalo (formador surdo)", em: iso(agora - 85 * DIA), nota: "" },
      ...g,
    });
  };
  for (const l of lgaAlphabet) {
    plataforma({ id: `ge-l-${l.letter}`, palavra: l.letter, tema: "alfabeto", descricao: l.hint, glyph: l.glyph, motion: l.motion });
  }
  for (const [n, glyph, descricao] of NUMEROS) {
    plataforma({ id: `ge-n-${n}`, palavra: n, tema: "numeros", descricao, glyph, motion: "static" });
  }
  for (const w of lgaWords) {
    plataforma({ id: `ge-${w.id}`, palavra: w.word, tema: TEMA_DA_CATEGORIA[w.category], descricao: w.description, glyph: w.glyph, motion: w.motion });
  }
  FRASES.forEach(([palavra, glyph, descricao, motion], i) => {
    plataforma({ id: `ge-f-${i + 1}`, palavra, tema: "frases", descricao, glyph, motion });
  });
  // Contributos da escola: variantes regionais à espera de validação.
  gestos.push(
    {
      id: "ge-p-1", palavra: "Professor", tema: "escola", variante: "Huíla", glyph: "🧑‍🏫", motion: "tap",
      descricao: "Na Huíla: mão em P toca duas vezes no peito.", video: null, estado: "proposto", instituicaoId: "inst-1",
      propostoPor: "Maria Kiala", propostoEm: iso(agora - 2 * DIA), validacao: null,
    },
    {
      id: "ge-p-2", palavra: "Mãe", tema: "familia", variante: "Benguela", glyph: "🤱", motion: "tap",
      descricao: "Em Benguela: dedos juntos tocam na face, junto à boca.", video: null, estado: "proposto", instituicaoId: "inst-1",
      propostoPor: "Domingos Sapalo", propostoEm: iso(agora - 1 * DIA), validacao: null,
    },
    {
      id: "ge-p-3", palavra: "Recreio", tema: "escola", variante: "Comum", glyph: "⚽", motion: "wave",
      descricao: "Mãos abertas alternam para cima e para baixo, como quem corre.", video: null, estado: "validado", instituicaoId: "inst-1",
      propostoPor: "Maria Kiala", propostoEm: iso(agora - 20 * DIA),
      validacao: { por: "Domingos Sapalo", em: iso(agora - 18 * DIA), nota: "Confirmado com alunos surdos da escola." },
    },
    {
      id: "ge-p-4", palavra: "Lanche", tema: "quotidiano", variante: "Comum", glyph: "🥪", motion: "tap",
      descricao: "Dedos em pinça levados à boca uma vez.", video: null, estado: "rejeitado", instituicaoId: "inst-1",
      propostoPor: "João Mateus", propostoEm: iso(agora - 15 * DIA),
      validacao: { por: "Domingos Sapalo", em: iso(agora - 14 * DIA), nota: "É o gesto de comer. Para lanche usa-se a mão em L junto à boca — grava de novo." },
    },
  );

  // ── Conteúdos publicados pela escola (âmbito escola ou turma) ──
  const conteudos: ConteudoEscola[] = [
    {
      id: "ce-1", instituicaoId: "inst-1", tipo: "curso", titulo: "Introdução à LGA para a 3.ª Classe",
      descricao: "Oito lições curtas, totalmente sinalizadas, com o vocabulário que os alunos usam na sala.",
      autor: "Maria Kiala", autorId: "m-3", ambito: { tipo: "turma", instituicaoId: "inst-1", turmaId: "g-lga1" },
      duracaoMin: 64, aulas: 8, temLegendas: true, emLga: true, publicadoEm: iso(agora - 25 * DIA), vistas: 142, propostaPublica: null,
    },
    {
      id: "ce-2", instituicaoId: "inst-1", tipo: "video", titulo: "Hino Nacional em LGA",
      descricao: "Os alunos da escola sinalizam o Hino Nacional de Angola.",
      autor: "Domingos Sapalo", autorId: "m-f1", ambito: { tipo: "instituicao", instituicaoId: "inst-1" },
      duracaoMin: 3, aulas: 0, temLegendas: true, emLga: true, publicadoEm: iso(agora - 12 * DIA), vistas: 310, propostaPublica: "pendente",
    },
    {
      id: "ce-3", instituicaoId: "inst-1", tipo: "video", titulo: "Rotina da sala de aula em gestos",
      descricao: "Sentar, levantar, silêncio, recreio, lanche: os gestos que usamos todos os dias.",
      autor: "Maria Kiala", autorId: "m-3", ambito: { tipo: "instituicao", instituicaoId: "inst-1" },
      duracaoMin: 6, aulas: 0, temLegendas: false, emLga: true, publicadoEm: iso(agora - 5 * DIA), vistas: 87, propostaPublica: null,
    },
    {
      id: "ce-4", instituicaoId: "inst-1", tipo: "curso", titulo: "LGA para pais — 10 lições",
      descricao: "Para as famílias: comunicar com a criança em casa, à mesa, na rua.",
      autor: "Domingos Sapalo", autorId: "m-f1", ambito: { tipo: "turma", instituicaoId: "inst-1", turmaId: "g-lga2" },
      duracaoMin: 50, aulas: 10, temLegendas: true, emLga: true, publicadoEm: iso(agora - 18 * DIA), vistas: 64, propostaPublica: null,
    },
    {
      id: "ce-5", instituicaoId: "inst-2", tipo: "video", titulo: "Bem-vindos à Mãos que Falam",
      descricao: "Apresentação da associação, em LGA.",
      autor: "Bernardo Sapalo", autorId: "m-21", ambito: { tipo: "instituicao", instituicaoId: "inst-2" },
      duracaoMin: 2, aulas: 0, temLegendas: true, emLga: true, publicadoEm: iso(agora - 9 * DIA), vistas: 40, propostaPublica: null,
    },
  ];

  // ── Aulas ──
  const letras = (de: string, ate: string) =>
    lgaAlphabet.filter((l) => l.letter >= de && l.letter <= ate).map((l) => `ge-l-${l.letter}`);
  const aulas: Aula[] = [
    {
      id: "au-1", instituicaoId: "inst-1", turmaId: "g-lga1", tipo: "aula", titulo: "Alfabeto manual: de A a M",
      descricao: "Vemos e repetimos as letras de A a M. Atenção à posição do polegar no A, no M e no N.",
      video: { nome: "alfabeto-a-m.mp4", tamanhoBytes: 38 * 1024 * 1024, duracaoSeg: 7 * 60 + 40 }, legendaPt: true,
      gestosIds: letras("A", "M"), recursos: [{ nome: "Ficha — alfabeto A a M.pdf", tamanhoBytes: 420 * 1024 }], conteudo: null,
      prazo: iso(agora + 3 * DIA), pedeResposta: true, enunciado: "Grava-te a soletrar o teu nome com o alfabeto manual.",
      autor: "Maria Kiala", autorId: "m-3", publicadaEm: iso(agora - 6 * DIA),
    },
    {
      id: "au-2", instituicaoId: "inst-1", turmaId: "g-lga1", tipo: "aula", titulo: "Saudações: olá, bom dia, obrigado",
      descricao: "As primeiras frases para cumprimentar colegas e professores. A expressão facial faz parte do gesto.",
      video: { nome: "saudacoes.mp4", tamanhoBytes: 26 * 1024 * 1024, duracaoSeg: 5 * 60 + 10 }, legendaPt: true,
      gestosIds: ["ge-ola", "ge-bomdia", "ge-obrigado", "ge-f-1", "ge-f-3"], recursos: [], conteudo: null,
      prazo: iso(agora + 5 * DIA), pedeResposta: true, enunciado: "Apresenta-te em LGA: «Olá, bom dia. O meu nome é…»",
      autor: "Domingos Sapalo", autorId: "m-f1", publicadaEm: iso(agora - 3 * DIA),
    },
    {
      id: "au-3", instituicaoId: "inst-1", turmaId: "g-lga1", tipo: "atribuicao", titulo: "Ver: Introdução à LGA (lições 1 e 2)",
      descricao: "Vê as duas primeiras lições do curso da escola antes da aula de quinta-feira.",
      video: null, legendaPt: false, gestosIds: [], recursos: [],
      conteudo: { origem: "escola", tipo: "curso", id: "ce-1", titulo: "Introdução à LGA para a 3.ª Classe" },
      prazo: iso(agora - 1 * DIA), pedeResposta: false, enunciado: "",
      autor: "Maria Kiala", autorId: "m-3", publicadaEm: iso(agora - 8 * DIA),
    },
    {
      id: "au-4", instituicaoId: "inst-1", turmaId: "g-lga1", tipo: "aula", titulo: "Números de 1 a 10",
      descricao: "Contar com as mãos em LGA. No fim, pratica em Praticar → Números.",
      video: { nome: "numeros-1-10.mp4", tamanhoBytes: 21 * 1024 * 1024, duracaoSeg: 4 * 60 }, legendaPt: false,
      gestosIds: NUMEROS.map(([n]) => `ge-n-${n}`), recursos: [], conteudo: null,
      prazo: null, pedeResposta: false, enunciado: "",
      autor: "Maria Kiala", autorId: "m-3", publicadaEm: iso(agora - 1 * DIA),
    },
    {
      id: "au-5", instituicaoId: "inst-1", turmaId: "g-lga2", tipo: "aula", titulo: "Em casa: gestos da família",
      descricao: "Mãe, pai, irmão, avó, família, casa. Esta semana os vossos filhos aprenderam estes gestos na escola — usem-nos em casa!",
      video: { nome: "familia-em-casa.mp4", tamanhoBytes: 18 * 1024 * 1024, duracaoSeg: 3 * 60 + 30 }, legendaPt: true,
      gestosIds: ["ge-familia", "ge-casa", "ge-amigo", "ge-adoro"], recursos: [{ nome: "Cartões para imprimir — família.pdf", tamanhoBytes: 900 * 1024 }],
      conteudo: null, prazo: null, pedeResposta: false, enunciado: "",
      autor: "Domingos Sapalo", autorId: "m-f1", publicadaEm: iso(agora - 2 * DIA),
    },
    {
      id: "au-6", instituicaoId: "inst-1", turmaId: "g-lga3", tipo: "aula", titulo: "Comunicar na sala com um aluno surdo",
      descricao: "Como chamar a atenção, posicionar-se e usar os gestos essenciais da sala de aula.",
      video: { nome: "sala-de-aula.mp4", tamanhoBytes: 44 * 1024 * 1024, duracaoSeg: 9 * 60 }, legendaPt: true,
      gestosIds: ["ge-professor", "ge-aprender", "ge-livro", "ge-f-5"], recursos: [], conteudo: null,
      prazo: iso(agora + 7 * DIA), pedeResposta: true, enunciado: "Grava-te a dizer em LGA: «Bom dia. Hoje vamos aprender…»",
      autor: "Domingos Sapalo", autorId: "m-f1", publicadaEm: iso(agora - 4 * DIA),
    },
  ];

  // ── Respostas em vídeo ──
  const video = (nome: string, seg: number) => ({ nome, tamanhoBytes: seg * 400 * 1024, duracaoSeg: seg });
  const resposta = (id: string, aulaId: string, alunoId: string, dias: number, estado: RespostaVideo["estado"], feedback: string | null, tentativa = 1): RespostaVideo => ({
    id,
    instituicaoId: "inst-1",
    turmaId: "g-lga1",
    aulaId,
    alunoId,
    alunoNome: membro(alunoId).nome,
    video: video(`${id}.webm`, 18 + (dias % 3) * 6),
    enviadaEm: iso(agora - dias * DIA),
    estado,
    feedback: feedback ? { texto: feedback, video: null, por: "Maria Kiala", em: iso(agora - (dias - 0.5) * DIA) } : null,
    apagarEm: fimAno,
    tentativa,
  });
  const respostasVideo: RespostaVideo[] = [
    resposta("rv-1", "au-1", "m-6", 1, "por_rever", null),
    resposta("rv-2", "au-1", "m-a-2", 3, "correto", "Muito bem, Nzinga! O N está perfeito."),
    resposta("rv-3", "au-1", "m-a-3", 2, "repetir", "Quase! No M, o polegar fica por baixo de três dedos. Tenta outra vez."),
    resposta("rv-4", "au-1", "m-a-4", 1, "por_rever", null),
    resposta("rv-5", "au-2", "m-a-2", 0.3, "por_rever", null),
  ];

  // ── Progresso por competência e registos de prática (esta semana) ──
  const progresso: Record<string, Partial<Record<Competencia, ProgressoCompetencia>>> = {};
  const registosPratica: RegistoPratica[] = [];
  const pontosEscola: Record<string, number> = {};
  const competencias: Competencia[] = ["alfabeto", "numeros", "vocabulario", "frases"];
  [...contasAlunos, "m-8", "m-3"].forEach((membroId, i) => {
    progresso[membroId] = {};
    competencias.forEach((c, j) => {
      const tentativas = Math.max(0, 30 - j * 8 - i * 2);
      if (!tentativas) return;
      const taxa = Math.min(0.95, 0.45 + ((i * 7 + j * 11) % 45) / 100);
      const recentes = Array.from({ length: Math.min(10, tentativas) }, (_, k) => (k * 37 + i * 13 + j) % 100 < taxa * 100);
      progresso[membroId][c] = { tentativas, acertos: Math.round(tentativas * taxa), recentes };
    });
    // Prática desta semana em "família" (desafio d-1) e no alfabeto (d-2).
    const n = 4 + ((i * 5) % 11);
    for (let k = 0; k < n; k++) {
      registosPratica.push({
        membroId,
        instituicaoId: "inst-1",
        competencia: k % 3 === 0 ? "alfabeto" : "vocabulario",
        tema: k % 3 === 0 ? "alfabeto" : "familia",
        certo: (k + i) % 4 !== 0,
        em: iso(agora - ((k % 4) + 0.2) * DIA),
      });
    }
    pontosEscola[membroId] = 40 + ((i * 53) % 160);
  });

  // ── Comunidade da turma ──
  const post = (id: string, autorId: string, horas: number, texto: string, gestoId: string | null = null, estado: PostTurma["estado"] = "visivel"): PostTurma => {
    const autor = membro(autorId);
    return { id, instituicaoId: "inst-1", turmaId: "g-lga1", autorId, autorNome: autor.nome, papel: autor.papel, texto, gestoId, criadoEm: iso(agora - horas * 60 * 60 * 1000), estado };
  };
  const postsTurma: PostTurma[] = [
    post("pt-1", "m-3", 70, "Bem-vindos à turma de LGA! Aqui partilhamos o que aprendemos. Lembrem-se: respeito por todos e só publicações da turma."),
    post("pt-2", "m-6", 30, "Hoje aprendi a soletrar o meu nome! K-I-E-S-S-E", "ge-l-K"),
    post("pt-3", "m-a-2", 20, "Alguém quer praticar os números comigo no recreio?", "ge-n-5"),
    post("pt-4", "m-f1", 8, "Gesto da semana: «Obrigado». Usem-no muitas vezes esta semana!", "ge-obrigado"),
    post("pt-5", "m-a-3", 5, "publicação escondida pela professora", null, "oculto"),
  ];

  // ── Desafios da escola ──
  const desafios: Desafio[] = [
    {
      id: "d-1", instituicaoId: "inst-1", turmaId: "g-lga1", titulo: "20 gestos da família esta semana",
      descricao: "Acerta 20 exercícios do tema Família em Praticar.", competencia: "vocabulario", tema: "familia",
      meta: 20, recompensa: 30, terminaEm: iso(agora + 4 * DIA), criadoPor: "Maria Kiala",
    },
    {
      id: "d-2", instituicaoId: "inst-1", turmaId: null, titulo: "Alfabeto completo",
      descricao: "Acerta 26 exercícios do alfabeto manual — um por letra.", competencia: "alfabeto", tema: "alfabeto",
      meta: 26, recompensa: 50, terminaEm: iso(agora + 10 * DIA), criadoPor: "Domingos Sapalo",
    },
  ];

  const desafiosConcluidos: Record<string, string[]> = {};
  return { aulas, respostasVideo, gestos, progresso, registosPratica, conteudos, postsTurma, desafios, pontosEscola, desafiosConcluidos };
}
