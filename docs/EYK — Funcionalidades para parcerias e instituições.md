# EYK — Funcionalidades para parcerias e instituições

Versão 1 · Outubro 2026 · Especificação funcional para discussão com a equipa

Este documento descreve apenas as funcionalidades **a adicionar** ao EYK para trabalhar com escolas, centros, associações, universidades, entidades públicas e patrocinadores. Para cada uma indica-se o que é, quem a usa, como funciona e que regras tem. O núcleo actual da plataforma (conteúdos, comunidade, recursos para alunos e famílias) não muda e continua gratuito.

A descrição parte dos serviços indicados pela equipa (`eyk-web`, `eyk-api`, Ficheiros, `emails` e `agendador`). Deve ser confirmada com quem conhece o código antes de ser tomada como plano de desenvolvimento.

## Visão geral

| # | Funcionalidade | Quem a usa | Fase |
| --- | --- | --- | --- |
| 1 | Espaço da instituição | Administrador | Piloto |
| 2 | Papéis e permissões | Todos | Piloto |
| 3 | Convites e códigos de adesão | Administrador, educador | Piloto |
| 4 | Turmas e grupos | Administrador, educador | Piloto |
| 5 | Vínculo família-aluno | Administrador, educador, família | Piloto |
| 6 | Avisos e comunicação | Administrador, educador | Piloto |
| 7 | Agenda e lembretes | Administrador, educador, família | Piloto |
| 8 | Ficheiros da instituição | Administrador, educador | Piloto |
| 9 | Consentimentos | Família, administrador | Piloto |
| 10 | Relatório de utilização | Administrador, coordenador | Piloto (básico) |
| 11 | Registo de auditoria | Administrador, equipa EYK | Piloto |
| 12 | Exportação e eliminação de dados | Administrador, família | Piloto |
| 13 | Painel de administração EYK (interno) | Equipa EYK | Piloto (manual) |
| 14 | Biblioteca própria com aprovação | Educador, coordenador | Pós-piloto |
| 15 | Relatórios detalhados e exportáveis | Administrador, coordenador | Pós-piloto |
| 16 | Painel para observadores | Entidade pública, universidade, patrocinador | Pós-piloto |
| 17 | Personalização da instituição | Administrador | Pós-piloto |
| 18 | Quotas e planos | Equipa EYK | Pós-piloto |
| 19 | Apoio e formação integrados | Todos | Pós-piloto |
| 20 | Registo autónomo e integrações | Instituições, parceiros técnicos | Escala |

---

# Funcionalidades do piloto

## 1. Espaço da instituição

**O que é.** Uma área própria dentro do EYK para cada escola, centro ou organização, onde ficam os seus utilizadores, turmas, ficheiros, avisos e eventos, separados dos das outras instituições.

**Como funciona.**

1. Depois de assinado o acordo de parceria, a equipa EYK cria o espaço com o nome, o tipo (escola, associação, universidade, entidade pública, patrocinador), a província e o responsável.
2. O responsável recebe um convite por e-mail e torna-se administrador da instituição.
3. A partir daí, tudo o que a instituição cria fica ligado ao seu espaço.
4. Um utilizador que pertence a mais de uma instituição escolhe em qual quer trabalhar e vê apenas os dados dessa.

**Regras.**

- Nenhum dado de uma instituição é visível a outra.
- Uma instituição tem um estado: em preparação, activa, suspensa ou encerrada. Numa instituição suspensa os dados ficam guardados mas o acesso é bloqueado.
- No piloto a criação é manual, feita pela equipa EYK.

## 2. Papéis e permissões

**O que é.** Um conjunto de papéis que define o que cada pessoa pode ver e fazer dentro de uma instituição.

**Papéis.**

