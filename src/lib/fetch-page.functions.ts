import { createServerFn } from "@tanstack/react-start";
import { desfazerEspelho, urlEspelho } from "./espelho";

const PERMITIDOS = /(^|\.)(jw\.org|jw-cdn\.org|akamaihd\.net)$/i;

/** Corpos-desafio do WAF (CloudFront/AWS WAF) chegam com HTTP 200 plausível;
 *  sem esse filtro eram tratados como conteúdo e a extração falhava em silêncio. */
const DESAFIO_RE = /awswaf|challenge\.js|cdn-cgi\/challenge|cf-challenge|captcha-delivery/i;

// Alterna o agente entre tentativas: o WAF às vezes libera um perfil e trava outro.
const AGENTES = [
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
];

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sinal positivo de conteúdo (DIRETRIZES nº 5): uma página real do jw.org é
 *  grande e tem marcadores de conteúdo; a checagem negativa do WAF só decide
 *  na ausência desse sinal. A página de "não encontrada" veio calibrada com
 *  amostra real (≈160 KB, com marcadores e título próprio) — por isso o
 *  título também é examinado. */
async function examinar(r: Response): Promise<string> {
  const texto = await r.text();
  if (!texto.trim())
    throw new Error("jw.org devolveu uma resposta vazia (possível bloqueio de segurança)");
  const temConteudo =
    texto.length > 20000 && /<article|bodyTxt|docSubContent|<main|mediaItems/i.test(texto);
  const titulo = /<title[^>]*>([^<]*)<\/title>/i.exec(texto.slice(0, 4000))?.[1] ?? "";
  if (/não encontrada|not found/i.test(titulo))
    throw new Error("o jw.org respondeu que a página não existe (não é um bloqueio)");
  if (!temConteudo || DESAFIO_RE.test(texto.slice(0, 5000)))
    throw new Error("o jw.org está exigindo verificação de segurança (página-desafio)");
  return texto;
}

/** Uma tentativa em um canal. Falha nomeando o canal (DIRETRIZES nº 9). */
async function baixarDe(
  url: string,
  cabecalhos: HeadersInit,
  prazoMs: number,
  rotulo: string,
): Promise<string> {
  let resposta: Response;
  try {
    resposta = await fetch(url, {
      headers: cabecalhos,
      redirect: "follow",
      signal: AbortSignal.timeout(prazoMs),
    });
  } catch (e) {
    const nome = e instanceof Error ? `${e.name} ${e.message}` : String(e);
    throw new Error(
      /timeout|timed out|abort/i.test(nome)
        ? `${rotulo}: demorou demais para responder (tempo esgotado)`
        : `${rotulo}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  if (resposta.status === 202 || resposta.headers.get("x-amzn-waf-action"))
    throw new Error(`${rotulo}: desafio de segurança do jw.org (HTTP ${resposta.status})`);
  if (!resposta.ok) throw new Error(`${rotulo}: HTTP ${resposta.status}`);
  try {
    return await examinar(resposta);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    throw new Error(/não existe/.test(m) ? m : `${rotulo}: ${m}`);
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
    let motivo = "";
    // Prazo total de ~55s. Em cada rodada: 1) tentativa direta — a primeira com
    // prazo curto, para um bloqueio do WAF virar espelho em segundos e não em
    // minuto; 2) espelho de emergência pelo Google, que busca a mesma página
    // fora do alcance do WAF e devolve o HTML original (não traduzido). Cada
    // falha nomeia o canal (DIRETRIZES nº 9). O desafio do WAF costuma passar
    // na segunda tentativa, então continuamos enquanto houver prazo.
    const PRAZO_TOTAL = 55000;
    const inicio = Date.now();
    for (let rodada = 0; Date.now() - inicio < PRAZO_TOTAL; rodada++) {
      const restante = PRAZO_TOTAL - (Date.now() - inicio);
      try {
        const texto = await baixarDe(
          data.url,
          {
            "User-Agent": AGENTES[rodada % AGENTES.length]!,
            Accept: "text/html,application/json,*/*",
            "Accept-Language": "pt-BR,pt;q=0.9",
          },
          Math.min(restante - 1000, rodada === 0 ? 12000 : 30000),
          "direto",
        );
        return { texto, url: data.url };
      } catch (e) {
        motivo = e instanceof Error ? e.message : String(e);
        // "página não existe" é resposta definitiva do jw.org — não há o que tentar de novo.
        if (/não existe/.test(motivo)) throw e;
        await pausa(700 * (rodada + 1));
      }
      if (Date.now() - inicio >= PRAZO_TOTAL) break;
      const restante2 = PRAZO_TOTAL - (Date.now() - inicio);
      try {
        const texto = await baixarDe(
          urlEspelho(data.url),
          { Accept: "text/html,*/*", "Accept-Language": "pt-BR,pt;q=0.9" },
          Math.min(restante2 - 1000, 20000),
          "espelho",
        );
        return { texto: desfazerEspelho(texto), url: data.url };
      } catch (e) {
        motivo = e instanceof Error ? e.message : String(e);
        if (/não existe/.test(motivo)) throw e;
        await pausa(700 * (rodada + 1));
      }
    }
    throw new Error(motivo || "jw.org não respondeu com conteúdo");
  });
