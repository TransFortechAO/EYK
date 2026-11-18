import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _reporEnvioDireto, _semEsperaEntreTentativas, enviarFicheiros } from "./envio-direto";

type Pedido = { metodo: string; url: string; cabecalhos: Record<string, string>; corpo: unknown };

/** Faz de XMLHttpRequest: regista o PUT e responde como o bucket responderia. */
function xhrFalso(registo: Pedido[], estado: () => number | "rede") {
  return class {
    upload: { onprogress: ((e: { loaded: number }) => void) | null } = { onprogress: null };
    getResponseHeader(nome: string) {
      return nome === "ETag" ? `"etag-${registo.length}"` : null;
    }
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    status = 0;
    private pedido: Pedido = { metodo: "", url: "", cabecalhos: {}, corpo: null };
    open(metodo: string, url: string) {
      this.pedido = { ...this.pedido, metodo, url };
    }
    setRequestHeader(nome: string, valor: string) {
      this.pedido.cabecalhos[nome] = valor;
    }
    send(corpo: File) {
      this.pedido.corpo = corpo;
      registo.push(this.pedido);
      const e = estado();
      setTimeout(() => {
        if (e === "rede") return this.onerror?.();
        this.upload.onprogress?.({ loaded: corpo.size / 2 });
        this.status = e;
        this.onload?.();
      }, 0);
    }
  };
}

let proximoId = 1;
function fetchFalso(direto = true) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (!String(url).includes("/api/professor/envios/")) {
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    }
    const corpo = JSON.parse(String(init?.body));
    const resposta = direto
      ? { direto: true, id: proximoId++, url: `https://b2/${corpo.nome}?sig`, metodo: "PUT", cabecalhos: { "Content-Type": corpo.tipo } }
      : { direto: false };
    return new Response(JSON.stringify(resposta), { status: direto ? 201 : 200, headers: { "Content-Type": "application/json" } });
  });
}

const ficheiro = (nome: string, bytes = 100, tipo = "video/mp4") => new File([new Uint8Array(bytes)], nome, { type: tipo });

beforeEach(() => {
  _reporEnvioDireto();
  _semEsperaEntreTentativas();
  proximoId = 1;
});
afterEach(() => vi.unstubAllGlobals());

describe("envio direto", () => {
  it("sem bucket devolve null (os ficheiros seguem pelo servidor)", async () => {
    vi.stubGlobal("fetch", fetchFalso(false));
    expect(await enviarFicheiros([{ ficheiro: ficheiro("a.mp4"), finalidade: "video" }])).toBeNull();
  });

  it("envia cada ficheiro para o seu link e devolve os números pela ordem", async () => {
    const registo: Pedido[] = [];
    vi.stubGlobal("fetch", fetchFalso());
    vi.stubGlobal("XMLHttpRequest", xhrFalso(registo, () => 200));
    const progresso: number[] = [];
    const ids = await enviarFicheiros(
      [
        { ficheiro: ficheiro("a1.mp4"), finalidade: "aula" },
        { ficheiro: ficheiro("a2.mp4"), finalidade: "aula" },
        { ficheiro: ficheiro("guia.pdf", 50, "application/pdf"), finalidade: "recurso_curso" },
      ],
      (p) => progresso.push(p),
    );
    expect(ids).toEqual([1, 2, 3]);
    expect(registo.map((p) => p.url)).toEqual(["https://b2/a1.mp4?sig", "https://b2/a2.mp4?sig", "https://b2/guia.pdf?sig"]);
    expect(registo.every((p) => p.metodo === "PUT")).toBe(true);
    expect(registo[2].cabecalhos).toEqual({ "Content-Type": "application/pdf" });
    expect(progresso.at(-1)).toBe(100);
    expect(progresso).toEqual([...progresso].sort((a, b) => a - b));
  });

  it("com o CORS do bucket por configurar, volta ao servidor e não insiste", async () => {
    const registo: Pedido[] = [];
    const pedidos = fetchFalso();
    vi.stubGlobal("fetch", pedidos);
    vi.stubGlobal("XMLHttpRequest", xhrFalso(registo, () => "rede"));
    expect(await enviarFicheiros([{ ficheiro: ficheiro("a.mp4"), finalidade: "video" }])).toBeNull();
    expect(await enviarFicheiros([{ ficheiro: ficheiro("b.mp4"), finalidade: "video" }])).toBeNull();
    const aosEnvios = pedidos.mock.calls.filter(([url]) => String(url).includes("/api/professor/envios/"));
    expect(aosEnvios).toHaveLength(1);
  });

  it("um erro do bucket aparece ao professor", async () => {
    vi.stubGlobal("fetch", fetchFalso());
    vi.stubGlobal("XMLHttpRequest", xhrFalso([], () => 403));
    await expect(enviarFicheiros([{ ficheiro: ficheiro("a.mp4"), finalidade: "video" }])).rejects.toThrow(
      'Não foi possível enviar "a.mp4" para o armazenamento (erro 403)',
    );
  });

  it("sem ficheiros não pede nada", async () => {
    const pedidos = fetchFalso();
    vi.stubGlobal("fetch", pedidos);
    expect(await enviarFicheiros([])).toEqual([]);
    expect(pedidos.mock.calls.filter(([url]) => String(url).includes("/envios/"))).toHaveLength(0);
  });

  it("um erro passageiro do bucket repete-se sem falhar o envio", async () => {
    const registo: Pedido[] = [];
    const respostas = [503, 200];
    vi.stubGlobal("fetch", fetchFalso());
    vi.stubGlobal("XMLHttpRequest", xhrFalso(registo, () => respostas.shift() ?? 200));
    expect(await enviarFicheiros([{ ficheiro: ficheiro("a.mp4"), finalidade: "video" }])).toEqual([1]);
    expect(registo).toHaveLength(2);
  });

  it("ficheiros grandes vão em partes em paralelo e são juntados no fim", async () => {
    const registo: Pedido[] = [];
    const conclusoes: unknown[] = [];
    vi.stubGlobal("XMLHttpRequest", xhrFalso(registo, () => 200));
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const json = (corpo: unknown, status = 200) =>
        new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
      if (String(url).includes("/concluir/")) {
        conclusoes.push(JSON.parse(String(init?.body)));
        return json({ ok: true });
      }
      if (!String(url).includes("/api/professor/envios/")) return json({});
      return json({
        direto: true, id: 9,
        partes: [
          { numero: 1, inicio: 0, tamanho: 40, url: "https://b2/p1" },
          { numero: 2, inicio: 40, tamanho: 40, url: "https://b2/p2" },
          { numero: 3, inicio: 80, tamanho: 20, url: "https://b2/p3" },
        ],
      }, 201);
    }));
    const progresso: number[] = [];
    const ids = await enviarFicheiros([{ ficheiro: ficheiro("grande.mp4", 100), finalidade: "video" }], (p) => progresso.push(p));
    expect(ids).toEqual([9]);
    expect(registo.map((p) => [p.url, (p.corpo as Blob).size])).toEqual([
      ["https://b2/p1", 40], ["https://b2/p2", 40], ["https://b2/p3", 20],
    ]);
    // As partes não levam Content-Type (não foi assinado nelas).
    expect(registo.every((p) => Object.keys(p.cabecalhos).length === 0)).toBe(true);
    const fim = conclusoes[0] as { partes: { numero: number; etag: string }[] };
    expect(fim.partes.map((p) => p.numero).sort()).toEqual([1, 2, 3]);
    expect(fim.partes.every((p) => p.etag.startsWith('"etag-'))).toBe(true);
    expect(progresso.at(-1)).toBe(100);
  });
});