| Papel | O que pode fazer |
| --- | --- |
| Administrador | Gerir membros, turmas, definições e relatórios; convidar e remover pessoas |
| Coordenador | Ver relatórios das turmas; aprovar conteúdos próprios (quando existir a biblioteca) |
| Educador | Gerir as suas turmas; publicar avisos e ficheiros; ver o progresso dos seus alunos |
| Família ou tutor | Ver conteúdos e avisos; ver apenas o que diz respeito à sua criança |
| Aluno | Aceder aos conteúdos adequados |
| Observador | Ver apenas painéis agregados e anonimizados |

**Como funciona.** Cada pessoa tem uma pertença por instituição, com um papel. A `eyk-api` verifica o papel e a instituição em cada pedido; o `eyk-web` só mostra os menus e botões que o papel permite.

**Regras.**

- A mesma pessoa pode ter papéis diferentes em instituições diferentes.
- Cada instituição tem sempre pelo menos um administrador.
- Observadores nunca vêem dados pessoais.

## 3. Convites e códigos de adesão

**O que é.** A forma de trazer educadores, famílias e alunos para o espaço da instituição.

**Como funciona.**

1. O administrador ou educador escolhe o papel (por exemplo, família) e a turma de destino.
2. O EYK gera um convite por e-mail ou um código curto que pode ser partilhado em papel ou mensagem.
3. A pessoa abre o convite, cria conta (ou entra na conta que já tem) e fica ligada à instituição e à turma com o papel correcto.
4. Para famílias, o convite pode ficar ligado a um aluno concreto (ver funcionalidade 5).

**Regras.**

- Os convites têm validade (por exemplo, 14 dias) e podem ser cancelados.
- Cada código tem um número máximo de utilizações.
- O administrador aprova ou rejeita pedidos feitos por código antes de a pessoa ganhar acesso, se assim o decidir.
- O `agendador` elimina convites expirados periodicamente.
- Prever convites por SMS ou mensagem, além de e-mail, porque muitas famílias podem não usar e-mail regularmente.

## 4. Turmas e grupos

**O que é.** Agrupamentos dentro de uma instituição (uma turma, um grupo de apoio, um grupo de famílias).

**Como funciona.**

1. O administrador ou educador cria um grupo com nome, tipo e ano lectivo.
2. Adiciona educadores, alunos e famílias, directamente ou por convite.
3. Os avisos, ficheiros e eventos podem ser dirigidos a um grupo específico.
4. No fim do ano lectivo, o grupo pode ser arquivado sem apagar o histórico.

**Regras.**

- Um utilizador pode estar em vários grupos.
- Um educador só vê os grupos a que pertence, salvo se for coordenador ou administrador.

## 5. Vínculo família-aluno

**O que é.** A ligação entre uma criança e os seus pais ou tutores, para que cada família veja apenas o que diz respeito à sua criança.

**Como funciona.**

1. O educador ou administrador cria o perfil do aluno com o mínimo de dados (nome ou alcunha, grupo).
2. Convida o tutor através de um convite ligado a esse aluno.
3. Quando o tutor aceita, fica com acesso ao perfil, aos avisos e aos ficheiros desse aluno, e a mais nenhum.
4. Uma criança pode ter mais de um tutor; um tutor pode ter várias crianças.

**Regras.**

- Antes de existir perfil de criança, tem de existir o consentimento registado (ver funcionalidade 9).
- Não recolher informação clínica ou de diagnóstico por defeito. Se uma instituição precisar dela, tratar como dado sensível com acesso restrito e justificação expressa.
- O administrador pode desfazer um vínculo quando uma pessoa deixa de ser tutora.

## 6. Avisos e comunicação

**O que é.** A forma de a instituição enviar mensagens a turmas, grupos ou a toda a comunidade.

**Como funciona.**

1. O educador ou administrador escreve o aviso, escolhe os destinatários (toda a instituição, um grupo ou uma pessoa) e, se quiser, anexa ficheiros.
2. O aviso aparece na plataforma e, conforme as preferências de cada pessoa, é enviado também por e-mail através do serviço `emails`.
3. O sistema regista quem recebeu e quem abriu o aviso.
4. Pode ser pedido um "li e confirmo" para avisos importantes.

