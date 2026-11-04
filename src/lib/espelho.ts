/** Espelho de emergência via Google Tradutor (`_x_tr_pto=wapp`).
 *
 *  Quando o jw.org bloqueia o servidor do app (WAF responde 202 vazio ou
 *  segura a conexão), o espelho busca a MESMA página a partir da infra do
 *  Google e devolve o HTML original — sem traduzir — com CORS suficiente
 *  para a função de servidor. Módulo puro, sem dependências, para poder ser
 *  testado isoladamente (DIRETRIZES nº 2 e 7: validar contra amostra real).
 *
 *  O HTML do espelho vem com os links reescritos; `desfazerEspelho` os
 *  devolve ao formato original do jw.org antes do parser. */

const PARAMS_ESPELHO = "_x_tr_sl=auto&_x_tr_tl=en&_x_tr_hl=en&_x_tr_pto=wapp";

/** www.jw.org/pt/x?a=b → https://www-jw-org.translate.goog/pt/x?a=b&_x_tr_…
 *  (o espelho devolve o HTML original; os parâmetros só dirigem o tradutor). */
export function urlEspelho(u: string): string {
  const x = new URL(u);
  const host = x.hostname.replaceAll(".", "-");
  const consulta = x.search ? `${x.search.slice(1)}&${PARAMS_ESPELHO}` : PARAMS_ESPELHO;
  return `https://${host}.translate.goog${x.pathname}?${consulta}`;
}

/** Hosts do jw.org que aparecem na forma de caminho do espelho
 *  (`https://www-jw-org.translate.goog/…` → `https://www.jw.org/…`). */
const HOSTS_DE_ORIGEM: [string, string][] = [
  ["https://www-jw-org.translate.goog", "https://www.jw.org"],
  ["https://wol-jw-org.translate.goog", "https://wol.jw.org"],
  ["https://b-jw-cdn-org.translate.goog", "https://b.jw-cdn.org"],
];

const EMBRULHO_RE = /https:\/\/translate\.google\.com\/website\?[^"'\s]*?(?:&amp;|&)u=([^&"'\s]+)/g;

/** Desfaz as reescritas do espelho:
 *  1. wrappers `translate.google.com/website?…&u=<url codificada>` → url original;
 *  2. hosts na forma de caminho (`www-jw-org.translate.goog`) → host real;
 *  3. entidades `&amp;` remanescentes nas urls decodificadas → `&`.
 *  O parser precisa ver os links exatamente como numa página direta do jw.org. */
export function desfazerEspelho(html: string): string {
  let semWrappers = html.replace(EMBRULHO_RE, (_, codificada: string) => {
    try {
      return decodeURIComponent(codificada).replaceAll("&amp;", "&");
    } catch {
      return codificada;
    }
  });
  for (const [espelhado, original] of HOSTS_DE_ORIGEM)
    semWrappers = semWrappers.replaceAll(espelhado, original);
  return semWrappers;
}
