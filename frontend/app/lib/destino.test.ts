import { describe, expect, it } from "vitest";
import { destinoSeguro, loginComDestino } from "./destino";

describe("voltar ao sítio de onde se veio depois de entrar", () => {
  it("aceita caminhos internos, com o código do convite", () => {
    expect(destinoSeguro("/instituicao/aderir?codigo=LGA3A")).toBe("/instituicao/aderir?codigo=LGA3A");
    expect(destinoSeguro("/cursos/12")).toBe("/cursos/12");
  });

  it("recusa outros sites e endereços estranhos (redirecionamentos maliciosos)", () => {
    for (const mau of ["https://site.mau", "//site.mau", "/\\site.mau", "javascript:alert(1)", "site.mau", "/ok\n/x", ""]) {
      expect(destinoSeguro(mau)).toBeNull();
    }
    expect(destinoSeguro(null)).toBeNull();
  });

  it("não volta às páginas de entrada nem ao início (já é o destino por omissão)", () => {
    for (const entrada of ["/login", "/login?next=/x", "/register", "/definir-senha", "/personalizar-perfil", "/", "/inicio"]) {
      expect(destinoSeguro(entrada)).toBeNull();
    }
  });

  it("o login leva o destino no endereço", () => {
    expect(loginComDestino("/instituicao/aderir?codigo=LGA3A")).toBe("/login?next=%2Finstituicao%2Faderir%3Fcodigo%3DLGA3A");
    expect(loginComDestino("https://site.mau")).toBe("/login");
  });
});
