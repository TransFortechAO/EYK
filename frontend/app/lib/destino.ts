// Para onde levar a pessoa depois de entrar (login, registo, definir senha).
// Ex: quem abre o link do convite da escola (/instituicao/aderir?codigo=…) sem
// sessão vai para o login e, depois de entrar, volta ao convite.
//
// O destino vai no endereço (?next=…) e fica também na sessão do browser, para
// sobreviver a percursos com vários passos (registo → personalizar perfil).

const CHAVE = "eyk-destino-depois-de-entrar";

/** Páginas de entrada: não faz sentido voltar a elas. */
const ENTRADA = ["/login", "/register", "/definir-senha", "/recuperar-senha", "/personalizar-perfil", "/verificar-email"];

/**
 * Só caminhos internos da app ("/…"), nunca outro site: impede usar o login
 * para redirecionar para endereços maliciosos ("//site", "https://site", "\\site").
 */
export function destinoSeguro(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const v = valor.trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return null;
  if ([...v].some((c) => c.charCodeAt(0) < 32)) return null; // caracteres de controlo
  const caminho = v.split(/[?#]/)[0];
  if (ENTRADA.some((e) => caminho === e || caminho.startsWith(e + "/"))) return null;
  if (caminho === "/" || caminho === "/inicio") return null;
  return v;
}

/** Guarda o sítio onde a pessoa estava (chamado antes de mandar para o login). */
export function guardarDestino(caminho: string) {
  const seguro = destinoSeguro(caminho);
  if (!seguro || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CHAVE, seguro);
  } catch {
    /* sem sessionStorage: fica só o ?next= do endereço */
  }
}

/** URL do login com o destino, ex: /login?next=%2Finstituicao%2Faderir%3Fcodigo%3DABC */
export function loginComDestino(caminho: string): string {
  const seguro = destinoSeguro(caminho);
  return seguro ? `/login?next=${encodeURIComponent(seguro)}` : "/login";
}

/**
 * O destino a usar depois de entrar: o ?next= do endereço atual ou o guardado
 * na sessão. Apaga-o (só se usa uma vez).
 */
export function consumirDestino(omissao = "/inicio"): string {
  if (typeof window === "undefined") return omissao;
  let guardado: string | null = null;
  try {
    guardado = window.sessionStorage.getItem(CHAVE);
    window.sessionStorage.removeItem(CHAVE);
  } catch {
    /* ignora */
  }
  const doEndereco = new URLSearchParams(window.location.search).get("next");
  return destinoSeguro(doEndereco) ?? destinoSeguro(guardado) ?? omissao;
}

/** Guarda o ?next= do endereço atual na sessão (ex: ao abrir o registo a partir do login). */
export function guardarDestinoDoEndereco() {
  if (typeof window === "undefined") return;
  const doEndereco = new URLSearchParams(window.location.search).get("next");
  if (doEndereco) guardarDestino(doEndereco);
}
