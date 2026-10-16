"use client"
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { useReduzirAnimacoes } from "@/lib/preferencias-visuais";

export function PageTransition({
  routeKey,
  children,
}: {
  routeKey: string;
  children: ReactNode;
}) {
  // Sistema operativo OU Configurações → Aparência → Reduzir animações.
  const reduce = useReduzirAnimacoes();

  if (reduce) return <div>{children}</div>;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={routeKey}
        initial={{ opacity: 0, y: 12, filter: "blur(6px)", scale: 0.995 }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }}
        exit={{ opacity: 0, y: -10, filter: "blur(6px)", scale: 0.995 }}
        transition={{
          duration: 0.28,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}