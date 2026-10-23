# Área "Instituição" — frontend (piloto)

Implementação no frontend das funcionalidades **1 a 13** (piloto) de
[`EYK — Funcionalidades para parcerias e instituições.md`](./EYK%20—%20Funcionalidades%20para%20parcerias%20e%20instituições.md).
As funcionalidades 14 a 20 (pós-piloto e escala) não estão incluídas, como o documento recomenda.

Por cima disso, o **ensino de LGA nas escolas** (ver [Ensino de LGA](#ensino-de-lga)): Turmas LGA com aulas
sinalizadas, respostas em vídeo dos alunos, gestuário validado e prática por competência — e a **escola ligada às
páginas principais** (Início, Cursos, Vídeos, Comunidade, Leaderboard, Gamificação, Biblioteca): o aluno vê o que a
escola publicou ao lado do catálogo público da EYK.

**O backend ainda não existe.** Tudo corre sobre dados de demonstração, no browser. Os ecrãs, as regras e a forma das
chamadas à API estão prontos para ligar à `eyk-api`.

## Ver a demonstração

1. `cd frontend && npm run dev` e entra com qualquer conta.
2. Na barra lateral, abre **Instituição**. Os membros da equipa (`isStaff`) vêem também **Administração → Instituições**.
3. No topo da área há uma faixa **Demonstração** com:
   - **Ver como:** muda a pessoa com que vês a instituição (administradora, coordenador, educadores,
     família, alunos). A Ana Domingos pertence a duas instituições com papéis diferentes — usa o seletor ao
     lado do papel. A pessoa escolhida vale também nas páginas principais (Início, Cursos, Comunidade…).
   - **Repor:** volta aos dados iniciais.
4. Para experimentar a adesão: **Instituição → Convites** (copia um código) ou abre `/instituicao/aderir` e usa
   `TURMA3A` (precisa de aprovação), `MAOS2026` ou `P4X8D2` (família ligada a uma criança, pede consentimento).
5. Para o ensino de LGA, sugestão de percurso:
   - **Kiesse Lopes** (aluno): Início → "Da tua escola" → grava a resposta da aula "Saudações"; depois Praticar.
   - **Maria Kiala** (educadora): Turmas LGA → LGA Iniciação — 3.ª Classe A → Respostas → corrige; Nova aula.
   - **Domingos Sapalo** (educador surdo): Gestuário → Por validar.
   - **Rosa Lopes** (família): vê as respostas e o feedback do Kiesse; Consentimentos.
   - **Wezo Sebastião** (aluno): a família não autorizou as respostas em vídeo — a gravação fica bloqueada.

Os dados ficam no `localStorage` do browser (`eyk-instituicoes-demo-v2`). Os vídeos gravados ou carregados ficam só em
memória e desaparecem ao recarregar a página (sem backend não há onde os guardar).

### Quando aparece

A área fica visível em desenvolvimento e, nos outros ambientes, só com `NEXT_PUBLIC_INSTITUICOES=1` no build do
frontend (`frontend/app/lib/instituicoes/ativo.ts`). Em produção está desligada por omissão, para não aparecer aos
utilizadores antes de existir backend. `NEXT_PUBLIC_INSTITUICOES=0` desliga-a também em desenvolvimento.

## Onde está cada coisa

| Caminho | O quê |
|---|---|
| `app/lib/instituicoes/tipos.ts` | Tipos de todas as entidades (instituição, membro, convite, grupo, aluno, aviso, evento, ficheiro, consentimento, relatório, auditoria, pedido de dados) |
| `app/lib/instituicoes/permissoes.ts` | O que cada papel pode fazer (`pode(papel, acao)`), regras puras e rótulos |
| `app/lib/instituicoes/api.ts` | A API da área (`apiInstituicoes`), hoje em memória, com as regras da especificação |
| `app/lib/instituicoes/demo.ts` | Dados de demonstração e o texto de consentimento |
| `app/lib/instituicoes/instituicoes.test.ts` | Testes das regras (vitest) |
| `app/lib/instituicoes/lga.ts` | API do ensino de LGA (`apiLga`): turmas, aulas, respostas, gestuário, prática, conteúdos, comunidade da turma, classificações, desafios |
| `app/lib/instituicoes/exercicios.ts` | Geração de exercícios e cálculo de mestria (funções puras) |
| `app/lib/instituicoes/demo-lga.ts` | Dados de demonstração do ensino de LGA |
| `app/lib/instituicoes/media-sessao.ts` | Vídeos gravados na demonstração (em memória) |
| `app/lib/instituicoes/lga.test.ts` | Testes das regras do ensino de LGA |
| `app/components/instituicao/lga.tsx`, `turma/*` | Vídeo, gestos, gravação, mestria; separadores da turma |
| `app/components/instituicao/escola.tsx` | A escola nas páginas principais |
| `app/components/instituicao/contexto.tsx` | Instituição atual, papel, "ver como" e o guarda `<Exige>` |
| `app/components/instituicao/ui.tsx` | Componentes partilhados (seletor, destinatários, etiquetas, tabelas, datas em hora de Angola) |
| `app/instituicao/…` | As páginas (ver abaixo) |
| `app/configuracoes/administracao/instituicoes/` | Painel interno da equipa EYK |

## Páginas

| Rota | Funcionalidade | Quem vê |
|---|---|---|
| `/instituicao` | Painel adaptado ao papel; seletor de instituição (1) | Todos |
| `/instituicao/membros` | Membros e papéis (2) | Administrador, coordenador, educador (só os seus grupos) |
| `/instituicao/convites` | Convites por email, SMS ou código; aprovação de pedidos (3) | Administrador, educador (famílias e alunos dos seus grupos) |
| `/instituicao/aderir` | Aderir com um código, com consentimento para famílias (3, 9) | Qualquer utilizador autenticado |
| `/instituicao/grupos`, `/instituicao/grupos/[id]` | Turmas e grupos; arquivo no fim do ano (4) | Administrador, coordenador, educador |
| `/instituicao/alunos` | Perfis de crianças e vínculos com tutores (5) | Administrador, coordenador, educador; família vê só as suas |
| `/instituicao/avisos` | Avisos, "li e confirmo", preferências de aviso (6) | Todos |
| `/instituicao/agenda` | Calendário, presenças, repetição, lembretes (7) | Todos |
| `/instituicao/ficheiros` | Ficheiros com visibilidade, quota e verificação (8) | Todos |
| `/instituicao/consentimentos` | Família decide por finalidade; administração vê o registo (9) | Família, administrador |
| `/instituicao/relatorios` | Relatório básico agregado (10) | Administrador, coordenador |
| `/instituicao/auditoria` | Registo de ações sensíveis (11) | Administrador |
| `/instituicao/dados` | Pedidos de exportação e eliminação (12) | Administrador, família |
| `/instituicao/definicoes` | Aprovação por código, canais de aviso, quotas (leitura) | Administrador |
| `/configuracoes/administracao/instituicoes` | Criar, ativar, suspender, encerrar, quotas, auditoria (13) | Equipa EYK (`isStaff`) |

## Regras aplicadas (e que o backend tem de aplicar também)

O frontend só esconde o que o papel não permite; a `eyk-api` tem de verificar o papel e a instituição em cada pedido.
As regras estão em `api.ts` e cobertas por testes:

- Nenhum dado de uma instituição é visível a outra; instituição suspensa ou encerrada bloqueia o acesso sem apagar dados.
- A instituição tem sempre pelo menos um administrador (mudar papel ou remover é recusado).
- Educadores só vêem e convidam para os seus grupos, e só convidam famílias e alunos; só a administração escreve para
  toda a instituição.
- Convites expiram (14 dias por omissão), podem ser cancelados e os códigos têm um máximo de utilizações; com
  "aprovar pedidos por código" ligado, quem adere por código fica pendente.
- **Consentimento antes do perfil:** o perfil da criança nasce "à espera de consentimento" e só fica ativo quando um
  tutor aceita a finalidade "utilização". Retirar esse consentimento tira a criança dos relatórios e inativa o perfil.
  Os consentimentos guardam quem, o quê, quando, a versão do texto e se houve apoio presencial; nunca se editam.
- Ficheiros com crianças só são aceites se todas as crianças do destino tiverem consentimento para fotografias; tipo,
  tamanho por ficheiro e quota de armazenamento são validados; ficam "a verificar" antes de ficarem disponíveis.
- O autor de um aviso vê contagens de leitura e confirmação, nunca a lista de quem não leu.
- Relatórios só por instituição e por grupo; grupos com menos de 5 pessoas não mostram detalhe; crianças sem
  consentimento para relatórios não contam. "Utilizador ativo" = pelo menos um acesso nos últimos 30 dias.
- A auditoria regista automaticamente as ações sensíveis; o acesso da equipa EYK exige motivo e também fica registado.
- Datas e horas mostradas e introduzidas em hora de Angola (`Africa/Luanda`).

## Ensino de LGA

### Turmas LGA

Uma Turma LGA é um grupo do tipo `turma_lga` com **público** (alunos surdos com LGA como primeira língua, ouvintes,
famílias ou professores em formação) e **nível** (iniciação, intermédio, avançado). Por ser um grupo, recebe avisos,
eventos, ficheiros e convites como qualquer outro. Ao abrir a turma geram-se os **códigos de entrada** (alunos e/ou
famílias, conforme o público), válidos até ao fim do ano letivo, com botão para imprimir e entregar em papel.

| Rota | O quê | Quem vê |
|---|---|---|
| `/instituicao/turmas` | As Turmas LGA; abrir turma | Todos (cada um vê as suas) |
| `/instituicao/turmas/[id]` | Separadores: Aulas, Respostas, Progresso, Comunidade, Classificação, Pessoas e códigos | Membros da turma; administração e coordenação |
| `/instituicao/turmas/[id]/aulas/[aulaId]` | Vídeo sinalizado, gestos da aula, recursos, conteúdo atribuído; gravar e corrigir respostas | Membros da turma |
| `/instituicao/gestuario` | Gestos por tema e variante regional; propor e validar | Todos |
| `/instituicao/praticar` | Exercícios por competência, mestria, desafios | Alunos, famílias, educadores, coordenação, administração |
| `/instituicao/conteudos`, `/instituicao/conteudos/[id]` | Cursos e vídeos publicados só para a escola ou uma turma; propor ao catálogo público | Membros (conforme o âmbito) |

Quem ensina LGA é o **Educador** (de preferência surdo): ensina nas turmas, corrige respostas e valida gestos. (Os papéis
"Formador de LGA" e "Observador" foram removidos: as funcionalidades passaram para o Educador e para a Administração.)

### Regras do ensino de LGA (cobertas por `lga.test.ts`)

- **Aulas:** só quem ensina na turma (educador membro dela) ou a administração publica. Uma aula
  sinalizada exige o vídeo; uma atribuição exige o curso ou vídeo (da escola ou do catálogo público).
- **Respostas em vídeo:** só as vêem quem ensina na turma, o próprio aluno e a sua família — **não** a administração
  nem a coordenação. Enviar exige o consentimento novo **"Respostas em vídeo nas aulas de LGA"** (texto versão
  2026-10.2) quando o aluno é uma criança com perfil. Até 90 segundos. Não se reenvia enquanto espera correção; depois
  de "repetir", conta como nova tentativa. "Repetir" exige comentário. Apagadas no fim do ano letivo (31 de julho).
- **Gestuário:** os gestos propostos só são vistos por quem os propôs e por quem valida; **quem propõe não valida o
  próprio gesto**; rejeitar exige uma nota. Os validados passam a todos e à Biblioteca LGA.
- **Prática:** a mestria de cada competência é a percentagem de acertos nas últimas 10 respostas; "dominado" exige
  80% com 10 respostas. Os exercícios nunca mostram duas opções com a mesma representação.
- **Conteúdos da escola:** âmbito `instituicao` (toda a escola) ou `turma`; fora do âmbito não aparecem nem abrem. Só se
  publica para turmas onde se ensina. Publicar para a escola não precisa de aprovação da EYK; ir para o catálogo
  público é uma proposta revista pela equipa EYK.
- **Comunidade da turma:** só membros da turma; famílias lêem mas não publicam; alunos não publicam links; quem ensina
  esconde publicações; uma denúncia esconde a publicação até ser revista.
- **Classificações e desafios:** só o primeiro nome; a escola pode desligar as classificações; cada desafio dá a
  recompensa uma única vez.

### A escola nas páginas principais

Com a área ativa e uma escola, as páginas principais mostram o que é da escola; sem escola ficam exatamente como antes.

| Página | O que acrescenta |
|---|---|
| Início | "Da tua escola": trabalhos de LGA por fazer ou a repetir, feedback novo, respostas por corrigir (professores), aulas novas, avisos, próximo evento, desafio |
| Cursos, Vídeos | Separadores "Todos · Da minha escola · Públicos"; os conteúdos da escola com a etiqueta da escola ou da turma |
| Comunidade | Um separador por Turma LGA. Se a escola desligou a comunidade pública para alunos, os alunos só vêem a da turma |
| Leaderboard | "Nacional · A minha escola · cada turma" (moedas ganhas na escola) |
| Gamificação | Desafios da escola e das turmas |
| Biblioteca LGA | Gestuário validado: números, frases e contributos das escolas, com variantes regionais |

As moedas da escola (prática, respostas certas, desafios) estão, na demonstração, numa conta à parte; com o backend,
devem entrar na carteira única do aluno.

## Quem cria o quê

| Quem | O quê | Onde |
|---|---|---|
| Equipa EYK (`isStaff`) | Cria as escolas e instituições; o responsável recebe o convite de administrador. Ativa, suspende, ajusta quotas. Aprova o que as escolas querem publicar na plataforma geral | Administração → Escolas e instituições |
| Administração da escola | Abre Turmas LGA e põe nelas os professores que lecionam e os alunos (Turma → Pessoas e códigos → Adicionar à turma), ou entrega os códigos | A minha escola → Turmas LGA |
| Educador | Publica cursos e vídeos para as suas turmas ou para toda a escola, sem aprovação; se quiser, marca "Publicar também na plataforma geral" (aprovado pela equipa EYK) | A minha escola → Cursos e vídeos da escola |
| Aluno de uma escola | Vê só o que a escola publicou. Pode escolher "Ver também a plataforma geral" a qualquer momento (barra no topo de Início, Cursos, Vídeos, Comunidade e Leaderboard) | — |

A escolha do aluno é por pessoa e fica guardada; os outros papéis vêem sempre a plataforma geral. Se a escola desligou a
Comunidade pública para alunos, essa definição prevalece.

## Navegação por papel

Com a área ativa, o contexto da escola é montado para toda a app (`components/providers.tsx` → `EscolaGlobal`), e a
barra lateral e o menu de baixo mostram as funcionalidades do papel atual (`lib/instituicoes/navegacao.ts`, com testes).

| Papel | Barra lateral — "A minha escola" | Abas do telemóvel |
|---|---|---|
| Aluno | As minhas turmas, Praticar LGA, Gestuário, Avisos, Agenda, Ficheiros | Início, Turmas, Praticar, Comunidade |
| Família | As minhas crianças, Turmas LGA, Praticar, Avisos, Agenda, Consentimentos, Os meus dados | Início, Crianças, Avisos, Agenda |
| Educador | As minhas turmas, Respostas por rever, Cursos e vídeos da escola, Gestuário, Alunos, Avisos, Agenda, Ficheiros, Convites | Início, Turmas, Respostas, Conteúdos |
| Coordenação | Turmas LGA, Gestuário (validar), Relatórios, Alunos, Membros, Avisos, Agenda | Início, Turmas, Gestuário, Relatórios |
| Administração da escola | Painel da escola, Turmas LGA, Membros, Convites, Cursos e vídeos, Avisos, Relatórios, Definições | Início, Escola, Turmas, Membros |
| Sem escola | "Entrar numa escola" (código) | Início, Cursos, Vídeos, Comunidade (como antes) |

O que não cabe nas abas fica no painel "Mais", agrupado em "escola", "Plataforma EYK" e o resto. Os números ao lado
(respostas por rever, trabalhos por fazer, avisos por ler) atualizam-se ao mudar de página e depois de corrigir uma
resposta.

**Cada funcionalidade fica num só lugar:** os separadores no topo da página `/instituicao` mostram só as secções que
não estão no menu desse papel (`urlsNoMenu` em `navegacao.ts`). Ex: o aluno tem Turmas, Praticar, Gestuário, Avisos,
Agenda e Ficheiros no menu, e na página fica só Painel e Conteúdos; a administração tem na página Praticar, Gestuário,
Agenda, Ficheiros, Grupos, Alunos, Consentimentos, Auditoria e Os meus dados.

## Ligar ao backend

Cada função de `apiInstituicoes` corresponde a um endpoint (o comentário de algumas indica o caminho sugerido, ex:
`GET /api/instituicoes/minhas/`). Para ligar:

1. Criar os endpoints na `eyk-api` com os mesmos campos dos tipos de `tipos.ts`.
2. Em `api.ts`, trocar o corpo de cada função por uma chamada a `request()` de `@/lib/api` — as páginas não mudam.
3. Remover `demo.ts`, `PESSOAS_DEMO`/`definirPessoaDemo` e a `FaixaDemo` do layout (a pessoa passa a ser a da sessão).
4. Mover para o `agendador` o que hoje é simulado no browser: expirar convites, lembretes de eventos, relatório
   periódico, verificação de ficheiros, apagar as respostas em vídeo no fim do ano letivo.
5. Para a escola nas páginas principais: acrescentar o **âmbito** (público, instituição ou turma) aos modelos `Curso`,
   `Video` e `Post` do Django, com os existentes como públicos, e filtrar **todas** as listas e páginas de detalhe pelas
   pertenças do utilizador. É o ponto mais sensível: um endpoint esquecido mostra conteúdo da escola a toda a gente.
6. Vídeos (aulas, respostas, gestos) para o armazenamento (R2), com compressão no telemóvel antes de enviar.

## Fica para depois

- Envio real de emails e SMS (convites, avisos, lembretes) — hoje só se simula.
- Guardar os vídeos (hoje ficam em memória durante a visita).
- Vídeos reais no gestuário: os gestos de demonstração usam emoji animado no lugar do vídeo.
- "LGA em casa" automático (a turma "LGA em casa — famílias" existe, mas a seleção semanal dos gestos é manual) e
  certificado de conclusão das turmas.
- Descarregar ficheiros e exportações (a demonstração só verifica a permissão).
- Presenças por ocorrência em eventos que se repetem (hoje a resposta vale para a série).
- Textos de consentimento revistos por jurista e versões noutras línguas; prazo de conservação da auditoria.
- Funcionalidades 14 a 20.
