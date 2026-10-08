import { createServerFn } from "@tanstack/react-start";

const PERMITIDOS = /(^|\.)(jw\.org|jw-cdn\.org|akamaihd\.net)$/i;

export const baixarPagina = createServerFn({ method: "POST" })
  .inputValidator((d: { url: string }) => {
    const u = new URL(d.url);
    if (u.protocol !== "https:" || !PERMITIDOS.test(u.hostname)) throw new Error("Apenas links do jw.org são permitidos.");
    return { url: u.href };
  })
  .handler(async ({ data }) => {
    const r = await fetch(data.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36",
        Accept: "text/html,application/json,*/*",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });
    if (!r.ok) throw new Error(`jw.org respondeu HTTP ${r.status}`);
    return { texto: await r.text() };
  });
