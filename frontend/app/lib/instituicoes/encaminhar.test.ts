import { describe, expect, it } from "vitest";
import { apiInstituicoes } from "./api";
import { encaminhar } from "./encaminhar";
import { apiLga } from "./lga";
import { apiEscolaReal } from "./servidor";
import { apiLgaReal } from "./servidor-lga";

// Operações que não pertencem a uma instituição (a conta, o código de convite, a equipa EYK).
const SO_LOCAL = new Set(["minhasPertencas", "consultarCodigo", "aderir", "textoConsentimento", "eyk"]);

const metodos = (o: object) => Object.keys(o).filter((k) => !SO_LOCAL.has(k));

describe("instituições reais", () => {
  it("nenhuma operação de uma escola real fica nos dados locais", () => {
    expect(metodos(apiInstituicoes).filter((k) => !(k in apiEscolaReal))).toEqual([]);
    expect(metodos(apiLga).filter((k) => !(k in apiLgaReal))).toEqual([]);
  });

  it("encaminha pelo id: srv-… vai ao servidor, o resto fica na demonstração", () => {
    const demo: { listar: (id: string) => string } = { listar: () => "demo" };
    const real: { listar: (id: string) => string } = { listar: () => "real" };
    const api = encaminhar(demo, real);
    expect(api.listar("srv-1")).toBe("real");
    expect(api.listar("inst-1")).toBe("demo");
  });
});
