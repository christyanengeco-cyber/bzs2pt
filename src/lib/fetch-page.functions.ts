import { createServerFn } from "@tanstack/react-start";

const PERMITIDOS = /(^|\.)(jw\.org|jw-cdn\.org|akamaihd\.net)$/i;

export const baixarPagina = createServerFn({ method: "POST" })
  .inputValidator((d: { url: string }) => {
    const u = new URL(d.url);
    if (u.protocol !== "https:" || !PERMITIDOS.test(u.hostname))
      throw new Error("Apenas links do jw.org são permitidos.");
    return { url: u.href };
  })
  .handler(async ({ data }) => {
    const r = await fetch(data.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36",
        Accept: "text/html,application/json,*/*",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
    });
    // O WAF da CloudFront responde 202 (que é "ok" para fetch) com corpo vazio quando
    // desafia o cliente; sem essa checagem a resposta vazia era tratada como sucesso.
    if (!r.ok || r.status === 202 || r.headers.get("x-amzn-waf-action"))
      throw new Error(`jw.org respondeu HTTP ${r.status}`);
    const texto = await r.text();
    if (!texto.trim())
      throw new Error("jw.org devolveu uma resposta vazia (possível bloqueio de segurança).");
    return { texto, url: r.url };
  });
