import { createServerFn } from "@tanstack/react-start";

const PERMITIDOS = /(^|\.)(jw\.org|jw-cdn\.org|akamaihd\.net)$/i;

/** Corpos-desafio do WAF (CloudFront/AWS WAF) chegam com HTTP 200 plausível;
 *  sem esse filtro eram tratados como conteúdo e a extração falhava em silêncio. */
const DESAFIO_RE =
  /awswaf|challenge\.js|cdn-cgi\/challenge|cf-challenge|captcha-delivery/i;

// Alterna o agente entre tentativas: o WAF às vezes libera um perfil e trava outro.
const AGENTES = [
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
];

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const baixarPagina = createServerFn({ method: "POST" })
  .inputValidator((d: { url: string }) => {
    const u = new URL(d.url);
    if (u.protocol !== "https:" || !PERMITIDOS.test(u.hostname))
      throw new Error("Apenas links do jw.org são permitidos.");
    return { url: u.href };
  })
  .handler(async ({ data }) => {
    let motivo = "";
    let diagnostico = "";
    // Prazo total de ~55s: tentativas de até 30s cada (o jw.org anda lento; o
    // timeout curto de 15s causava "signal timed out"). O desafio do WAF costuma
    // passar na segunda tentativa, então continuamos enquanto houver prazo.
    const PRAZO_TOTAL = 55000;
    const inicio = Date.now();
    for (let tentativa = 0; Date.now() - inicio < PRAZO_TOTAL; tentativa++) {
      const restante = PRAZO_TOTAL - (Date.now() - inicio);
      try {
        const r = await fetch(data.url, {
          headers: {
            "User-Agent": AGENTES[tentativa % AGENTES.length]!,
            Accept: "text/html,application/json,*/*",
            "Accept-Language": "pt-BR,pt;q=0.9",
          },
          redirect: "follow",
          signal: AbortSignal.timeout(Math.min(restante - 1000, 30000)),
        });
        // O WAF da CloudFront responde 202 (que é "ok" para fetch) com corpo vazio
        // quando desafia o cliente.
        if (r.status === 202 || r.headers.get("x-amzn-waf-action")) {
          motivo = `desafio de segurança do jw.org (HTTP ${r.status})`;
          await pausa(700 * (tentativa + 1));
          continue;
        }
        if (!r.ok) {
          motivo = `jw.org respondeu HTTP ${r.status}`;
          await pausa(700 * (tentativa + 1));
          continue;
        }
        const texto = await r.text();
        if (!texto.trim()) {
          motivo = "jw.org devolveu uma resposta vazia (possível bloqueio de segurança)";
          await pausa(700 * (tentativa + 1));
          continue;
        }
        if (DESAFIO_RE.test(texto.slice(0, 5000))) {
          motivo = "o jw.org está exigindo verificação de segurança (página-desafio)";
          diagnostico = texto.slice(0, 120).replace(/\s+/g, " ");
          await pausa(700 * (tentativa + 1));
          continue;
        }
        return { texto, url: r.url };
      } catch (e) {
        const nome = e instanceof Error ? `${e.name} ${e.message}` : String(e);
        motivo =
          /timeout|timed out|abort/i.test(nome)
            ? "o jw.org demorou demais para responder (tempo esgotado)"
            : e instanceof Error
              ? e.message
              : String(e);
        await pausa(1500);
      }
    }
    if (diagnostico) motivo += ` — início da resposta: "${diagnostico}"`;
    throw new Error(motivo || "jw.org não respondeu com conteúdo");
  });
