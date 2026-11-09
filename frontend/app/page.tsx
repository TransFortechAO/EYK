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
  PlayCircle,
  Users,
  Trophy,
  Captions,
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
    { label: "Privacidade", href: "/privacidade" },
    { label: "Termos de uso", href: "/termos" },
  ],
  Ensinar: [
    { label: "Quero ser professor", href: "/register?tipo=professor" },
  ],
  
};

// Redes da Transfortech (quem faz a EYK).
const redes = [
  {
    nome: "Instagram",
    icone: Instagram,
    href: "https://www.instagram.com/trans_fortech?utm_source=ig_web_button_share_sheet&dlrf=ZDNlZDc0MzIxNw==",
  },
  { nome: "Facebook", icone: Facebook, href: "https://www.facebook.com/profile.php?id=100082682384295" },
  { nome: "LinkedIn", icone: Linkedin, href: "https://www.linkedin.com/company/transfortech/posts/?feedView=all" },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen w-full" style={{ background: EYK_BG }}>
      {/* Fundo animado (gif) para toda a página */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/gif1.gif"
          alt=""
          aria-hidden
          className="h-full w-full object-cover"
        />
        {/* Overlay escuro para garantir legibilidade do texto */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(10,10,10,0.85) 0%, rgba(10,10,10,0.75) 40%, rgba(10,10,10,0.92) 100%)",
          }}
        />
      </div>

      {/* Conteúdo acima do fundo */}
      <div className="relative z-10">

        {/* Cabeçalho */}
        {/* Barra flutuante: opaca, com cantos redondos e afastada das margens. */}
        <header className="sticky top-3 z-20 px-3 sm:top-4 sm:px-6">
          <div className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-white/10 bg-[#0a0a0a] py-2 pl-4 pr-3 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.9)] sm:pl-6 sm:pr-4">
            <div className="flex items-center gap-2">
              <img src="/assets/EYK_-_LOGO-SEM-BAKGROUND.png" alt=""
                className="h-14 w-auto object-contain sm:h-16"
              />
            </div>

            <nav className="flex items-center gap-4 sm:gap-6">
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
        {/* Telemóvel: uma coluna, centrada. Computador: duas colunas a ocupar a largura. */}
        <section className="mx-auto max-w-6xl px-6 py-16 lg:px-8 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:max-w-none lg:text-left">
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

              <h1 className="mb-6 font-serif text-4xl font-bold leading-[1.1] text-white lg:text-6xl">
                Estudar em{" "}
                <em className="not-italic" style={{ color: EYK_GOLD_LIGHT }}>
                  língua gestual
                </em>{" "}
                nunca foi tão fácil.
              </h1>

              <p className="mx-auto mb-10 max-w-[480px] text-sm leading-relaxed text-white/60 lg:mx-0 lg:max-w-xl lg:text-lg">
                Ekola ya Kelela — &ldquo;Escola Especial&rdquo; em Kimbundu. Plataforma digital
                para pessoas com deficiências auditivas e afónicas, com vídeo-aulas, conteúdos
                escolares e científicos, feitos por professores para reforçar o que já foi
                ensinado e esclarecer dúvidas.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-4 lg:justify-start">
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

            {/* A plataforma por dentro: aula em LGA, comunidade e conquistas. */}
            <div aria-hidden className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div
                className="absolute -inset-6 rounded-[2.5rem] opacity-60 blur-3xl"
                style={{ background: "radial-gradient(circle at 60% 40%, rgba(212,162,74,0.35), transparent 65%)" }}
              />
              <div className="relative space-y-4">
                <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#111] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)]">
                  <div className="relative grid aspect-video place-items-center bg-gradient-to-br from-[#2a2112] via-[#151515] to-[#0d0d0d]">
                    <Hand className="h-24 w-24" style={{ color: EYK_GOLD_LIGHT }} />
                    <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                      <Captions className="h-3.5 w-3.5" /> LGA + legendas
                    </span>
                    <span className="absolute bottom-4 right-4 grid h-12 w-12 place-items-center rounded-full text-black" style={{ background: `linear-gradient(135deg, ${EYK_GOLD}, ${EYK_GOLD_LIGHT})` }}>
                      <PlayCircle className="h-6 w-6" />
                    </span>
                  </div>
                  <div className="space-y-2 p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: EYK_GOLD }}>Vídeo-aula</p>
                    <p className="font-serif text-lg font-bold text-white">Saudações em Língua Gestual Angolana</p>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full w-2/3 rounded-full" style={{ background: `linear-gradient(90deg, ${EYK_GOLD}, ${EYK_GOLD_LIGHT})` }} />
                    </div>
                    <p className="text-xs text-white/50">65% concluído</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-white/10 bg-[#111] p-4">
                    <Users className="mb-2 h-5 w-5" style={{ color: EYK_GOLD }} />
                    <p className="text-sm font-semibold text-white">Comunidade</p>
                    <p className="text-xs text-white/50">Alunos e professores, surdos e ouvintes</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#111] p-4">
                    <Trophy className="mb-2 h-5 w-5" style={{ color: EYK_GOLD }} />
                    <p className="text-sm font-semibold text-white">Conquistas</p>
                    <p className="text-xs text-white/50">Moedas, níveis e classificação</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </section>

        {/* O que é a EYK */}
        <section className="border-t border-white/5 py-20">
          <div className="mx-auto grid max-w-6xl gap-6 px-6 text-center lg:grid-cols-2 lg:gap-16 lg:px-8 lg:text-left">
            <div>
              <p
                className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em]"
                style={{ color: EYK_GOLD }}
              >
                O que é a EYK
              </p>
              <h2 className="font-serif text-3xl font-bold leading-tight text-white lg:text-5xl">
                Uma plataforma pensada de mãos para pessoas surdas.
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-white/60 lg:self-end lg:text-lg">
              Ekola ya Kelela, de origem Kimbundu, &ldquo;Escola Especial&rdquo; em Português, é
              uma plataforma digital direcionada a pessoas com deficiências afónicas e auditivas,
              ajudando-as com vídeo-aulas, conteúdos de entretenimento, conceitos escolares e
              científicos. A EYK oferece oportunidades tanto para professores partilharem as suas
              aulas online como para estudantes acederem a conteúdos de qualidade em diversos
              temas educacionais.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-6xl gap-5 px-6 sm:grid-cols-3 lg:gap-6 lg:px-8">
            {beneficios.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 lg:p-8"
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
                <div className="flex items-center gap-2">
                  <img src="/assets/EYK_-_LOGO-SEM-BAKGROUND.png" alt=""
                    className="h-20 w-auto object-contain"
                  />
                </div>
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
              <ul className="flex items-center gap-3">
                {redes.map(({ nome, icone: Icone, href }) => (
                  <li key={nome}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Transfortech no ${nome}`}
                      title={nome}
                      className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-white/60 transition hover:border-[#d4a24a]/60 hover:text-white"
                    >
                      <Icone className="h-4 w-4" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mx-auto mt-10 max-w-6xl border-t border-white/5 px-6 pt-6 lg:px-8">
            <p className="text-xs text-white/35">© 2026 Projeto EYK — Transfortech</p>
          </div>
        </footer>
      </div>
    </div>
  );
}