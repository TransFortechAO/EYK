import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const valores = [
  "Responsabilidade",
  "Honestidade",
  "Educação",
  "Comprometimento",
  "Comunicação",
  "Proatividade",
  "Sustentabilidade",
  "Inovação",
  "Colaboração",
];

export default function SobrePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <Link
          href="/"
          className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar ao início
        </Link>

        <article className="space-y-12">
          <header className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Transfortech
            </p>
            <h1 className="font-serif text-4xl font-bold sm:text-5xl">Sobre nós</h1>
            <p className="text-lg font-medium text-muted-foreground">
              Ideias inovadoras para um mundo em movimento.
            </p>
          </header>

          <section className="space-y-5 text-base leading-8 text-muted-foreground">
            <p>
              A <strong className="font-semibold text-foreground">Transfortech</strong> é uma startup tecnológica angolana que nasceu da visão de transformar a sociedade através da tecnologia e da inovação. O nosso nome resulta da união de duas ideias: “Transfor”, de transformação, e “Tech”, de tecnologia, refletindo o nosso propósito de utilizar a tecnologia como ferramenta para construir um mundo melhor.
            </p>
            <p>
              Acreditamos que a tecnologia deve ser acessível a todos. Por isso, desenvolvemos soluções tecnológicas inovadoras, práticas e de baixo custo, adaptadas às necessidades reais das pessoas, empresas e comunidades, tendo em conta os desafios e as particularidades da realidade angolana.
            </p>
            <p>
              Atuamos em diferentes áreas, incluindo desenvolvimento de software, robótica, automação, Internet das Coisas (IoT), redes informáticas e educação tecnológica. Para além da criação de produtos e serviços, promovemos formações e iniciativas de capacitação, incentivando o desenvolvimento de competências técnicas, o pensamento inovador e o espírito empreendedor, especialmente entre os jovens.
            </p>
            <p>
              Na Transfortech, não vemos a tecnologia apenas como um conjunto de ferramentas, mas como um meio de criar oportunidades, resolver problemas e impulsionar o desenvolvimento da sociedade.
            </p>
            <p>
              A nossa ambição é contribuir para a transformação digital de Angola e, futuramente, expandir o nosso impacto para outros mercados, tornando-nos uma referência em inovação e soluções tecnológicas acessíveis.
            </p>
          </section>

          <section className="grid gap-5 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 font-serif text-2xl font-bold">Missão</h2>
              <p className="leading-7 text-muted-foreground">
                Resolver problemas reais por intermédio da tecnologia, desenvolvendo projetos adaptáveis às necessidades reais do mercado.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 font-serif text-2xl font-bold">Visão</h2>
              <p className="leading-7 text-muted-foreground">
                Liderar o desenvolvimento das TIC com soluções inovadoras, acessíveis e enraizadas na realidade local.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 sm:col-span-2">
              <h2 className="mb-4 font-serif text-2xl font-bold">Valores</h2>
              <ul className="flex flex-wrap gap-2">
                {valores.map((valor) => (
                  <li key={valor} className="rounded-full border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground">
                    {valor}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <p className="border-t border-border pt-6 font-serif text-lg font-semibold">
            Transfortech — Ideias inovadoras para um mundo em movimento.
          </p>
        </article>
      </div>
    </main>
  );
}
