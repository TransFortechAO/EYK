# Palavras da plataforma que podem ter um ícone animado de LGA

Lista das palavras que aparecem nas páginas da EYK e que podem ser acompanhadas (ou
substituídas) por um **gesto real de Língua Gestual Angolana em animação curta**.

**Importante:** os gestos têm de ser **gravados e validados por pessoas surdas** que usam LGA
(por exemplo, com a ANSA — Associação Nacional de Surdos de Angola — ou os educadores surdos
das escolas parceiras). Os "gestos" que a Biblioteca mostra hoje são só emojis de demonstração.

**Formato sugerido:** vídeo curto em loop (1–2 s, WebM/MP4 sem som, fundo neutro, 160×160 px)
ou animação Lottie a partir da gravação. Mostrar sempre **com o texto ao lado** (não substituir
o texto por completo: há leitores de ecrã e pessoas a aprender LGA), com opção nas Configurações
para ligar/desligar as animações (já existe "Reduzir animações").

Legenda: ✅ já existe na Biblioteca (como demonstração, precisa do gesto real) · ⭐ prioridade alta
(aparece em todas as páginas).

## 1. Navegação (barra lateral, menu de baixo, títulos)

| Palavra | Onde aparece | |
|---|---|---|
| Início | Menu, título da página | ⭐ |
| Cursos | Menu, Início, título | ⭐ |
| Vídeos | Menu, Início, título | ⭐ |
| Comunidade | Menu, título | ⭐ |
| Notificações | Menu, sino | ⭐ |
| Leaderboard / Classificação | Menu, separadores | |
| Gamificação / Conquistas | Menu, separadores | |
| Biblioteca | Menu, título | |
| Configurações | Menu | ⭐ |
| Sair | Menu | ⭐ |
| Perfil | Menu da conta | |
| Painel | Menu do professor | |
| Mais | Menu de baixo | ⭐ |
| Escola / Turma | Menus da escola | |

## 2. Ações (botões)

| Palavra | Onde aparece | |
|---|---|---|
| Pesquisar | Campo de pesquisa | ⭐ |
| Publicar | Comunidade, professor | |
| Partilhar | Posts, vídeos, cursos | ⭐ |
| Comentar | Posts, vídeos | ⭐ |
| Gosto (reagir) | Posts, vídeos | ✅ ⭐ |
| Responder | Comentários | |
| Repostar | Partilhar | |
| Mencionar | Criar publicação | |
| Seguir | Perfil do professor | |
| Inscrever-me / Começar | Página do curso | ⭐ |
| Ver todos / Ver mais | Início, listas | |
| Editar / Apagar / Guardar / Cancelar | Formulários | |
| Enviar / Carregar (upload) / Descarregar | Professor, recursos | |
| Copiar link | Partilhar | |
| Denunciar / Bloquear | Menu "…" | |
| Fechar / Voltar | Modais, páginas | |

## 3. Aprendizagem

| Palavra | Onde aparece | |
|---|---|---|
| Aprender | Início, Comunidade | ✅ |
| Aprendi | Conquistas | ✅ |
| Aula | Página do curso | ⭐ |
| Curso / Vídeo | Cartões | ⭐ |
| Professor | Cartões, perfil | ✅ |
| Aluno | Perfil, escola | |
| Praticar / Exercício | Escola (LGA) | |
| Progresso / Concluído | Cartões, curso | |
| Certificado | Curso concluído | |
| Recursos / Materiais | Por baixo do vídeo | |
| Legenda | Player | |
| Livro | Biblioteca | ✅ |

## 4. Gamificação

| Palavra | Onde aparece |
|---|---|
| Moedas | Barra do topo, Gamificação |
| Streak / Dias seguidos | Barra do topo, Gamificação |
| Nível | Gamificação |
| Conquista / Medalha | Gamificação |
| Desafio / Recompensa | Gamificação, escola |
| Posição / Primeiro / Segundo / Terceiro | Leaderboard |

## 5. Mensagens e estados

| Palavra | Onde aparece | |
|---|---|---|
| Olá / Bem-vindo(a) | Início, boas-vindas do professor | ✅ ⭐ |
| Obrigado | Depois de publicar, enviar | ✅ |
| Parabéns | Conquistas, curso concluído | ✅ |
| Bom dia / Boa tarde / Boa noite | Saudação do Início | ✅ (bom dia) |
| Novo / Editado | Etiquetas | |
| Erro / Tenta de novo | Avisos | |
| A carregar / Espera | Estados | |
| Feliz / Adoro | Reações | ✅ |

## 6. Pessoas e lugares

| Palavra | |
|---|---|
| Família | ✅ |
| Amigo | ✅ |
| Escola / Turma / Educador / Coordenador | |
| Casa | ✅ |

## Por onde começar

1. Gravar primeiro os ⭐ (cerca de 15 gestos) — aparecem em todas as páginas.
2. Criar o componente `GestoAnimado` (vídeo em loop + texto) em `components/ds/` e usá-lo no
   menu, nos botões principais e nas saudações.
3. Juntar os restantes por secção, validando cada gesto com a comunidade surda.
