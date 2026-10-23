// Dados de demonstração da área "Instituição". Gerados em relação à data
// atual e de forma determinística (sem Math.random), para os testes serem
// estáveis. Substituídos pela eyk-api quando o backend existir.
import type {
  Aviso,
  Consentimento,
  Convite,
  Evento,
  FicheiroInstituicao,
  Grupo,
  Instituicao,
  Membro,
  Papel,
  PedidoAdesao,
  PedidoDados,
  PerfilAluno,
  RegistoAuditoria,
  TextoConsentimento,
  Aula,
  ConteudoEscola,
  Desafio,
  Gesto,
  PostTurma,
  ProgressoCompetencia,
  RegistoPratica,
  RespostaVideo,
} from "./tipos";
import { criarDemoLga } from "./demo-lga";

export type EstadoDemo = {
  instituicoes: Instituicao[];
  membros: Membro[];
  convites: Convite[];
  pedidosAdesao: PedidoAdesao[];
  grupos: Grupo[];
  alunos: PerfilAluno[];
  avisos: Aviso[];
  leituras: Record<string, { lidos: string[]; confirmados: string[] }>;
  eventos: Evento[];
  respostas: Record<string, Record<string, "vou" | "nao_vou" | "talvez">>;
  ficheiros: FicheiroInstituicao[];
  consentimentos: Consentimento[];
  auditoria: RegistoAuditoria[];
  pedidosDados: PedidoDados[];
  preferencias: Record<string, { plataforma: boolean; email: boolean }>;
  // Ensino de LGA
  aulas: Aula[];
  respostasVideo: RespostaVideo[];
  gestos: Gesto[];
  progresso: Record<string, Partial<Record<ProgressoCompetenciaChave, ProgressoCompetencia>>>;
  registosPratica: RegistoPratica[];
  conteudos: ConteudoEscola[];
  postsTurma: PostTurma[];
  desafios: Desafio[];
  /** Moedas ganhas na escola (prática, respostas certas, desafios) — por membro. */
  pontosEscola: Record<string, number>;
  /** Desafios já concluídos (a recompensa só é dada uma vez) — por membro. */
  desafiosConcluidos: Record<string, string[]>;
  /** Alunos que escolheram ver também a plataforma geral (por omissão vêem só a escola) — por membro. */
  verGeral: Record<string, boolean>;
  seq: number;
};

type ProgressoCompetenciaChave = "alfabeto" | "numeros" | "vocabulario" | "frases";

export const TEXTO_CONSENTIMENTO: TextoConsentimento = {
  versao: "2026-10.2",
  publicadoEm: "2026-10-23",
  resumo: [
    "Recolhemos apenas o nome ou alcunha da criança e a turma.",
    "Servem para a criança usar o EYK e para a escola partilhar avisos e ficheiros com a família.",
    "Vêem estes dados: os educadores da turma, a administração da escola e tu.",
    "Não recolhemos informação clínica nem de diagnóstico.",
    "Podes mudar ou retirar qualquer consentimento a qualquer momento.",
  ],
  finalidades: [
    {
      id: "utilizacao",
      titulo: "Utilização da plataforma",
      descricao: "A criança tem um perfil na escola e acede aos conteúdos e às atividades da turma.",
      obrigatoria: true,
    },
    {
      id: "fotografias",
      titulo: "Fotografias e vídeos na turma",
      descricao: "Os educadores podem partilhar, só com a turma, fotografias ou vídeos em que a criança apareça.",
      obrigatoria: false,
    },
    {
      id: "relatorios",
      titulo: "Relatórios agregados",
      descricao: "A atividade da criança conta, de forma anónima e somada à dos colegas, nos relatórios da escola.",
      obrigatoria: false,
    },
    {
      id: "respostas_video",
      titulo: "Respostas em vídeo nas aulas de LGA",
      descricao:
        "A criança pode gravar-se a sinalizar para o professor corrigir. Só o professor da turma e a família vêem estes vídeos, e são apagados no fim do ano letivo.",
      obrigatoria: false,
    },
  ],
};

const DIA = 24 * 60 * 60 * 1000;

function iso(ms: number) {
  return new Date(ms).toISOString();
}

