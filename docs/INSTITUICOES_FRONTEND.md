# Área "Instituição" — frontend (piloto)

Implementação no frontend das funcionalidades **1 a 13** (piloto) de
[`EYK — Funcionalidades para parcerias e instituições.md`](./EYK%20—%20Funcionalidades%20para%20parcerias%20e%20instituições.md).
As funcionalidades 14 a 20 (pós-piloto e escala) não estão incluídas, como o documento recomenda.

**O backend ainda não existe.** Tudo corre sobre dados de demonstração, no browser. Os ecrãs, as regras e a forma das
chamadas à API estão prontos para ligar à `eyk-api`.

## Ver a demonstração

1. `cd frontend && npm run dev` e entra com qualquer conta.
2. Na barra lateral, abre **Instituição**. Os membros da equipa (`isStaff`) vêem também **Administração → Instituições**.
3. No topo da área há uma faixa **Demonstração** com:
   - **Ver como:** muda a pessoa com que vês a instituição (administradora, coordenador, educadora, família, aluno,
     observador). A Ana Domingos pertence a duas instituições com papéis diferentes — usa o seletor ao lado do papel.
   - **Repor:** volta aos dados iniciais.
4. Para experimentar a adesão: **Instituição → Convites** (copia um código) ou abre `/instituicao/aderir` e usa
   `TURMA3A` (precisa de aprovação), `MAOS2026` ou `P4X8D2` (família ligada a uma criança, pede consentimento).

Os dados ficam no `localStorage` do browser (`eyk-instituicoes-demo-v1`).

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
| `/instituicao/avisos` | Avisos, "li e confirmo", preferências de aviso (6) | Todos menos observador |
| `/instituicao/agenda` | Calendário, presenças, repetição, lembretes (7) | Todos menos observador |
| `/instituicao/ficheiros` | Ficheiros com visibilidade, quota e verificação (8) | Todos menos observador |
| `/instituicao/consentimentos` | Família decide por finalidade; administração vê o registo (9) | Família, administrador |
| `/instituicao/relatorios` | Relatório básico agregado (10) | Administrador, coordenador, observador |
| `/instituicao/auditoria` | Registo de ações sensíveis (11) | Administrador |
| `/instituicao/dados` | Pedidos de exportação e eliminação (12) | Administrador, família |
| `/instituicao/definicoes` | Aprovação por código, canais de aviso, quotas (leitura) | Administrador |
| `/configuracoes/administracao/instituicoes` | Criar, ativar, suspender, encerrar, quotas, auditoria (13) | Equipa EYK (`isStaff`) |

## Regras aplicadas (e que o backend tem de aplicar também)

O frontend só esconde o que o papel não permite; a `eyk-api` tem de verificar o papel e a instituição em cada pedido.
As regras estão em `api.ts` e cobertas por testes:

- Nenhum dado de uma instituição é visível a outra; instituição suspensa ou encerrada bloqueia o acesso sem apagar dados.
- A instituição tem sempre pelo menos um administrador (mudar papel ou remover é recusado).
- Observadores nunca recebem dados pessoais (membros, alunos).
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

## Ligar ao backend

Cada função de `apiInstituicoes` corresponde a um endpoint (o comentário de algumas indica o caminho sugerido, ex:
`GET /api/instituicoes/minhas/`). Para ligar:

1. Criar os endpoints na `eyk-api` com os mesmos campos dos tipos de `tipos.ts`.
2. Em `api.ts`, trocar o corpo de cada função por uma chamada a `request()` de `@/lib/api` — as páginas não mudam.
3. Remover `demo.ts`, `PESSOAS_DEMO`/`definirPessoaDemo` e a `FaixaDemo` do layout (a pessoa passa a ser a da sessão).
4. Mover para o `agendador` o que hoje é simulado no browser: expirar convites, lembretes de eventos, relatório
   periódico, verificação de ficheiros.

## Fica para depois

- Envio real de emails e SMS (convites, avisos, lembretes) — hoje só se simula.
- Descarregar ficheiros e exportações (a demonstração só verifica a permissão).
- Presenças por ocorrência em eventos que se repetem (hoje a resposta vale para a série).
- Textos de consentimento revistos por jurista e versões noutras línguas; prazo de conservação da auditoria.
- Funcionalidades 14 a 20.
