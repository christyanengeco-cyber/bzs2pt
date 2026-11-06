import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ inputValidator: () => ({ handler: (fn: unknown) => fn }) }),
}));
import { baixarPagina } from "@/lib/fetch-page.functions";

afterEach(() => vi.unstubAllGlobals());

const handler = baixarPagina as unknown as (args: { data: { url: string } }) => Promise<{ texto: string }>;

describe("download de páginas com WAF", () => {
  it("usa o perfil que recebeu conteúdo real na coleta de novembro de 2026", async () => {
    const fetchMock = vi.fn(async () => new Response('<article class="bodyTxt">Apostila</article>'));
    vi.stubGlobal("fetch", fetchMock);
    await handler({ data: { url: "https://www.jw.org/bzs/?test=agente" } });
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      headers: expect.objectContaining({ "User-Agent": "JW Library" }),
    }));
  });

  it("aceita conteúdo real mesmo com HTTP 202 e cabeçalho de desafio", async () => {
    const texto = '<article><div class="bodyTxt">Referências</div></article>';
    vi.stubGlobal("fetch", vi.fn(async () => new Response(texto, {
      status: 202, headers: { "x-amzn-waf-action": "challenge" },
    })));
    await expect(handler({ data: { url: "https://www.jw.org/bzs/?test=conteudo202" } })).resolves.toMatchObject({ texto });
  });

  it("assina a recusa do HTTP 202 vazio", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 202 })));
    await expect(handler({ data: { url: "https://www.jw.org/bzs/?test=vazio202" } })).rejects.toThrow("direto: desafio de segurança do jw.org sem conteúdo (HTTP 202)");
  });
});

describe("download de mídia pelo servidor", () => {
  it("aceita JSON GETPUBMEDIALINKS sem marcadores HTML", async () => {
    const texto = JSON.stringify({ files: { LSB: { MP4: [{ file: { url: "https://cfp2.jw-cdn.org/video.mp4" } }] } } });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(texto)));
    const handler = baixarPagina as unknown as (args: { data: { url: string } }) => Promise<{ texto: string }>;
    await expect(handler({ data: { url: "https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?test=regression" } })).resolves.toMatchObject({ texto });
    vi.unstubAllGlobals();
  });
});