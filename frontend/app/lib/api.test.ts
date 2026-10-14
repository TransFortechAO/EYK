import { describe, it, expect, afterEach, vi } from "vitest";
import {
  mediaUrl,
  tempoRelativo,
  formatarDataCurta,
  formatarDuracaoCurta,
  formatarDuracaoLonga,
  mensagemDeErro,
  fetchAPI,
} from "./api";

describe("mediaUrl", () => {
  it("devolve null para caminhos vazios/nulos", () => {
    expect(mediaUrl(null)).toBeNull();
    expect(mediaUrl(undefined)).toBeNull();
    expect(mediaUrl("")).toBeNull();
  });

  it("deixa URLs absolutos (http/https) inalterados", () => {
    expect(mediaUrl("https://exemplo.com/foto.jpg")).toBe("https://exemplo.com/foto.jpg");
    expect(mediaUrl("http://192.168.1.5:8000/media/x.jpg")).toBe("http://192.168.1.5:8000/media/x.jpg");
  });

  it("antepõe API_BASE_URL a caminhos relativos", () => {
    expect(mediaUrl("/media/videos/x.mp4")).toBe("http://localhost:8000/media/videos/x.mp4");
  });

  it("insere a barra em falta quando o caminho relativo não começa por '/'", () => {
    expect(mediaUrl("media/videos/x.mp4")).toBe("http://localhost:8000/media/videos/x.mp4");
  });
});

describe("tempoRelativo", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("devolve string vazia quando não há data", () => {
    expect(tempoRelativo(null)).toBe("");
    expect(tempoRelativo(undefined)).toBe("");
  });

  it("devolve string vazia para uma data inválida (não rebenta)", () => {
    expect(tempoRelativo("isto-nao-e-uma-data")).toBe("");
  });

  it("'agora mesmo' para menos de 1 minuto", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:30Z"));
    expect(tempoRelativo("2026-01-01T12:00:00Z")).toBe("agora mesmo");
  });

  it("usa singular para exatamente 1 minuto/hora/dia", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:01:00Z"));
    expect(tempoRelativo("2026-01-01T12:00:00Z")).toBe("há 1 minuto");

    vi.setSystemTime(new Date("2026-01-01T13:00:00Z"));
    expect(tempoRelativo("2026-01-01T12:00:00Z")).toBe("há 1 hora");

    vi.setSystemTime(new Date("2026-01-02T12:00:00Z"));
    expect(tempoRelativo("2026-01-01T12:00:00Z")).toBe("há 1 dia");
  });

  it("usa plural para mais do que 1 unidade", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:05:00Z"));
    expect(tempoRelativo("2026-01-01T12:00:00Z")).toBe("há 5 minutos");

    vi.setSystemTime(new Date("2026-01-01T15:00:00Z"));
    expect(tempoRelativo("2026-01-01T12:00:00Z")).toBe("há 3 horas");

    vi.setSystemTime(new Date("2026-01-05T12:00:00Z"));
    expect(tempoRelativo("2026-01-01T12:00:00Z")).toBe("há 4 dias");
  });
});

describe("formatarDataCurta", () => {
  it("devolve string vazia quando não há data", () => {
    expect(formatarDataCurta(null)).toBe("");
    expect(formatarDataCurta(undefined)).toBe("");
  });

  it("formata uma data ISO em pt-PT", () => {
    const resultado = formatarDataCurta("2026-03-12T10:00:00Z");
    expect(resultado).toContain("2026");
    expect(resultado).toMatch(/12/);
  });

  it("bug real corrigido: uma data inválida mostrava o texto 'Invalid Date'", () => {
    expect(formatarDataCurta("isto-nao-e-uma-data")).toBe("");
  });
});

describe("formatarDuracaoCurta", () => {
  it("devolve string vazia para valores nulos/zero/negativos", () => {
    expect(formatarDuracaoCurta(null)).toBe("");
    expect(formatarDuracaoCurta(undefined)).toBe("");
    expect(formatarDuracaoCurta(0)).toBe("");
    expect(formatarDuracaoCurta(-5)).toBe("");
  });

  it("formata segundos como M:SS", () => {
    expect(formatarDuracaoCurta(5)).toBe("0:05");
    expect(formatarDuracaoCurta(65)).toBe("1:05");
    expect(formatarDuracaoCurta(600)).toBe("10:00");
  });

  it("nunca produz 'M:60' (segundos arredondados para a fronteira do minuto)", () => {
    // Bug real encontrado: Math.round(59.6 % 60) dava 60 em vez de transitar
    // para o minuto seguinte. Com segundos inteiros isto não ocorria aqui,
    // mas a correção cobre também uma eventual entrada fracionária.
    expect(formatarDuracaoCurta(59.6)).toBe("1:00");
    expect(formatarDuracaoCurta(119.5)).toBe("2:00");
  });
});

describe("formatarDuracaoLonga", () => {
  it("devolve string vazia para valores nulos/zero/negativos", () => {
    expect(formatarDuracaoLonga(null)).toBe("");
    expect(formatarDuracaoLonga(undefined)).toBe("");
    expect(formatarDuracaoLonga(0)).toBe("");
    expect(formatarDuracaoLonga(-10)).toBe("");
  });

  it("mostra só minutos quando dura menos de 1 hora", () => {
    expect(formatarDuracaoLonga(60)).toBe("1min");
    expect(formatarDuracaoLonga(1500)).toBe("25min");
  });

  it("mostra só horas quando os minutos são exatamente zero", () => {
    expect(formatarDuracaoLonga(3600)).toBe("1h");
    expect(formatarDuracaoLonga(7200)).toBe("2h");
  });

  it("mostra horas e minutos combinados", () => {
    expect(formatarDuracaoLonga(4500)).toBe("1h 15min");
  });

  it("bug real corrigido: 59m30s–59m59s mostrava '60min' em vez de '1h'", () => {
    for (let s = 3570; s <= 3599; s++) {
      expect(formatarDuracaoLonga(s)).toBe("1h");
    }
  });

  it("a mesma janela de arredondamento repete-se em cada fronteira de hora", () => {
    for (let s = 7170; s <= 7199; s++) {
      expect(formatarDuracaoLonga(s)).toBe("2h");
    }
  });
});

describe("mensagemDeErro", () => {
  it("usa o `error` devolvido pelas views JSON do Django", () => {
    expect(mensagemDeErro({ data: { error: "Link expirado." } }, "fallback")).toBe("Link expirado.");
  });

  it("usa o `detail` devolvido pelas views DRF", () => {
    expect(mensagemDeErro({ data: { detail: "Só alunos inscritos." } }, "fallback")).toBe("Só alunos inscritos.");
  });

  it("cai para o texto por omissão quando não há mensagem do servidor", () => {
    expect(mensagemDeErro(new Error("500 Internal Server Error"), "Algo falhou.")).toBe("Algo falhou.");
    expect(mensagemDeErro(null, "Algo falhou.")).toBe("Algo falhou.");
  });
});

describe("fetchAPI — erros", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("anexa o corpo JSON do erro em `err.data` e inclui o `detail` na mensagem", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ detail: "Sem permissão." }), { status: 403, statusText: "Forbidden" })),
    );
    const err = (await fetchAPI("/api/x/").catch((e: unknown) => e)) as Error & { status: number };
    expect(err.status).toBe(403);
    expect(err.message).toBe("403 Forbidden: Sem permissão.");
    expect(mensagemDeErro(err, "x")).toBe("Sem permissão.");
  });
});