**Regras.**

- Famílias podem escolher como querem ser avisadas (na plataforma, por e-mail), dentro do que a instituição activou.
- O aviso mostra ao remetente o número de leituras, não quem não leu em público.
- As mensagens são de sentido único no piloto (instituição para famílias). Conversas bidireccionais entre famílias e educadores exigem regras de moderação e ficam para depois.

## 7. Agenda e lembretes

**O que é.** Um calendário da instituição com reuniões, actividades e prazos.

**Como funciona.**

1. O educador ou administrador cria um evento com data, hora, local ou ligação e destinatários.
2. Os destinatários vêem-no no calendário da plataforma e podem confirmar presença.
3. O `agendador` envia lembretes (por exemplo, um dia e uma hora antes) através do `emails` e das notificações da plataforma.
4. Eventos podem repetir-se (semanal, mensal) e ser cancelados com aviso automático.

**Regras.**

- Os lembretes respeitam as preferências de cada pessoa.
- As datas e horas têm o fuso horário de Angola como padrão.

## 8. Ficheiros da instituição

**O que é.** Um espaço para a instituição partilhar documentos, imagens, áudio e vídeo com visibilidade controlada.

**Como funciona.**

1. O educador carrega um ficheiro e escolhe quem o pode ver: toda a instituição, um grupo ou uma pessoa.
2. O serviço Ficheiros guarda o ficheiro numa pasta separada por instituição e valida o tipo e o tamanho.
3. Ao abrir, a `eyk-api` verifica a permissão antes de entregar o ficheiro.
4. O administrador vê quanto armazenamento a instituição já usou.

**Regras.**

- Cada instituição tem uma quota de armazenamento e um limite de tamanho por ficheiro, definidos pela equipa EYK.
- Tipos de ficheiro permitidos são limitados (documentos, imagens, áudio, vídeo) e os ficheiros são verificados antes de ficarem disponíveis.
- Ficheiros com fotos ou vídeos de crianças só podem ser publicados se o consentimento correspondente existir.
- Os vídeos são o maior custo previsível; avaliar compressão ou limite de duração.

## 9. Consentimentos

**O que é.** O registo do consentimento de pais ou tutores para o tratamento de dados e para o uso de imagens da criança.

**Como funciona.**

1. Quando o tutor aceita o convite, vê um texto claro e curto a explicar que dados são recolhidos, para que servem e quem os vê.
2. O tutor aceita ou recusa cada finalidade separadamente (por exemplo: utilização da plataforma; partilha de fotografias na turma; participação em relatórios agregados).
3. O sistema guarda quem consentiu, o quê, quando e a versão do texto aceite.
4. O tutor pode retirar o consentimento a qualquer momento; as consequências são aplicadas (por exemplo, remover a criança dos relatórios).

**Regras.**

- Sem consentimento de utilização, não há perfil de criança.
- O texto deve ser revisto por um jurista, em linguagem simples e em português; considerar também versões nas línguas locais mais usadas pelas famílias.
- Para tutores com pouca literacia, a instituição pode apoiar presencialmente o processo.

## 10. Relatório de utilização (básico)

**O que é.** Um resumo simples de como a instituição está a usar o EYK.

**Como funciona.** O `agendador` calcula periodicamente, a partir dos registos de actividade, indicadores como: número de utilizadores activos, acessos por semana, conteúdos mais usados, avisos lidos e eventos criados. O administrador vê o resultado num painel e pode receber um resumo por e-mail.

**Regras.**

- Os relatórios são por instituição e por grupo, não por criança individual.
- Se um grupo tiver menos de 5 pessoas, o relatório não mostra detalhe desse grupo, para não identificar ninguém.
- "Utilizador activo" deve ser definido com precisão (por exemplo, pelo menos um acesso nos últimos 30 dias) e usado sempre da mesma forma.

