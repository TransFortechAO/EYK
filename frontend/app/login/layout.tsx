import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Entrar · EYK",
  description: "Inicia sessão na plataforma EYK.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
