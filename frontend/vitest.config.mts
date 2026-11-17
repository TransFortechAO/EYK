import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // O tsconfig deixa o JSX para o Next (jsx: preserve); nos testes transforma-se aqui.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./app"),
    },
  },
  test: {
    environment: "node",
    include: ["app/**/*.test.ts", "app/**/*.test.tsx"],
  },
});
