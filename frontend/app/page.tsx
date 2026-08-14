import Link from "next/link";
import {
  Hand,
  Wifi,
  Gauge,
  Gift,
  ArrowRight,
  Instagram,
  Facebook,
  Linkedin,
} from "lucide-react";

const EYK_GOLD = "#d4a24a";
const EYK_GOLD_LIGHT = "#e2b45c";
const EYK_BG = "#0a0a0a";

const beneficios = [
  {
    icon: Wifi,
    title: "Acessível",
    text: "Estuda quando e onde quiseres — basta uma ligação à internet.",
  },
  {
    icon: Gauge,
    title: "Eficiente",
    text: "Reduz custos com materiais físicos e otimiza o tempo de ensino.",
  },
  {
    icon: Gift,
    title: "Grátis",
    text: "Para todos os níveis de ensino que buscam aprender, sem custo.",
  },
];

const rodapeLinks = {
  Plataforma: [
    { label: "Cursos", href: "/login" },
    { label: "Vídeos", href: "/login" },
    { label: "Comunidade", href: "/login" },
  ],
  Legal: [
    { label: "Privacidade", href: "#" },
    { label: "Termos de uso", href: "#" },
  ],
  Ensinar: [
    { label: "Quero ser professor", href: "https://forms.gle/qfs6zo8QLHfRsnKX9", external: true },
  ],
};

export default function LandingPage() {
  return (
    <div className="min-h-screen w-full" style={{ background: EYK_BG }}>
      {/* Cabeçalho */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#0a0a0a]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 lg:px-8">
          <div className="flex items-center gap-2">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-black"
              style={{ background: `linear-gradient(135deg, ${EYK_GOLD}, ${EYK_GOLD_LIGHT})` }}
            >
              <Hand className="h-4.5 w-4.5" aria-hidden />
            </div>
            <span
              className="font-serif text-xl font-bold tracking-tight"
              style={{ color: EYK_GOLD }}
            >
              EYK
            </span>
          </div>

          <nav className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-sm font-medium text-white/70 transition hover:text-white"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="rounded-full px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_30px_-10px_rgba(212,162,74,0.45)] transition hover:brightness-105"
              style={{ background: `linear-gradient(135deg, ${EYK_GOLD}, ${EYK_GOLD_LIGHT})` }}
            >
              Registar grátis
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-16 lg:px-8 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div
              className="mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
              style={{
                background: "rgba(212,162,74,0.12)",
                borderColor: "rgba(212,162,74,0.28)",
                color: EYK_GOLD_LIGHT,
              }}
            >
              <Hand className="h-3.5 w-3.5" aria-hidden />
              <span className="text-[11px] font-bold uppercase tracking-[0.04em]">
                Língua Gestual
              </span>
            </div>

            <h1 className="mb-6 font-serif text-4xl font-bold leading-[1.1] text-white lg:text-5xl">
              Estudar em{" "}
              <em className="not-italic" style={{ color: EYK_GOLD_LIGHT }}>
                língua gestual
              </em>{" "}
              nunca foi tão fácil.
            </h1>

            <p className="mb-10 max-w-[480px] text-sm leading-relaxed text-white/60 lg:text-base">
              Ekola ya Kelela — &ldquo;Escola Especial&rdquo; em Kimbundu. Plataforma digital
              para pessoas com deficiências auditivas e afónicas, com vídeo-aulas, conteúdos
              escolares e científicos, feitos por professores para reforçar o que já foi
              ensinado e esclarecer dúvidas.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-black shadow-[0_10px_30px_-10px_rgba(212,162,74,0.45)] transition hover:brightness-105"
                style={{ background: `linear-gradient(135deg, ${EYK_GOLD}, ${EYK_GOLD_LIGHT})` }}
              >
                Começar a aprender
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/5"
              >
                Já tenho conta
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03]">
              <Hand className="h-16 w-16 text-white/25" aria-hidden />
            </div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/55">
              <Hand className="h-3.5 w-3.5" aria-hidden />
              legendas sempre visíveis em todos os vídeos
            </div>
          </div>
        </div>
      </section>

      {/* O que é a EYK */}
      <section className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
          <p
            className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em]"
            style={{ color: EYK_GOLD }}
          >
            O que é a EYK
          </p>
          <h2 className="mb-6 font-serif text-3xl font-bold leading-tight text-white lg:text-4xl">
            Uma plataforma pensada de mãos para pessoas surdas.
          </h2>
          <p className="text-sm leading-relaxed text-white/60 lg:text-base">
            Ekola ya Kelela, de origem Kimbundu, &ldquo;Escola Especial&rdquo; em Português, é
            uma plataforma digital direcionada a pessoas com deficiências afónicas e auditivas,
            ajudando-as com vídeo-aulas, conteúdos de entretenimento, conceitos escolares e
            científicos. A EYK oferece oportunidades tanto para professores partilharem as suas
            aulas online como para estudantes acederem a conteúdos de qualidade em diversos
            temas educacionais.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl gap-5 px-6 sm:grid-cols-3 lg:px-8">
          {beneficios.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
            >
              <div
                className="mb-4 grid h-11 w-11 place-items-center rounded-full"
                style={{ background: "rgba(212,162,74,0.15)", color: EYK_GOLD }}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="mb-2 font-serif text-lg font-bold text-white">{title}</h3>
              <p className="text-sm leading-relaxed text-white/60">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Rodapé */}
      <footer className="border-t border-white/5 py-14">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-black"
                style={{ background: `linear-gradient(135deg, ${EYK_GOLD}, ${EYK_GOLD_LIGHT})` }}
              >
                <Hand className="h-4 w-4" aria-hidden />
              </div>
              <span className="font-serif text-lg font-bold" style={{ color: EYK_GOLD }}>
                EYK
              </span>
            </div>
            <p className="text-sm leading-relaxed text-white/50">
              Ekola ya Kelela — educação em língua gestual, para todos.
            </p>
          </div>

          {Object.entries(rodapeLinks).map(([titulo, links]) => (
            <div key={titulo}>
              <h4 className="mb-3 text-sm font-semibold text-white">{titulo}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      {...("external" in link && link.external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      className="text-sm text-white/50 transition hover:text-white/80"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h4 className="mb-3 text-sm font-semibold text-white">Siga-nos</h4>
            <div className="flex items-center gap-3">
              {[Instagram, Facebook, Linkedin].map((Icon, i) => (
                <span
                  key={i}
                  className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-white/50"
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-6xl border-t border-white/5 px-6 pt-6 lg:px-8">
          <p className="text-xs text-white/35">© 2026 Projeto EYK — Transfortech</p>
        </div>
      </footer>
    </div>
  );
}
