import { createServerFn } from "@tanstack/react-start";
import { CONTEUDO_RE } from "./conteudo";

const PERMITIDOS = /(^|\.)(jw\.org|jw-cdn\.org|akamaihd\.net)$/i;

/** Canal direto com a cara de um navegador móvel comum. O WAF/CDN (Akamai)
 *  do jw.org costuma levar 8–10s no handshake inicial; o prazo de 15s dá
 *  folga para isso. O corte antigo em 8s abortava a conexão no meio do
 *  handshake — a causa real do "demorou demais pra responder". */
const AGENTE_MOVEL =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36";
const CABECALHOS: Record<string, string> = {
  "User-Agent": AGENTE_MOVEL,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
};
const PRAZO_DIRETO = 15000;

/** Cache de instância (5 min): tentativa repetida do mesmo URL — reabertura
 *  do sumário, artigo repetido do lote — não volta a bater no WAF. Pequeno
 *  de propósito: cada isolado do Workers vive pouco. */
const cache = new Map<string, { texto: string; url: string; expira: number }>();
const TEMPO_CACHE = 300000;
const CACHE_MAXIMO = 24;

function guardarCache(chave: string, texto: string, url: string) {
  if (cache.size >= CACHE_MAXIMO) {
    const maisAntiga = cache.keys().next().value;
    if (maisAntiga) cache.delete(maisAntiga);
  }
  cache.set(chave, { texto, url, expira: Date.now() + TEMPO_CACHE });
}

/** Validação por sinal positivo (DIRETRIZES nº 5): a página é boa quando tem
 *  elementos reais do jw.org — de qualquer tamanho. Artigos curtos da apostila
 *  e páginas de referência têm menos de 20 KB; a checagem antiga de tamanho os
 *  descartava como bloqueio (falso positivo, o erro mais caro da assimetria). */
async function examinar(r: Response): Promise<string> {
  const texto = await r.text();
  if (!texto.trim())
    throw new Error("jw.org devolveu uma resposta vazia (possível bloqueio de segurança)");
  const titulo = /<title[^>]*>([^<]*)<\/title>/i.exec(texto.slice(0, 4000))?.[1] ?? "";
  if (/não encontrada|not found/i.test(titulo))
    throw new Error("o jw.org respondeu que a página não existe (não é um bloqueio)");
  if (!CONTEUDO_RE.test(texto))
    throw new Error("a página veio sem conteúdo real do jw.org (possível bloqueio ou desafio)");
  return texto;
}

/** Uma tentativa no canal direto, assinando a recusa (DIRETRIZES nº 9).
 *  Devolve também a URL final — o jw.org redireciona links /open?docid para
 *  o endereço real do artigo, e o dedup de estudos precisa do endereço final. */
async function baixarDe(url: string): Promise<{ texto: string; urlFinal: string }> {
  let resposta: Response;
  try {
    resposta = await fetch(url, {
      headers: CABECALHOS,
      redirect: "follow",
      signal: AbortSignal.timeout(PRAZO_DIRETO),
    });
  } catch (e) {
    const nome = e instanceof Error ? `${e.name} ${e.message}` : String(e);
    throw new Error(
      /timeout|timed out|abort/i.test(nome)
        ? "direto: demorou demais para responder (tempo esgotado)"
        : `direto: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  if (resposta.status === 202 || resposta.headers.get("x-amzn-waf-action"))
    throw new Error(`direto: desafio de segurança do jw.org (HTTP ${resposta.status})`);
  if (!resposta.ok) throw new Error(`direto: HTTP ${resposta.status}`);
  try {
    const texto = await examinar(resposta);
    return { texto, urlFinal: resposta.url };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    throw new Error(/não existe/.test(m) ? m : `direto: ${m}`);
  }
}

export const baixarPagina = createServerFn({ method: "POST" })
  .inputValidator((d: { url: string }) => {
    const u = new URL(d.url);
    if (u.protocol !== "https:" || !PERMITIDOS.test(u.hostname))
      throw new Error("Apenas links do jw.org são permitidos.");
    return { url: u.href };
  })
  .handler(async ({ data }) => {
    const cacheExistente = cache.get(data.url);
    if (cacheExistente && cacheExistente.expira > Date.now())
      return { texto: cacheExistente.texto, url: cacheExistente.url };

    // Uma tentativa direta. Quando ela falha, o erro assinado sobe até o
    // fetchProxy (parser.ts), que cai para os proxies CORS do navegador —
    // o espelho do Google Tradutor saiu: o google.com/sorry limita por IP
    // de datacenter e quebrava em produção.
    const { texto, urlFinal } = await baixarDe(data.url);
    guardarCache(data.url, texto, urlFinal);
    return { texto, url: urlFinal || data.url };
  });
