import { PREFIXO_SERVIDOR } from "./servidor";

/**
 * A mesma API para as duas origens: instituições reais (id "srv-…") vão ao servidor;
 * as de demonstração (pré-visualização "Ver como" e testes) continuam em memória.
 */
export function encaminhar<T extends object>(demo: T, real: object): T {
  const doServidor = real as Record<string | symbol, unknown>;
  return new Proxy(demo, {
    get(alvo, nome, recetor) {
      const local = Reflect.get(alvo, nome, recetor);
      const remoto = doServidor[nome];
      if (typeof local !== "function" || typeof remoto !== "function") return local;
      return (...args: unknown[]) => {
        const naoDemo = typeof args[0] === "string" && args[0].startsWith(PREFIXO_SERVIDOR);
        return (naoDemo ? remoto : local).apply(naoDemo ? doServidor : alvo, args);
      };
    },
  });
}
