import path from "path";
import type { NextConfig } from "next";

// Hostnames/IPs usados para abrir o Next.js a partir de outros dispositivos.
// Se o IP do servidor mudar, atualiza NEXT_ALLOWED_DEV_ORIGINS_EXTRA no .env.local.
const origensExtra = (process.env.NEXT_ALLOWED_DEV_ORIGINS_EXTRA || "")
  .split(",")
  .map((origem) => origem.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  allowedDevOrigins: Array.from(new Set([
    "192.168.1.250",
    "192.168.1.122",
    ...origensExtra,
  ])),
};

export default nextConfig;