## 11. Registo de auditoria

**O que é.** Um histórico de acções sensíveis: quem fez o quê e quando.

**Como funciona.** A `eyk-api` regista automaticamente eventos como criação e remoção de membros, alteração de papéis, exportação de dados, abertura de ficheiros sensíveis e alteração de consentimentos. O administrador consulta o histórico da sua instituição; a equipa EYK consulta o de todas, quando necessário para suporte ou investigação.

**Regras.**

- Os registos não podem ser editados nem apagados por utilizadores.
- Definir um prazo de conservação.
- O acesso da equipa EYK a dados de uma instituição fica também registado.

## 12. Exportação e eliminação de dados

**O que é.** A capacidade de a instituição e as famílias pedirem os seus dados ou a sua eliminação.

**Como funciona.**

1. Um tutor ou o administrador pede a exportação ou eliminação na plataforma, ou à equipa EYK.
2. O sistema recolhe os dados do âmbito pedido (uma criança, uma família ou a instituição inteira) e gera um ficheiro para descarregar.
3. Na eliminação, o sistema apaga ou anonimiza os dados, incluindo ficheiros, e regista a acção. As cópias de segurança são limpas no ciclo normal.
4. No fim de uma parceria, a instituição recebe uma exportação completa antes de os dados serem eliminados.

**Regras.**

- Comunicar claramente os prazos.
- Dados necessários por obrigação legal podem ter de ser mantidos; confirmar com o jurista.

## 13. Painel de administração EYK (interno)

**O que é.** Uma área reservada à equipa EYK para gerir instituições.

**Como funciona.** A equipa pode criar, activar, suspender e encerrar instituições; definir o administrador inicial; ajustar quotas; ver o estado geral (número de utilizadores, armazenamento, erros) e abrir um pedido de apoio. No piloto, parte disto pode ser feita directamente na base de dados com um guia interno, e a interface só se constrói quando houver mais de 3 ou 4 instituições.

**Regras.**

- Acesso restrito a poucas pessoas, com autenticação reforçada.
- Todas as acções ficam no registo de auditoria.

---

# Funcionalidades pós-piloto

## 14. Biblioteca própria com aprovação

**O que é.** Um espaço onde a instituição cria e partilha os seus próprios conteúdos (fichas, actividades, vídeos), adaptados aos seus alunos.

**Como funciona.**

1. O educador cria um conteúdo e submete-o.
2. O coordenador revê e aprova, pede alterações ou rejeita.
3. Conteúdos aprovados ficam disponíveis para a instituição, para grupos ou para pessoas específicas.
4. A instituição pode, se quiser, propor um conteúdo para o catálogo geral do EYK; a equipa EYK revê antes de publicar.

**Regras.**

- Os conteúdos próprios pertencem à instituição que os criou; definir por escrito os direitos e a licença quando partilhados com o catálogo geral.
- Validar o conteúdo quanto a acessibilidade (legendas, descrição de imagens, contraste) antes de aprovar.

## 15. Relatórios detalhados e exportáveis

**O que é.** Relatórios por turma, período e tipo de actividade, que se podem exportar.

**Como funciona.** O administrador escolhe o período e o âmbito, o sistema gera o relatório e permite descarregá-lo em formatos habituais (por exemplo PDF ou folha de cálculo). Relatórios periódicos podem ser agendados e enviados por e-mail.

**Regras.** As mesmas do relatório básico: agregados, sem dados individuais por defeito, com limite mínimo de pessoas por grupo.

## 16. Painel para observadores

**O que é.** Vistas agregadas para entidades que acompanham o projecto sem trabalhar com as crianças.

| Observador | O que vê |
| --- | --- |
| Entidade pública (direcção de Educação, INEE) | Número de escolas e utilizadores por região, taxa de utilização, problemas reportados |
| Universidade | Conjuntos de dados anonimizados para estudo, sujeitos a acordo e aprovação ética |
| Patrocinador | Impacto do patrocínio: utilizadores apoiados, utilização, regiões, custo por beneficiário |

