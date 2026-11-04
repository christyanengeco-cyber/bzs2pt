import { createServerFn } from "@tanstack/react-start";
import { desfazerEspelho, MODOS_ESPELHO, urlEspelho } from "./espelho";

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

/** Cache de instância (5 min): o mesmo URL pedido de novo — tentativa repetida
 *  de artigo, reabertura do sumário — não volta a bater no WAF nem no limite
 *  de rajada do espelho. Pequeno de propósito: cada isolado do Workers vive pouco. */
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

/** Uma tentativa em um canal. Falha nomeando o canal (DIRETRIZES nº 9).
 *  Devolve também a URL final — o jw.org redireciona links /open?docid para
 *  o endereço real do artigo, e o dedup de estudos precisa do endereço final. */
async function baixarDe(
  url: string,
  cabecalhos: HeadersInit,
  prazoMs: number,
  rotulo: string,
): Promise<{ texto: string; urlFinal: string }> {
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
  if (resposta.url.includes("google.com/sorry"))
    throw new Error(
      `${rotulo}: o Google está limitando os acessos deste servidor (HTTP ${resposta.status}); tente de novo em alguns minutos`,
    );
  if (resposta.status === 202 || resposta.headers.get("x-amzn-waf-action"))
    throw new Error(`${rotulo}: desafio de segurança do jw.org (HTTP ${resposta.status})`);
  if (!resposta.ok) throw new Error(`${rotulo}: HTTP ${resposta.status}`);
  try {
    const texto = await examinar(resposta);
    return { texto, urlFinal: resposta.url };
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
    const cacheExistente = cache.get(data.url);
    if (cacheExistente && cacheExistente.expira > Date.now())
      return { texto: cacheExistente.texto, url: cacheExistente.url };

    let motivo = "";
    // Janela total de ~35s. Em provas reais, o que passa, passa em ~3s (espelho);
    // o que não passa é WAF prendendo a conexão ou Google limitando em rajada —
    // nada disso se resolve insistindo por um minuto, e insistir agrava o limite.
    // Em cada rodada: 1) tentativa direta — cortada cedo, e ABANDONADA no resto
    // da janela quando o WAF prende a conexão (tempo esgotado); 2) espelho de
    // emergência pelo Google, alternando o modo (wapp/nv/ann) para escapar do
    // limite de rajada. Cada falha nomeia o canal (DIRETRIZES nº 9).
    const PRAZO_TOTAL = 35000;
    const inicio = Date.now();
    let penduraDireto = false;
    for (let rodada = 0; ; rodada++) {
      const restante = PRAZO_TOTAL - (Date.now() - inicio);
      if (restante < 3000) break;

      if (!penduraDireto) {
        try {
          const { texto, urlFinal } = await baixarDe(
            data.url,
            {
              "User-Agent": AGENTES[rodada % AGENTES.length]!,
              Accept: "text/html,application/json,*/*",
              "Accept-Language": "pt-BR,pt;q=0.9",
            },
            Math.min(restante - 1000, rodada === 0 ? 8000 : 12000),
            "direto",
          );
          guardarCache(data.url, texto, urlFinal);
          return { texto, url: urlFinal || data.url };
        } catch (e) {
          motivo = e instanceof Error ? e.message : String(e);
          // "página não existe" é resposta definitiva do jw.org — não há o que tentar de novo.
          if (/não existe/.test(motivo)) throw e;
          // WAF prendendo a conexão não solta no mesmo minuto; insistir rouba
          // a janela inteira do espelho, que é o canal que de fato passa.
          if (/tempo esgotado/.test(motivo)) penduraDireto = true;
          await pausa(500);
        }
      }

      const restante2 = PRAZO_TOTAL - (Date.now() - inicio);
      if (restante2 < 3000) break;
      const modo = MODOS_ESPELHO[rodada % MODOS_ESPELHO.length]!;
      try {
        const { texto } = await baixarDe(
          urlEspelho(data.url, modo),
          { Accept: "text/html,*/*", "Accept-Language": "pt-BR,pt;q=0.9" },
          Math.min(restante2 - 1000, 15000),
          "espelho",
        );
        const original = desfazerEspelho(texto);
        guardarCache(data.url, original, data.url);
        return { texto: original, url: data.url };
      } catch (e) {
        motivo = e instanceof Error ? e.message : String(e);
        if (/não existe/.test(motivo)) throw e;
        await pausa(500);
      }
    }
    throw new Error(motivo || "jw.org não respondeu com conteúdo");
  });
