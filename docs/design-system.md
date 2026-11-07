# Design System EYK

A fonte de verdade de como a plataforma se vê e se comporta. Antes de criar uma página
ou um componente, segue estas regras; se uma regra não chegar, acrescenta-a aqui primeiro.

- **Tokens** (cores, raios, sombras, tipos de letra): `frontend/app/globals.css`
- **Componentes base**: `frontend/app/components/ui/*` (botões, cartões, modais, separadores…)
- **Componentes do Design System**: `frontend/app/components/ds/*` (regras da EYK já aplicadas)
- **Padrões de página**: `frontend/app/components/eyk/*` (PageHeader, StatCard, cartões de curso/vídeo/post)

---

## 1. Princípios

1. **Acessível primeiro.** A plataforma é para surdos e ouvintes: tudo o que se diz por texto
   deve poder ser dito também por ícone/gesto de LGA (ver `docs/lga-icones-palavras.md`).
   Contraste mínimo AA, foco visível, alvos de toque ≥ 44px no ecrã táctil.
2. **Calmo e claro.** Fundo branco/creme, dourado só para o que importa (ação principal, estado ativo).
3. **Uma coisa num só lugar.** O que está no menu não se repete na página, e vice-versa.
4. **Telemóvel primeiro.** Desenha para 390px; depois tablet; depois computador.

## 2. Tokens

### Cores (semânticas — nunca escrever cores à mão nos componentes)

| Token | Uso |
|---|---|
| `background` / `foreground` | Fundo da página e texto principal |
| `surface`, `surface-elevated` | Fundos de campos, chips e zonas destacadas |
| `card` | Cartões |
| `primary` (dourado) | Ação principal, item ativo, ícones de destaque |
| `secondary`, `muted`, `muted-foreground` | Elementos secundários e texto de apoio |
| `accent` | Hover suave |
| `success`, `destructive`, `streak` | Sucesso, erro/perigo, streak (fogo) |
| `warning`, `info` | Atenção (limites, avisos) e informação (papel de coordenador) |
| `border`, `input`, `ring` | Bordas, campos e foco |
| `sidebar-*` | Barra lateral: a mesma cor e a mesma borda fina dos cartões (`card`, `border`) |

Gradiente de marca: `bg-gradient-gold` (botões principais, avatares sem foto, medalhas).
Tema escuro: os mesmos tokens redefinidos em `.dark` — nunca usar `dark:` com cores à mão
exceto para bordas/realces descritos abaixo.

### Tipografia

- **Títulos**: `font-serif` (Fraunces). H1 de página `text-3xl sm:text-4xl` (via `PageHeader`).
- **Texto**: `font-sans` (Inter). Corpo `text-sm`/`text-base`; apoio `text-xs text-muted-foreground`.
- Tamanho do texto ajustável pela pessoa (Configurações → Aparência): usar sempre `rem`.

### Raios, sombras e espaços

- Raio base `--radius` (14px). Cartões `rounded-2xl`, campos e chips `rounded-full`, modais `rounded-xl`.
- Sombras: `shadow-soft` (cartões), `shadow-elevated` (hover, menus, modais), `shadow-gold` (ação principal).
- Espaçamento entre secções de página `space-y-8`; dentro de cartões `p-4`/`p-5`.

## 3. Ecrãs e navegação

| Variante | Quando | Navegação |
|---|---|---|
| `movel:` | telemóvel e tablet (até 1023px, ou ecrã táctil até 1366px) | menu de baixo + painel "Mais" |
| `computador:` | ≥ 1024px com rato, ou ≥ 1367px | barra lateral |

- **Barra lateral**: logótipo de 48px, igual nos dois estados e alinhado com os ícones; grupos por papel, com a **Administração em primeiro** para a equipa EYK, que entra em Métricas; "Configurações" em penúltimo;
  rodapé com o ícone de perfil (leva ao perfil, sem menu) e "Sair" à direita. Recolhida (72px) só com os ícones; abre ao
  passar o cursor e empurra o conteúdo, sem ficar por cima dele. Como no Instagram, **os ícones têm o
  mesmo tamanho (22px) e o mesmo lugar nos dois estados**: só o texto aparece ou desaparece.