**Como funciona.** A equipa EYK cria o acesso de observador, define a instituição ou conjunto de instituições que ele pode ver, e o painel mostra apenas indicadores agregados.

**Regras.**

- Nenhum dado pessoal, nenhuma fotografia, nenhum nome de criança.
- As instituições são informadas de que dados agregados são partilhados e com quem.
- Dados para investigação exigem acordo escrito e, se envolver estudo com crianças, aprovação ética.

## 17. Personalização da instituição

**O que é.** Ajustes visuais e de texto para que a instituição reconheça o espaço como seu.

**Como funciona.** O administrador carrega o logótipo, escolhe o nome a mostrar e escreve uma mensagem de boas-vindas; os e-mails enviados em nome da instituição usam esse nome e logótipo.

**Regras.** Manter os requisitos de acessibilidade (contraste, tamanho de letra) independentemente do que a instituição escolher.

## 18. Quotas e planos

**O que é.** A forma de definir e acompanhar o que cada instituição pode usar.

**Como funciona.** A equipa EYK atribui a cada instituição um plano (piloto, comunitário, institucional, patrocinado) com limites de utilizadores, armazenamento e funcionalidades. O sistema avisa o administrador quando o uso se aproxima do limite e bloqueia apenas a criação de novos itens, nunca o acesso ao que já existe.

**Regras.**

- Valores e preços só se definem depois do piloto e das entrevistas.
- Funcionalidades essenciais de acesso e acessibilidade não dependem do plano.

## 19. Apoio e formação integrados

**O que é.** Ajuda dentro da plataforma para quem a usa.

**Como funciona.** Guias curtos por papel (educador, família, administrador), vídeos breves, perguntas frequentes e um formulário para pedir apoio, que chega à equipa EYK com a identificação da instituição. A equipa regista o tempo de resposta.

**Regras.** Conteúdos de ajuda em português simples, com versões acessíveis.

---

# Funcionalidades de escala

## 20. Registo autónomo e integrações

**O que é.** A possibilidade de uma instituição aderir sem intervenção manual da equipa EYK, e de ligar o EYK a outros sistemas.

**Como funciona.**

- **Registo autónomo:** a instituição preenche um pedido com os seus dados e documentos; a equipa EYK verifica e aprova; o espaço é criado automaticamente.
- **Importação de listas:** o administrador carrega uma folha com alunos e turmas para criação em lote, com validação de erros.
- **API para parceiros:** acesso programático, com chaves e limites, a dados que a instituição escolhe partilhar.

**Regras.** Só construir depois de existirem várias instituições e procura comprovada; cada integração aumenta a superfície de segurança e o custo de manutenção.

---

## Ordem de construção sugerida

1. **Base:** espaço da instituição, papéis e permissões, registo de auditoria (1, 2, 11). Tudo o resto depende disto.
2. **Pessoas:** convites, turmas, vínculo família-aluno e consentimentos (3, 4, 5, 9).
3. **Utilidade diária:** avisos, agenda e ficheiros (6, 7, 8).
4. **Medição e confiança:** relatório básico, exportação e eliminação, administração interna mínima (10, 12, 13).
5. **Depois do piloto:** decidir o que construir entre 14 e 19 com base no que as instituições realmente pedirem.

## O que a equipa deve confirmar

- Que funcionalidades já existem no código e quais exigem reestruturação do modelo de utilizadores.
- Que custos têm o armazenamento, o envio de e-mails e as notificações quando o número de instituições crescer.
- Como funciona hoje a autenticação e a recuperação de conta.
- Se a plataforma funciona bem com ligações lentas e em telemóvel, onde muitas famílias a vão usar.
- Que texto de consentimento e que política de privacidade o jurista aprova.