const NOMES_ALUNOS = [
  "Kiesse", "Nzinga", "Mukuna", "Ndalu", "Wezo", "Yola", "Kalunga", "Tchissola",
  "Ngola", "Luena", "Muxima", "Kiami", "Ana Beatriz", "Domingos", "Esperança",
];
const NOMES_TUTORES = [
  "Rosa Lopes", "Carlos Bento", "Teresa Manuel", "Joana Cassoma", "Pedro Sebastião", "Luísa Tchivinda",
  "Mário Quissanga", "Helena Paulo", "Adão Muhongo", "Sara Ngunza", "Victor Capemba", "Celeste Fortunato",
];

export function criarEstadoDemo(agora = Date.now()): EstadoDemo {
  const instituicoes: Instituicao[] = [
    {
      id: "inst-1",
      nome: "Escola Primária n.º 123 — Luanda",
      tipo: "escola",
      provincia: "Luanda",
      estado: "ativa",
      responsavel: { nome: "Ana Domingos", email: "direcao@escola123.ao" },
      criadaEm: iso(agora - 60 * DIA),
      quotas: { armazenamentoMb: 2048, ficheiroMaxMb: 100, utilizadoresMax: 300 },
      aprovarPedidosPorCodigo: true,
      canaisAviso: ["plataforma", "email"],
      escola: { comunidadePublicaParaAlunos: false, rankingVisivel: true },
    },
    {
      id: "inst-2",
      nome: "Associação Mãos que Falam",
      tipo: "associacao",
      provincia: "Benguela",
      estado: "ativa",
      responsavel: { nome: "Bernardo Sapalo", email: "geral@maosquefalam.ao" },
      criadaEm: iso(agora - 30 * DIA),
      quotas: { armazenamentoMb: 1024, ficheiroMaxMb: 50, utilizadoresMax: 100 },
      aprovarPedidosPorCodigo: false,
      canaisAviso: ["plataforma"],
      escola: { comunidadePublicaParaAlunos: true, rankingVisivel: true },
    },
    {
      id: "inst-3",
      nome: "Centro de Apoio Kilamba",
      tipo: "centro",
      provincia: "Luanda",
      estado: "preparacao",
      responsavel: { nome: "Fernanda Kiluange", email: "centro.kilamba@exemplo.ao" },
      criadaEm: iso(agora - 2 * DIA),
      quotas: { armazenamentoMb: 1024, ficheiroMaxMb: 50, utilizadoresMax: 100 },
      aprovarPedidosPorCodigo: true,
      canaisAviso: ["plataforma", "email"],
      escola: { comunidadePublicaParaAlunos: false, rankingVisivel: true },
    },
    {
      id: "inst-4",
      nome: "Colégio Esperança",
      tipo: "escola",
      provincia: "Huíla",
      estado: "suspensa",
      responsavel: { nome: "Gaspar Tchindele", email: "colegio.esperanca@exemplo.ao" },
      criadaEm: iso(agora - 120 * DIA),
      quotas: { armazenamentoMb: 2048, ficheiroMaxMb: 100, utilizadoresMax: 300 },
      aprovarPedidosPorCodigo: true,
      canaisAviso: ["plataforma", "email"],
      escola: { comunidadePublicaParaAlunos: false, rankingVisivel: true },
    },
  ];

  const grupos: Grupo[] = [
    { id: "g-1", instituicaoId: "inst-1", nome: "3.ª Classe A", tipo: "turma", anoLetivo: "2026/2027", arquivado: false, criadoEm: iso(agora - 50 * DIA) },
    { id: "g-2", instituicaoId: "inst-1", nome: "4.ª Classe B", tipo: "turma", anoLetivo: "2026/2027", arquivado: false, criadoEm: iso(agora - 50 * DIA) },
    { id: "g-3", instituicaoId: "inst-1", nome: "Apoio em Língua Gestual", tipo: "apoio", anoLetivo: "2026/2027", arquivado: false, criadoEm: iso(agora - 40 * DIA) },
    { id: "g-4", instituicaoId: "inst-1", nome: "3.ª Classe A (2025/2026)", tipo: "turma", anoLetivo: "2025/2026", arquivado: true, criadoEm: iso(agora - 400 * DIA) },
    { id: "g-5", instituicaoId: "inst-2", nome: "Famílias — Benguela", tipo: "familias", anoLetivo: "2026/2027", arquivado: false, criadoEm: iso(agora - 25 * DIA) },
  ];

  const membros: Membro[] = [];
  let n = 0;
  const membro = (
    instituicaoId: string,
    nome: string,
    papel: Papel,
    gruposIds: string[],
    extra: Partial<Membro> = {},
  ): Membro => {
    n += 1;
    const m: Membro = {
      id: `m-${n}`,
      instituicaoId,
      utilizadorId: 1000 + n,
      nome,
      email: `${nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]+/g, ".")}@exemplo.ao`,
      papel,
      estado: "ativo",
      desde: iso(agora - (45 - (n % 30)) * DIA),
      ultimoAcesso: iso(agora - (n % 9) * DIA - (n % 5) * 60 * 60 * 1000),
      gruposIds,
      ...extra,
    };
    membros.push(m);
    return m;
  };

  // Escola 123: uma pessoa por papel para a demonstração + famílias geradas.
  membro("inst-1", "Ana Domingos", "administrador", []);
  membro("inst-1", "Paulo Neto", "coordenador", []);
  membro("inst-1", "Maria Kiala", "educador", ["g-1", "g-3"]);
  membro("inst-1", "João Mateus", "educador", ["g-2"]);
  n += 1; // m-5 fica reservado (era o antigo papel de observador): mantém os ids seguintes estáveis.
  membro("inst-1", "Kiesse Lopes", "aluno", ["g-1"]);
  membro("inst-1", "Isabel Cardoso", "educador", ["g-1"], { estado: "pendente", ultimoAcesso: null });

  const tutores: Membro[] = NOMES_TUTORES.map((nome, i) =>
    membro("inst-1", nome, "familia", [i < 7 ? "g-1" : i < 10 ? "g-2" : "g-3"]),
  );

  // Associação: a mesma administradora noutra instituição (pertença múltipla).
  membro("inst-2", "Ana Domingos", "educador", ["g-5"], { utilizadorId: 1001 });
  membro("inst-2", "Bernardo Sapalo", "administrador", []);
  membro("inst-2", "Graça Muteka", "familia", ["g-5"]);
  membro("inst-4", "Gaspar Tchindele", "administrador", []);

  // Perfis de alunos e vínculos com os tutores.
  const alunos: PerfilAluno[] = NOMES_ALUNOS.map((nome, i) => {
    const tutor = tutores[i % tutores.length];
    const grupoId = i < 8 ? "g-1" : i < 12 ? "g-2" : "g-3";
    const estado: PerfilAluno["estado"] = i === 13 ? "aguarda_consentimento" : i === 14 ? "consentimento_retirado" : "ativo";
    return {
      id: `a-${i + 1}`,
      instituicaoId: "inst-1",
      nome,
      grupoId,
      tutoresIds: estado === "aguarda_consentimento" ? [] : [tutor.id, ...(i === 0 ? [tutores[1].id] : [])],
      estado,
      criadoEm: iso(agora - (40 - i) * DIA),
    };
  });

  const consentimentos: Consentimento[] = [];
  let c = 0;
  for (const aluno of alunos) {
    for (const tutorId of aluno.tutoresIds) {
      const tutor = membros.find((m) => m.id === tutorId)!;
      const idx = Number(aluno.id.slice(2));
      const decisoes: [Consentimento["finalidade"], boolean][] = [
        ["utilizacao", aluno.estado !== "consentimento_retirado"],
        ["fotografias", idx % 3 !== 0],
        ["relatorios", idx % 4 !== 0],
        ["respostas_video", idx % 5 !== 0],
      ];
      for (const [finalidade, aceite] of decisoes) {
        c += 1;
        consentimentos.push({
          id: `c-${c}`,
          instituicaoId: "inst-1",
          alunoId: aluno.id,
          tutorId,
          tutorNome: tutor.nome,
          finalidade,
          aceite,
          versaoTexto: TEXTO_CONSENTIMENTO.versao,
          registadoEm: iso(agora - (35 - idx) * DIA),
          comApoio: idx % 5 === 0,
        });
      }
    }
  }

  const convites: Convite[] = [
    {
      id: "cv-1", instituicaoId: "inst-1", canal: "codigo", destino: "", codigo: "TURMA3A", papel: "familia",
      grupoId: "g-1", alunoId: null, usos: 7, usosMax: 30, criadoPor: "Maria Kiala",
      criadoEm: iso(agora - 5 * DIA), expiraEm: iso(agora + 9 * DIA), estado: "pendente",
    },
    {
      id: "cv-2", instituicaoId: "inst-1", canal: "email", destino: "isabel.cardoso@exemplo.ao", codigo: "K7Q2M9", papel: "educador",
      grupoId: "g-1", alunoId: null, usos: 0, usosMax: 1, criadoPor: "Ana Domingos",
      criadoEm: iso(agora - 2 * DIA), expiraEm: iso(agora + 12 * DIA), estado: "pendente",
    },
    {
      id: "cv-3", instituicaoId: "inst-1", canal: "sms", destino: "+244 923 000 111", codigo: "P4X8D2", papel: "familia",
      grupoId: "g-3", alunoId: "a-14", usos: 0, usosMax: 1, criadoPor: "Maria Kiala",
      criadoEm: iso(agora - 1 * DIA), expiraEm: iso(agora + 13 * DIA), estado: "pendente",
    },
    {
      id: "cv-4", instituicaoId: "inst-1", canal: "email", destino: "antigo.tutor@exemplo.ao", codigo: "Z9W1R4", papel: "familia",
      grupoId: "g-2", alunoId: null, usos: 0, usosMax: 1, criadoPor: "João Mateus",
      criadoEm: iso(agora - 20 * DIA), expiraEm: iso(agora - 6 * DIA), estado: "expirado",
    },
    {
      id: "cv-5", instituicaoId: "inst-2", canal: "codigo", destino: "", codigo: "MAOS2026", papel: "familia",
      grupoId: "g-5", alunoId: null, usos: 3, usosMax: 50, criadoPor: "Bernardo Sapalo",
      criadoEm: iso(agora - 10 * DIA), expiraEm: iso(agora + 4 * DIA), estado: "pendente",
    },
  ];

  const pedidosAdesao: PedidoAdesao[] = [
    { id: "pa-1", instituicaoId: "inst-1", conviteId: "cv-1", nome: "Manuel Kalandula", email: "manuel.k@exemplo.ao", papel: "familia", grupoId: "g-1", pedidoEm: iso(agora - 6 * 60 * 60 * 1000), estado: "pendente" },
    { id: "pa-2", instituicaoId: "inst-1", conviteId: "cv-1", nome: "Rita Jamba", email: "rita.jamba@exemplo.ao", papel: "familia", grupoId: "g-1", pedidoEm: iso(agora - 26 * 60 * 60 * 1000), estado: "pendente" },
  ];

  const avisos: Aviso[] = [
    {
      id: "av-1", instituicaoId: "inst-1", titulo: "Reunião de pais — 1.º trimestre",
      mensagem: "Convidamos todas as famílias para a reunião do 1.º trimestre. Vamos apresentar o plano do ano e as atividades em Língua Gestual Angolana.",
      destinatarios: { tipo: "instituicao" }, autor: "Ana Domingos", autorId: "m-1", publicadoEm: iso(agora - 3 * DIA),
      pedirConfirmacao: true, anexosIds: ["f-1"], recebidos: 0, lidos: 0, confirmados: 0, lidoPorMim: false, confirmadoPorMim: false,
    },
    {
      id: "av-2", instituicaoId: "inst-1", titulo: "Visita ao Museu de Antropologia",
      mensagem: "Na próxima sexta-feira a 3.ª Classe A visita o museu. Tragam lanche e a autorização assinada.",
      destinatarios: { tipo: "grupo", grupoId: "g-1" }, autor: "Maria Kiala", autorId: "m-3", publicadoEm: iso(agora - 1 * DIA),
      pedirConfirmacao: true, anexosIds: [], recebidos: 0, lidos: 0, confirmados: 0, lidoPorMim: false, confirmadoPorMim: false,
    },
    {
      id: "av-3", instituicaoId: "inst-1", titulo: "Novos vídeos de LGA na biblioteca",
      mensagem: "Já estão disponíveis 12 novos vídeos com o alfabeto e os números em Língua Gestual Angolana.",
      destinatarios: { tipo: "grupo", grupoId: "g-3" }, autor: "Maria Kiala", autorId: "m-3", publicadoEm: iso(agora - 8 * DIA),
      pedirConfirmacao: false, anexosIds: [], recebidos: 0, lidos: 0, confirmados: 0, lidoPorMim: false, confirmadoPorMim: false,
    },
    {
      id: "av-4", instituicaoId: "inst-2", titulo: "Bem-vindos à associação no EYK",
      mensagem: "A partir de agora os avisos da associação chegam por aqui.",
      destinatarios: { tipo: "instituicao" }, autor: "Bernardo Sapalo", autorId: "m-21", publicadoEm: iso(agora - 9 * DIA),
      pedirConfirmacao: false, anexosIds: [], recebidos: 0, lidos: 0, confirmados: 0, lidoPorMim: false, confirmadoPorMim: false,
    },
  ];

  // Leituras de demonstração: parte das famílias já leu.
  const familias1 = tutores.map((t) => t.id);
  const leituras: EstadoDemo["leituras"] = {
    "av-1": { lidos: familias1.slice(0, 9), confirmados: familias1.slice(0, 6) },
    "av-2": { lidos: familias1.slice(0, 4), confirmados: familias1.slice(0, 2) },
    "av-3": { lidos: familias1.slice(10), confirmados: [] },
    "av-4": { lidos: [], confirmados: [] },
  };

  const proximo = (dias: number, hora: number) => {
    const d = new Date(agora + dias * DIA);
    d.setHours(hora, 0, 0, 0);
    return d.getTime();
  };

  const eventos: Evento[] = [
    {
      id: "ev-1", instituicaoId: "inst-1", titulo: "Reunião de pais — 1.º trimestre", descricao: "Apresentação do plano do ano.",
      inicio: iso(proximo(4, 17)), fim: iso(proximo(4, 18) + 30 * 60 * 1000), local: "Sala polivalente", ligacao: "",
      destinatarios: { tipo: "instituicao" }, recorrencia: "nenhuma", lembretes: ["1d", "1h"], cancelado: false,
      criadoPor: "Ana Domingos", presencas: { vou: 0, nao_vou: 0, talvez: 0 }, minhaResposta: null,
    },
    {
      id: "ev-2", instituicaoId: "inst-1", titulo: "Visita ao Museu de Antropologia", descricao: "Saída às 8h30 da escola.",
      inicio: iso(proximo(2, 8)), fim: iso(proximo(2, 12)), local: "Museu Nacional de Antropologia", ligacao: "",
      destinatarios: { tipo: "grupo", grupoId: "g-1" }, recorrencia: "nenhuma", lembretes: ["1d"], cancelado: false,
      criadoPor: "Maria Kiala", presencas: { vou: 0, nao_vou: 0, talvez: 0 }, minhaResposta: null,
    },
    {
      id: "ev-3", instituicaoId: "inst-1", titulo: "Sessão de Língua Gestual para famílias", descricao: "Aprender gestos do dia a dia.",
      inicio: iso(proximo(1, 15)), fim: iso(proximo(1, 16)), local: "", ligacao: "https://meet.exemplo.ao/lga-familias",
      destinatarios: { tipo: "grupo", grupoId: "g-3" }, recorrencia: "semanal", lembretes: ["1h"], cancelado: false,
      criadoPor: "Maria Kiala", presencas: { vou: 0, nao_vou: 0, talvez: 0 }, minhaResposta: null,
    },
    {
      id: "ev-4", instituicaoId: "inst-1", titulo: "Entrega das fichas de avaliação", descricao: "Prazo para os educadores.",
      inicio: iso(proximo(9, 12)), fim: iso(proximo(9, 12)), local: "", ligacao: "",
      destinatarios: { tipo: "instituicao" }, recorrencia: "nenhuma", lembretes: ["1d"], cancelado: true,
      criadoPor: "Ana Domingos", presencas: { vou: 0, nao_vou: 0, talvez: 0 }, minhaResposta: null,
    },
  ];
  const respostas: EstadoDemo["respostas"] = {
    "ev-1": Object.fromEntries(familias1.slice(0, 8).map((id, i) => [id, i % 4 === 3 ? "talvez" : "vou"])),
    "ev-2": Object.fromEntries(familias1.slice(0, 5).map((id, i) => [id, i === 4 ? "nao_vou" : "vou"])),
    "ev-3": {},
    "ev-4": {},
  };

  const MB = 1024 * 1024;
  const ficheiros: FicheiroInstituicao[] = [
    { id: "f-1", instituicaoId: "inst-1", nome: "Plano anual 2026-2027.pdf", categoria: "documento", tamanhoBytes: 2.4 * MB, visibilidade: { tipo: "instituicao" }, temCriancas: false, estado: "disponivel", carregadoPor: "Ana Domingos", carregadoEm: iso(agora - 3 * DIA) },
    { id: "f-2", instituicaoId: "inst-1", nome: "Fotos — Dia da Cultura.zip", categoria: "imagem", tamanhoBytes: 48 * MB, visibilidade: { tipo: "grupo", grupoId: "g-1" }, temCriancas: true, estado: "disponivel", carregadoPor: "Maria Kiala", carregadoEm: iso(agora - 12 * DIA) },
    { id: "f-3", instituicaoId: "inst-1", nome: "Canção do alfabeto em LGA.mp4", categoria: "video", tamanhoBytes: 86 * MB, visibilidade: { tipo: "grupo", grupoId: "g-3" }, temCriancas: false, estado: "disponivel", carregadoPor: "Maria Kiala", carregadoEm: iso(agora - 8 * DIA) },
    { id: "f-4", instituicaoId: "inst-1", nome: "Ficha de leitura — semana 6.docx", categoria: "documento", tamanhoBytes: 0.3 * MB, visibilidade: { tipo: "grupo", grupoId: "g-2" }, temCriancas: false, estado: "a_verificar", carregadoPor: "João Mateus", carregadoEm: iso(agora - 20 * 60 * 1000) },
    { id: "f-5", instituicaoId: "inst-1", nome: "Gravação da história contada.m4a", categoria: "audio", tamanhoBytes: 7.5 * MB, visibilidade: { tipo: "grupo", grupoId: "g-1" }, temCriancas: false, estado: "disponivel", carregadoPor: "Maria Kiala", carregadoEm: iso(agora - 15 * DIA) },
  ];

  const auditoria: RegistoAuditoria[] = [
    { id: "au-1", instituicaoId: "inst-1", quando: iso(agora - 60 * DIA), quem: "Equipa EYK", origem: "equipa_eyk", acao: "instituicao_criada", detalhe: "Espaço criado depois da assinatura do acordo de parceria." },
    { id: "au-2", instituicaoId: "inst-1", quando: iso(agora - 59 * DIA), quem: "Ana Domingos", origem: "instituicao", acao: "membro_adicionado", detalhe: "Ana Domingos aceitou o convite como Administrador." },
    { id: "au-3", instituicaoId: "inst-1", quando: iso(agora - 50 * DIA), quem: "Ana Domingos", origem: "instituicao", acao: "grupo_criado", detalhe: "Grupo «3.ª Classe A» criado." },
    { id: "au-4", instituicaoId: "inst-1", quando: iso(agora - 30 * DIA), quem: "Ana Domingos", origem: "instituicao", acao: "papel_alterado", detalhe: "Paulo Neto: Educador → Coordenador." },
    { id: "au-5", instituicaoId: "inst-1", quando: iso(agora - 12 * DIA), quem: "Maria Kiala", origem: "instituicao", acao: "ficheiro_carregado", detalhe: "«Fotos — Dia da Cultura.zip» (com crianças) para 3.ª Classe A." },
    { id: "au-6", instituicaoId: "inst-1", quando: iso(agora - 9 * DIA), quem: "Esperança (tutor: Celeste Fortunato)", origem: "instituicao", acao: "consentimento_alterado", detalhe: "Utilização da plataforma: retirado. A criança saiu dos relatórios." },
    { id: "au-7", instituicaoId: "inst-1", quando: iso(agora - 4 * DIA), quem: "Equipa EYK (suporte)", origem: "equipa_eyk", acao: "acesso_equipa_eyk", detalhe: "Consulta das definições a pedido da administração (pedido de apoio n.º 14)." },
    { id: "au-8", instituicaoId: "inst-1", quando: iso(agora - 3 * DIA), quem: "Ana Domingos", origem: "instituicao", acao: "aviso_publicado", detalhe: "«Reunião de pais — 1.º trimestre» para toda a instituição." },
  ];

  const pedidosDados: PedidoDados[] = [
    { id: "pd-1", instituicaoId: "inst-1", tipo: "exportacao", ambito: "familia", alvo: "Família de Ndalu (Joana Cassoma)", pedidoPor: "Joana Cassoma", pedidoEm: iso(agora - 5 * DIA), estado: "concluido", prazo: iso(agora + 25 * DIA), ficheiroPronto: true },
    { id: "pd-2", instituicaoId: "inst-1", tipo: "eliminacao", ambito: "crianca", alvo: "Esperança", pedidoPor: "Celeste Fortunato", pedidoEm: iso(agora - 2 * DIA), estado: "em_curso", prazo: iso(agora + 28 * DIA), ficheiroPronto: false, nota: "Exportação enviada à família antes da eliminação." },
  ];

  return {
    instituicoes,
    membros,
    convites,
    pedidosAdesao,
    grupos,
    alunos,
    avisos,
    leituras,
    eventos,
    respostas,
    ficheiros,
    consentimentos,
    auditoria,
    pedidosDados,
    preferencias: {},
    ...criarDemoLga(agora, { membros, alunos, convites, grupos }),
    seq: 1000,
  };
}