- **Menu de baixo**: 4 abas + "Mais", **pela mesma ordem e nos mesmos grupos da barra lateral**: as 4 primeiras
  entradas são as abas e o resto fica no "Mais" (função `repartirAbas`). Equipa EYK: as abas são Métricas, Escolas,
  Moderação e Plataforma; professor: Painel, Meus Cursos, Meus Vídeos e Início. "Configurações" logo antes de "Sair".
- **Barra do topo** da app: logótipo (só `movel:`), pesquisa da página (só `computador:`), chips de
  moedas e streak, sino com pré-visualização e ícone de perfil, cujo menu abre ao passar
  o cursor (no ecrã táctil, com um toque). **Página pública (landing): barra opaca.**

## 4. Regras de componentes

### Pesquisa (`components/pesquisa-pagina.tsx`)
- **Computador**: o campo está só na barra do topo. **Telemóvel/tablet**: só dentro da página.
- O texto de ajuda diz o que se pesquisa naquela página (ex.: Vídeos → "Pesquisar vídeos ou professores…").
- Início: pesquisa **geral** (cursos, vídeos, professores) com resultados por baixo. **Enter** ou
  "Ver todos os resultados" abre a página **Pesquisa** (`/pesquisa?q=`): tudo o que se relaciona com o termo
  (cursos, vídeos, publicações, pessoas e, para membros, os conteúdos da escola), com um separador por tipo e
  os filtros de cada tipo (os mesmos `BarraFiltros` dos Cursos e Vídeos).
  Restantes páginas: pesquisa **da página** (filtra a lista, via `?q=` no endereço).
- Páginas sem pesquisa: Configurações, Leaderboard, Gamificação, Notificações, Perfil.
- Para dar pesquisa a uma página nova: acrescentar a rota em `PAGINAS` e usar
  `usePesquisaPagina()` + `<CampoPesquisaPagina className="computador:hidden" />`.

### Chips (`components/ds/chip.tsx`)
- Pílula pequena com ícone + valor (moedas, streak, "Instalar app").
- **Tema claro: sem borda nem sombra**, só `bg-surface`. Tema escuro: borda fina.

### Separadores em páginas com vários tipos de conteúdo (`components/ds/secoes-moveis.tsx`)
- **Telemóvel/tablet**: cada tipo de elemento no seu separador (nada misturado num scroll enorme).
- **Computador**: tudo visível, uma secção por baixo da outra.
- Aplicado em: Perfil e Gamificação.
- A Leaderboard usa separadores em **todos** os ecrãs, porque são vistas alternativas da mesma
  lista (Classificação / Streak / Moedas / Professores).
- **O Início é a Comunidade** (`components/comunidade/feed.tsx`): compositor, publicações por ordem aleatória
  (antigas e recentes, para quem entra não sentir que perdeu nada) e, pelo meio, faixas de 4 cursos ou 4 vídeos.
  Sem separadores. O catálogo completo, com filtros, está em Cursos e Vídeos. `/comunidade` leva ao Início
  (links antigos). No menu, o lugar da Comunidade é dos **Salvos**.
- Coluna lateral do Início (só no computador), como nas redes sociais: **Em destaque** (publicações, um curso
  e um vídeo), **Professores para seguir** e **No topo da classificação**. Cada bloco desaparece se estiver vazio.
- Cursos e Vídeos não dizem "x encontrados": a lista fala por si.
- Separadores das Configurações: 3 por linha no telemóvel, 6 numa linha a partir do tablet.

### Cartões de conteúdo
- Curso/vídeo: **horizontal e compacto no telemóvel**, vertical a partir do tablet; grelha de 2–3 colunas.
- O Início mostra até **8 cursos e 8 vídeos**, em faixas no meio do feed; o resto está nas páginas de Cursos e Vídeos.
- Publicação (feed): cabeçalho (autor, tempo, "editado"), texto, foto, repost; ações
  **Reações · Comentários · Partilhar** com os números; Salvar no menu "⋯"; comentários num modal.

