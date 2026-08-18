import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  // Fixa a raiz do workspace nesta pasta: há um package-lock.json extra em
  // EYK/ (raiz do repo) que faz o Next inferir a raiz errada e falhar a
  // resolver vendor chunks (ex: motion-dom, usado pelo framer-motion).
  outputFileTracingRoot: path.join(__dirname),
  // Permite aceder ao servidor de dev pelo IP da rede local (ex: a partir
  // do telemóvel), sem o aviso/bloqueio de "cross origin request" do Next
  // 15. Se o IP local mudar (DHCP), atualiza aqui.
  allowedDevOrigins: ['192.168.1.250'],
};

export default nextConfig;