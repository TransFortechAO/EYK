/* Service worker da EYK (PWA).
 *
 * - Páginas: rede primeiro, cache como recurso quando não há internet.
 * - Ficheiros estáticos do Next (/_next/static, com hash no nome): cache primeiro.
 * - Pedidos GET à API de leitura (cursos, vídeos, sessão): rede primeiro, cache
 *   quando offline — assim uma aula já aberta volta a abrir sem internet.
 * - Vídeos guardados para ver offline (cache "eyk-videos-v1", preenchida pela
 *   app em app/lib/offline.ts): servidos da cache, com suporte a pedidos
 *   Range (o <video> pede o ficheiro aos bocados para poder avançar/recuar).
 *
 * Os nomes das caches têm de bater certo com app/lib/offline.ts.
 */
const VERSAO = "v1";
const CACHE_PAGINAS = `eyk-paginas-${VERSAO}`;
const CACHE_ESTATICOS = `eyk-estaticos-${VERSAO}`;
const CACHE_API = `eyk-api-${VERSAO}`;
const CACHE_VIDEOS = `eyk-videos-${VERSAO}`;
const CACHES_ATUAIS = [CACHE_PAGINAS, CACHE_ESTATICOS, CACHE_API, CACHE_VIDEOS];

const PAGINAS_INICIAIS = ["/inicio", "/manifest.webmanifest", "/icons/icon-192.png"];

// Endpoints de leitura que vale a pena ter offline. Nada de escrita, nada de admin.
const API_OFFLINE = [
  /\/accounts\/auth\/me\/$/,
  /\/api\/cursos\/(\d+\/)?$/,
  /\/api\/videos\/(\d+\/)?(\?.*)?$/,
  /\/api\/videos\/\d+\/comentarios\/$/,
  /\/api\/categorias\/$/,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_PAGINAS)
      .then((cache) => cache.addAll(PAGINAS_INICIAIS))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nomes) =>
        Promise.all(
          nomes
            .filter((n) => n.startsWith("eyk-") && !CACHES_ATUAIS.includes(n))
            .map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  // Enviado pela app ao terminar sessão: dados da API em cache são pessoais.
  if (event.data && event.data.tipo === "limpar-cache-api") {
    event.waitUntil(caches.delete(CACHE_API));
  }
});

function eVideo(url) {
  return url.pathname.includes("/media/videos/") && !url.pathname.includes("/thumbs/");
}

async function respostaDeVideoEmCache(request) {
  const cache = await caches.open(CACHE_VIDEOS);
  const guardada = await cache.match(request.url, { ignoreVary: true, ignoreSearch: true });
  if (!guardada) return null;

  const range = request.headers.get("range");
  if (!range) return guardada;

  const blob = await guardada.blob();
  const tamanho = blob.size;
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  let inicio = m && m[1] ? parseInt(m[1], 10) : 0;
  let fim = m && m[2] ? parseInt(m[2], 10) : tamanho - 1;
  if (m && !m[1] && m[2]) {
    // "bytes=-500" → os últimos 500 bytes
    inicio = Math.max(tamanho - parseInt(m[2], 10), 0);
    fim = tamanho - 1;
  }
  fim = Math.min(fim, tamanho - 1);
  if (inicio >= tamanho || inicio > fim) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${tamanho}` } });
  }
  const parte = blob.slice(inicio, fim + 1);
  return new Response(parte, {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Content-Type": guardada.headers.get("Content-Type") || "video/mp4",
      "Content-Length": String(parte.size),
      "Content-Range": `bytes ${inicio}-${fim}/${tamanho}`,
      "Accept-Ranges": "bytes",
    },
  });
}

async function redePrimeiro(request, nomeCache, fallback) {
  const cache = await caches.open(nomeCache);
  try {
    const resposta = await fetch(request);
    if (resposta && resposta.ok) cache.put(request, resposta.clone());
    return resposta;
  } catch (erro) {
    const guardada = await cache.match(request, { ignoreVary: true });
    if (guardada) return guardada;
    if (fallback) {
      const alternativa = await cache.match(fallback);
      if (alternativa) return alternativa;
    }
    throw erro;
  }
}

async function cachePrimeiro(request, nomeCache) {
  const cache = await caches.open(nomeCache);
  const guardada = await cache.match(request);
  if (guardada) return guardada;
  const resposta = await fetch(request);
  if (resposta && resposta.ok) cache.put(request, resposta.clone());
  return resposta;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (eVideo(url)) {
    // Vídeo guardado offline → servido da cache; senão segue para a rede.
    event.respondWith(
      respostaDeVideoEmCache(request).then((resposta) => resposta || fetch(request)),
    );
    return;
  }

  // A API pode estar noutro domínio/porta (dev: :8000) ou atrás do mesmo
  // domínio (proxy em produção) — por isso é testada antes da origem.
  if (API_OFFLINE.some((re) => re.test(url.pathname + url.search))) {
    event.respondWith(redePrimeiro(request, CACHE_API));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cachePrimeiro(request, CACHE_ESTATICOS));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(redePrimeiro(request, CACHE_PAGINAS, "/inicio"));
  }
});
