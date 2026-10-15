import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Dados de contacto usados nos Termos e na Política de Privacidade.
export const CONTACTO_LEGAL = {
  entidade: "Transfortech — Projeto EYK",
  email: "transfortech0@gmail.com",
};
export const ULTIMA_ATUALIZACAO = "15 de outubro de 2026";

const EYK_GOLD = "#d4a24a";
const EYK_BG = "#0a0a0a";

const LINKS_LEGAIS = [
  { href: "/termos", label: "Termos de Utilização" },
  { href: "/privacidade", label: "Política de Privacidade" },
];

/** Moldura comum às páginas legais públicas (Termos / Privacidade). */
export function DocumentoLegal({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full text-white/75" style={{ background: EYK_BG }}>
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#0a0a0a]/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" aria-label="Página inicial EYK">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/EYK_-_LOGO-SEM-BAKGROUND.png" alt="EYK" className="h-14 w-auto object-contain" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white/60 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Voltar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: EYK_GOLD }}>
          Ekola Ya Kelela
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">{titulo}</h1>
        <p className="mt-3 text-base text-white/55">{subtitulo}</p>
        <p className="mt-4 text-sm text-white/40">Última atualização: {ULTIMA_ATUALIZACAO}</p>
        <div className="mt-6 h-px w-24" style={{ background: EYK_GOLD }} />

        <article className="mt-10 space-y-10 text-[15px] leading-relaxed">{children}</article>

        <footer className="mt-16 border-t border-white/5 pt-6 text-sm text-white/40">
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {LINKS_LEGAIS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-white/80 hover:underline">
                {l.label}
              </Link>
            ))}
          </nav>
          <p className="mt-4 text-xs text-white/35">
            EYK — Ekola Ya Kelela · Educação acessível, aprendizagem e inclusão.
          </p>
        </footer>
      </main>
    </div>
  );
}

export function Secao({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 className="text-xl font-semibold text-white">{titulo}</h2>
      {children}
    </section>
  );
}

export function SubSecao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 pt-2">
      <h3 className="text-base font-semibold" style={{ color: EYK_GOLD }}>
        {titulo}
      </h3>
      {children}
    </div>
  );
}

export function Lista({ itens }: { itens: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-[#d4a24a]">
      {itens.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function EmailContacto() {
  return (
    <a
      href={`mailto:${CONTACTO_LEGAL.email}`}
      className="font-medium underline-offset-2 hover:underline"
      style={{ color: EYK_GOLD }}
    >
      {CONTACTO_LEGAL.email}
    </a>
  );
}
