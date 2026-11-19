import { describe, expect, it } from "vitest";
import { comprimirVideo, dimensoesDeSaida, precisaDeComprimir } from "./comprimir-video";

const MB = 1024 * 1024;

describe("compressão de vídeo no browser", () => {
  it("o lado curto passa a 720, na horizontal e na vertical, em números pares", () => {
    expect(dimensoesDeSaida(1920, 1080)).toEqual({ largura: 1280, altura: 720 });
    expect(dimensoesDeSaida(1080, 1920)).toEqual({ largura: 720, altura: 1280 });
    expect(dimensoesDeSaida(3840, 2160)).toEqual({ largura: 1280, altura: 720 });
    expect(dimensoesDeSaida(1438, 1078)).toEqual({ largura: 960, altura: 720 });
  });

  it("nunca aumenta um vídeo mais pequeno", () => {
    expect(dimensoesDeSaida(640, 360)).toEqual({ largura: 640, altura: 360 });
  });

  it("comprime quando o ficheiro fica bem mais pequeno (vídeos de telemóvel)", () => {
    expect(precisaDeComprimir(120 * MB, 60)).toBe(true); // ~16 Mbps (1080p de telemóvel)
    expect(precisaDeComprimir(40 * MB, 60)).toBe(true); // ~5,6 Mbps
  });

  it("não perde tempo com o que já é leve", () => {
    expect(precisaDeComprimir(10 * MB, 30)).toBe(false); // pequeno
    expect(precisaDeComprimir(20 * MB, 60)).toBe(false); // ~2,8 Mbps: pouco a ganhar
    expect(precisaDeComprimir(500 * MB, 0)).toBe(false); // duração desconhecida
    expect(precisaDeComprimir(5000 * MB, 2 * 3600)).toBe(false); // longo demais para a memória
  });

  it("sem WebCodecs (ou fora do browser) segue o ficheiro original", async () => {
    const original = new File([new Uint8Array(20 * MB)], "aula.mov", { type: "video/quicktime" });
    expect(await comprimirVideo(original)).toBe(original);
  });
});
