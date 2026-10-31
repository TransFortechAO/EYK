"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, GraduationCap, LayoutDashboard, Video, X } from "lucide-react";
import { useAuth } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const CHAVE = "eyk-boas-vindas-professor-fechada";

/**
 * Mensagem de boas-vindas no Início para quem é professor: deixa claro que
 * entrou como professor e leva às suas ferramentas. Fecha-se até à próxima sessão.
 */
export function BoasVindasProfessor() {
  const { user } = useAuth();
  const [fechada, setFechada] = useState(true);

  useEffect(() => {
    try {
      setFechada(window.sessionStorage.getItem(CHAVE) === "1");
    } catch {
      setFechada(false);
    }
  }, []);

  if (!user?.isTeacher || fechada) return null;

  const primeiroNome = user.name?.split(" ")[0] || "Professor";

  const fechar = () => {
    setFechada(true);
    try {
      window.sessionStorage.setItem(CHAVE, "1");
    } catch {
      /* sem sessionStorage: volta a aparecer ao recarregar */
    }
  };

  return (
    <Card className="relative overflow-hidden border-primary/30 bg-primary/5 p-5 shadow-soft sm:p-6">
      <button
        type="button"
        onClick={fechar}
        className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground transition hover:bg-surface hover:text-foreground"
        aria-label="Fechar mensagem"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-4 pr-6">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-gold text-primary-foreground shadow-gold">
          <GraduationCap className="h-6 w-6" />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="font-serif text-xl font-semibold">Bem-vindo(a), professor(a) {primeiroNome}!</p>
          <p className="text-sm text-muted-foreground">
            Que bom ter-te por cá. Os teus alunos contam contigo para aprender LGA — partilha um curso ou um
            vídeo novo e acompanha tudo no teu painel.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild size="sm" className="gap-2 bg-gradient-gold text-primary-foreground hover:opacity-95">
          <Link href="/professor">
            <LayoutDashboard className="h-4 w-4" /> Abrir o meu painel
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="gap-2">
          <Link href="/professor/cursos">
            <BookOpen className="h-4 w-4" /> Meus cursos
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="gap-2">
          <Link href="/professor/videos">
            <Video className="h-4 w-4" /> Meus vídeos
          </Link>
        </Button>
      </div>
    </Card>
  );
}
