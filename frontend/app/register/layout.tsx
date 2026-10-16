import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Criar conta · EYK",
  description: "Cria a tua conta na plataforma EYK.",
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}