### Salvos (`components/ds/botao-salvar.tsx`)
- Guardar para ver depois, com o marcador (`Bookmark`), igual nas duas partes da plataforma. Preenchido a dourado quando está guardado.
- `BotaoSalvar`: variante `cartao` (por cima da imagem, nunca dentro do link), `menu` (no menu "⋯" da publicação, junto de Denunciar) e `botao` (detalhe, ao lado de Partilhar).
- Nas publicações, a linha de ações tem só **Reações · Comentários · Partilhar**, com espaço entre si: os botões nunca se tocam. Salvar, Denunciar e Bloquear ficam no menu "⋯" (o autor vê o menu só com Salvar).
- Tudo numa só página, **Salvos** (`/salvos`), com pesquisa e um separador por tipo no telemóvel. Na barra lateral e no "Mais".
- O que é da escola fica na escola: ao listar volta a verificar-se o acesso, e o aluno que só vê a escola não tem salvos públicos.

### Modais
- `Dialog` sem espaçamento próprio: usar `DialogHeader` (título + descrição) e um corpo
  `div.space-y-4.overflow-y-auto.p-5`.
- Partilhar: `components/partilha/modal-partilha.tsx` (redes, email, copiar link, repostar).

### Gestos de LGA (`components/ds/gesto-animado.tsx`)
- Vídeo curto em loop, sem som, ao lado do título da página (`PageHeader`, palavra = título;
  no Início "Olá"). Só gestos **validados** pela comunidade surda; sem gesto, só texto.
- Respeita "Reduzir animações": o vídeo fica parado e só anda ao passar o cursor.
- Geridos em Administração → Plataforma → Gestos de LGA. Lista de palavras: `docs/lga-icones-palavras.md`.

### Player de vídeo
- Nada por cima dos controlos. Número/título da aula e **recursos ficam por baixo do vídeo**.

### Formulários e uploads
- Mostrar o limite junto ao botão de upload ("máx. 500 MB por aula") e validar antes de enviar.
- Limites (Administração → Plataforma): vídeo avulso, vídeo de aula, PDF.
- Fotos de publicações: até 5 MB.

### Estados
- Conteúdo editado: " · editado" junto à data.
- Vazio: `EmptyState` (ícone + título + o que fazer a seguir). A carregar: texto curto.
- Erros: `toast.error` com a mensagem do servidor.

### Área da escola (`/instituicao`)
- **O mesmo Design System da plataforma pública**: não há componentes de página próprios. Título com
  `PageHeader` (um só H1 por página, com gesto de LGA), pesquisa com `usePesquisaPagina`, listas vazias com
  `EmptyState`, números com `StatCard`, cartões `shadow-soft`, modais como acima.
- Por cima da página fica só uma linha com a escola e o papel, nunca outro título.
- **Tabelas** (`Tabela`, `celula` em `components/instituicao/ui.tsx`): tabela no computador; no telemóvel e
  no tablet cada linha é um cartão, com o rótulo da coluna junto a cada valor.
- **Comunidade da turma**: o mesmo compositor compacto com modal, o mesmo cabeçalho de publicação, e
  **Reações · Comentários** com os números e comentários num modal, como na Comunidade. **Sem partilha externa
  nem repost**: são publicações de crianças. Fotografias só de quem ensina (até 5 MB), com o consentimento
  das crianças verificado. As famílias reagem, mas não publicam nem comentam.
- Faixa de pré-visualização só em "Ver como"; contas de escolas reais nunca vêem a palavra "demonstração".

## 5. Linguagem

- Português de Portugal/Angola, tratamento por "tu", frases curtas.
- Sem palavras técnicas para a pessoa ("vídeo de aula" e não "upload de video de curso").
- Evitar palavras vagas (ex.: "avulsos").

## 6. Como evoluir o Design System

1. Uma regra nova nasce aqui (este ficheiro), com o porquê.
2. Se for visual e reutilizável, vira componente em `components/ds/`.
3. As páginas usam o componente — nunca copiar classes à mão.
4. Tokens novos só em `globals.css` (claro **e** escuro).
