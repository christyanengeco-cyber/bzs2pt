import { createServerFn } from "@tanstack/react-start";
import { CONTEUDO_RE } from "./conteudo";
import { sondarMidia } from "./sonda-midia";

const PERMITIDOS = /(^|\.)(jw\.org|jw-cdn\.org|akamaihd\.net)$/i;

/** Calibrado com a apostila e suas referências: o perfil Chrome recebia
 *  HTTP 202 vazio; JW Library recebia HTML com conteúdo real. Isso não
 *  garante acesso futuro: continuamos validando a resposta, não o agente. */
const CABECALHOS: Record<string, string> = {
  "User-Agent": "JW Library",
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
async function examinar(r: Response, url: string): Promise<string> {
  const texto = await r.text();
  if (!texto.trim() && (r.status === 202 || r.headers.get("x-amzn-waf-action")))
    throw new Error(`desafio de segurança do jw.org sem conteúdo (HTTP ${r.status})`);
  if (!texto.trim())
    throw new Error("jw.org devolveu uma resposta vazia (possível bloqueio de segurança)");
  const alvo = new URL(url);
  if (/(^|\.)jw-cdn\.org$/i.test(alvo.hostname) && alvo.pathname === "/apis/pub-media/GETPUBMEDIALINKS") {
    try {
      const json: unknown = JSON.parse(texto);
      if (json && typeof json === "object" && "files" in json) return texto;
    } catch { /* Retém o diagnóstico de resposta inválida. */ }
    throw new Error("API de mídia: resposta sem JSON válido de arquivos");
  }
  if (/^WEBVTT\b/.test(texto.trim())) return texto;
  const titulo = /<title[^>]*>([^<]*)<\/title>/i.exec(texto.slice(0, 4000))?.[1] ?? "";
  if (/não encontrada|not found/i.test(titulo))
    throw new Error("o jw.org respondeu que a página não existe (não é um bloqueio)");
  if (!CONTEUDO_RE.test(texto) && (r.status === 202 || r.headers.get("x-amzn-waf-action")))
    throw new Error(`desafio de segurança do jw.org sem conteúdo (HTTP ${r.status})`);
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
  if (!resposta.ok) throw new Error(`direto: HTTP ${resposta.status}`);
  try {
    const texto = await examinar(resposta, url);
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

/** Confirmação de existência de uma variante de mídia no CDN (usada pela
 *  recuperação de qualidade dos estudos salvos). Mesma porta de entrada do
 *  baixarPagina: só endereço do jw.org e afins. */
export const verificarMidia = createServerFn({ method: "POST" })
  .inputValidator((d: { url: string }) => {
    const u = new URL(d.url);
    if (u.protocol !== "https:" || !PERMITIDOS.test(u.hostname))
      throw new Error("Apenas links do jw.org são permitidos.");
    return { url: u.href };
  })
  .handler(async ({ data }) => sondarMidia(data.url));
