import path from "path";
import type { NextConfig } from "next";

// Hostnames/IPs usados para abrir o Next.js a partir de outros dispositivos.
// Se o IP do servidor mudar, atualiza NEXT_ALLOWED_DEV_ORIGINS_EXTRA no .env.local.
const origensExtra = (process.env.NEXT_ALLOWED_DEV_ORIGINS_EXTRA || "")
  .split(",")
  .map((origem) => origem.trim())
  .filter(Boolean);

// Produção (Render): o Next.js reencaminha as rotas do Django para o backend,
// e o browser só fala com um domínio. Assim os cookies de sessão e CSRF são
// do próprio site — com frontend e API em domínios diferentes (ex: dois
// *.onrender.com) seriam cookies de terceiros, que o Safari e o Chrome
// bloqueiam. Com isto ligado, NEXT_PUBLIC_API_URL deve ser "/".
// Lido no build: definir API_INTERNO antes de `npm run build`. No Render é o
// "host:porta" interno do serviço eyk-api (ver render.yaml).
const apiInterno = (() => {
  const valor = (process.env.API_INTERNO || "").trim().replace(/\/$/, "");
  return valor && !/^https?:\/\//.test(valor) ? `http://${valor}` : valor;
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
