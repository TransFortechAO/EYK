import path from "path";
import type { NextConfig } from "next";

// Hostnames/IPs usados para abrir o Next.js a partir de outros dispositivos.
// Se o IP do servidor mudar, atualiza NEXT_ALLOWED_DEV_ORIGINS_EXTRA no .env.local.
const origensExtra = (process.env.NEXT_ALLOWED_DEV_ORIGINS_EXTRA || "")
  .split(",")
  .map((origem) => origem.trim())
  .filter(Boolean);

// O Next reencaminha as rotas do Django para o backend, e o browser só fala
// com um domínio. Isso mantém cookies de sessão/CSRF funcionais e permite
// aceder pela rede local mesmo quando o Django só escuta em localhost.
// Em desenvolvimento local, o backend é assumido em 127.0.0.1:8000; no
// Docker/produção, API_INTERNO deve apontar para o serviço Django.
const apiInterno = (() => {
  const valor = (process.env.API_INTERNO || "").trim().replace(/\/$/, "");
  if (valor) return /^https?:\/\//.test(valor) ? valor : `http://${valor}`;
  return process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "";
})();
const ROTAS_DJANGO = ["api", "accounts", "aluno", "media", "static", "admin"];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  allowedDevOrigins: Array.from(new Set([
    "192.168.1.250",
    "192.168.1.122",
    ...origensExtra,
  ])),
  ...(apiInterno && {
    // As rotas do Django terminam em "/": sem isto o Next redireciona
    // "/api/x/" para "/api/x" e o Django volta a pôr a barra (ciclo).
    skipTrailingSlashRedirect: true,
    experimental: {
      // Uploads de vídeos grandes em ligações lentas.
      proxyTimeout: 10 * 60 * 1000,
    },
    async rewrites() {
      // `:caminho*` perde a barra final — a regra com "/" no fim vem primeiro.
      return ROTAS_DJANGO.flatMap((rota) => [
        { source: `/${rota}/:caminho*/`, destination: `${apiInterno}/${rota}/:caminho*/` },
        { source: `/${rota}/:caminho*`, destination: `${apiInterno}/${rota}/:caminho*` },
      ]);
    },
  }),
};

export default nextConfig;
