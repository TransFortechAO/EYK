import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  // Fixa a raiz do workspace nesta pasta: há um package-lock.json extra em
  // EYK/ (raiz do repo) que faz o Next inferir a raiz errada e falhar a
  // resolver vendor chunks (ex: motion-dom, usado pelo framer-motion).
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;