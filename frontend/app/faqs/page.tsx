import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, MoveLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Perguntas Frequentes · EYK",
  description: "Respostas às perguntas mais frequentes sobre a plataforma EYK.",
};

const faqs = [
  {
    pergunta: "O que é a EYK?",
    resposta: <p>A EYK (Ekola Ya Kelela) é uma plataforma digital de educação inclusiva, desenvolvida pela Transfortech. O seu objetivo é facilitar o acesso ao conhecimento através de cursos, vídeos educativos, recursos de aprendizagem e interação entre estudantes e professores.</p>,
  },
  {
    pergunta: "O que significa Ekola Ya Kelela?",
    resposta: <p>Ekola Ya Kelela é uma expressão em Kimbundu que significa “Escola Especial”. O nome representa a nossa intenção de criar um espaço educativo diferente, onde a inclusão, a acessibilidade e a aprendizagem são prioridades.</p>,
  },
  {
    pergunta: "Quem pode utilizar a EYK?",
    resposta: <p>A EYK foi concebida para estudantes, professores e pessoas interessadas em aprender e partilhar conhecimentos. Embora tenha uma atenção especial à inclusão de pessoas com deficiência auditiva, a plataforma procura proporcionar oportunidades de aprendizagem para todos.</p>,
  },
  {
    pergunta: "A EYK é destinada apenas a pessoas surdas?",
    resposta: <p>Não. A EYK é uma plataforma de educação inclusiva aberta a todos. No entanto, tem um compromisso especial com a comunidade surda, procurando valorizar a Língua Gestual Angolana (LGA) e reduzir as barreiras de comunicação e aprendizagem.</p>,
  },
  {
    pergunta: "A utilização da EYK é gratuita?",
    resposta: <p>O registo na plataforma permite criar uma conta e aceder às funcionalidades disponibilizadas aos utilizadores. Alguns conteúdos ou serviços poderão estar sujeitos a condições específicas de acesso, conforme a modalidade disponibilizada na plataforma.</p>,
  },
  {
    pergunta: "Como posso criar uma conta na EYK?",
    resposta: <p>Acede à página inicial da EYK, seleciona a opção <strong>Registar grátis</strong> e preenche os dados solicitados. Depois de concluíres o registo, poderás entrar na plataforma e explorar os conteúdos disponíveis.</p>,
  },
  {
    pergunta: "Que conteúdos posso encontrar na plataforma?",
    resposta: <>
      <p>Na EYK podes encontrar diferentes recursos educativos, incluindo:</p>
      <ul className="mt-3 list-disc space-y-1 pl-5">
        <li>Cursos online de várias áreas.</li>
        <li>Vídeos educativos.</li>
        <li>Conteúdos de aprendizagem em Língua Gestual Angolana.</li>
        <li>Publicações e partilhas da comunidade.</li>
        <li>Atividades e recursos de aprendizagem.</li>
      </ul>
      <p className="mt-3">A disponibilidade dos conteúdos depende das publicações realizadas na plataforma.</p>
    </>,
  },
  {
    pergunta: "O que é a Biblioteca LGA?",
    resposta: <p>A Biblioteca LGA é uma área dedicada à Língua Gestual Angolana, criada para apoiar a aprendizagem, a consulta e a divulgação de conteúdos em língua gestual. É também uma forma de valorizar a comunicação e a inclusão da comunidade surda em Angola.</p>,
  },
  {
    pergunta: "Como posso acompanhar um curso ou assistir a um vídeo?",
    resposta: <p>Depois de entrares na tua conta, acede à secção <strong>Cursos</strong> ou <strong>Vídeos</strong>. Explora os conteúdos disponíveis e seleciona aquele que desejas consultar. As condições de acesso podem variar de acordo com cada conteúdo.</p>,
  },
  {
    pergunta: "Posso interagir com outros utilizadores?",
    resposta: <p>Sim. A EYK possui uma área de comunidade onde os utilizadores podem partilhar publicações, reagir, comentar e interagir com outros membros, promovendo a troca de experiências e conhecimentos.</p>,
  },
  {
    pergunta: "Como posso acompanhar o meu desempenho na plataforma?",
    resposta: <p>A EYK disponibiliza funcionalidades de gamificação, como moedas e classificação dos utilizadores, para incentivar a participação e a aprendizagem. Consulta as áreas <strong>Gamificação</strong> e <strong>Leaderboard</strong> para acompanhar as funcionalidades disponíveis.</p>,
  },
  {
    pergunta: "Posso tornar-me professor na EYK?",
    resposta: <p>Sim. A EYK pretende aproximar professores e estudantes, criando oportunidades para partilhar conhecimentos e conteúdos educativos. Os interessados em ensinar podem consultar a opção <strong>Quero ser professor</strong>, disponível na plataforma, para conhecer o processo de participação.</p>,
  },
  {
    pergunta: "A EYK disponibiliza conteúdos em Língua Gestual Angolana?",
    resposta: <p>A EYK aposta na disponibilização e valorização de conteúdos em Língua Gestual Angolana através da sua Biblioteca LGA e dos recursos educativos publicados na plataforma. A quantidade e os temas disponíveis podem variar à medida que novos conteúdos são adicionados.</p>,
  },
  {
    pergunta: "A EYK funciona em telemóveis e computadores?",
    resposta: <p>A EYK é uma plataforma digital que pode ser acedida através de um navegador de internet em dispositivos compatíveis, como computadores, tablets e telemóveis. Recomenda-se uma ligação à internet para aceder aos conteúdos online.</p>,
  },
  {
    pergunta: "Como posso recuperar o acesso à minha conta?",
    resposta: <p>Caso tenhas dificuldades para entrar na tua conta, utiliza a opção de recuperação de palavra-passe, caso esteja disponível na página de autenticação. Se o problema persistir, procura os canais de contacto oficiais da EYK.</p>,
  },
  {
    pergunta: "Como posso comunicar um problema ou dar uma sugestão?",
    resposta: <p>Podes utilizar os canais oficiais de contacto da EYK para comunicar dificuldades, apresentar sugestões ou partilhar ideias que possam contribuir para melhorar a plataforma.</p>,
  },
  {
    pergunta: "Quem desenvolveu a EYK?",
    resposta: <p>A EYK é um projeto da <strong>Transfortech</strong>, uma iniciativa tecnológica que procura desenvolver soluções inovadoras para responder a desafios reais da sociedade, utilizando a tecnologia como instrumento de transformação.</p>,
  },
  {
    pergunta: "Qual é o principal objetivo da EYK?",
    resposta: <p>O nosso principal objetivo é contribuir para uma educação mais acessível e inclusiva, promovendo oportunidades de aprendizagem para todos e valorizando diferentes formas de comunicação.</p>,
  },
];

export default function FaqsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <Link href="/" className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
          <MoveLeft className="h-4 w-4" aria-hidden />
          Voltar à página inicial
        </Link>

        <header className="mb-10 space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">EYK · Ajuda</p>
          <h1 className="font-serif text-4xl font-bold sm:text-5xl">Perguntas Frequentes</h1>
          <p className="text-muted-foreground">Respostas sobre a plataforma, os conteúdos e a aprendizagem na EYK.</p>
        </header>

        <section aria-label="Perguntas e respostas" className="space-y-3">
          {faqs.map(({ pergunta, resposta }, index) => (
            <details key={pergunta} className="group rounded-2xl border border-border bg-card/80 px-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                <span><span className="mr-2 text-primary">{index + 1}.</span>{pergunta}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="border-t border-border pb-5 pt-4 leading-7 text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground">
                {resposta}
              </div>
            </details>
          ))}
        </section>

        <p className="mt-10 border-t border-border pt-6 font-serif text-lg font-semibold">
          EYK — Aprender. Incluir. Transformar.
        </p>
      </div>
    </main>
  );
}
