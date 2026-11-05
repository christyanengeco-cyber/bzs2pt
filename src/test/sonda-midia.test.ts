import { beforeEach, describe, expect, it, vi } from "vitest";
import { sondarMidia } from "@/lib/sonda-midia";

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("sondarMidia confirma a variante no CDN antes de trocar o vídeo", () => {
  it("HEAD 200 confirma sem precisar de segunda sonda", async () => {
    const fetch = vi.fn(async (_url: string, _options?: RequestInit) => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const r = await sondarMidia("https://assets.jw-cdn.org/v/arquivo_r720P.mp4");
    expect(r).toEqual({ ok: true, status: 200 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[1]?.method).toBe("HEAD");
  });

  it("HEAD 404 é conclusivo: a variante não existe (sem segunda sonda)", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetch);
    const r = await sondarMidia("https://assets.jw-cdn.org/v/arquivo_r720P.mp4");
    expect(r).toEqual({ ok: false, status: 404 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("HEAD recusado (405) cai para o GET de faixa de 2 bytes", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 405 }))
      .mockResolvedValueOnce(new Response("x", { status: 206 }));
    vi.stubGlobal("fetch", fetch);
    const r = await sondarMidia("https://assets.jw-cdn.org/v/arquivo_r720P.mp4");
    expect(r).toEqual({ ok: true, status: 206 });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]?.[1]?.method).toBe("GET");
    expect(fetch.mock.calls[1]?.[1]?.headers).toMatchObject({ Range: "bytes=0-1" });
  });

  it("HEAD com falha de rede tenta o GET de faixa", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("conexão recusada"))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const r = await sondarMidia("https://assets.jw-cdn.org/v/arquivo_r720P.mp4");
    expect(r).toEqual({ ok: true, status: 200 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("duas sondas sem resposta conclusiva devolvem inconclusivo com o motivo", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(new Response(null, { status: 403 }));
    vi.stubGlobal("fetch", fetch);
    const r = await sondarMidia("https://assets.jw-cdn.org/v/arquivo_r720P.mp4");
    expect(r.ok).toBe(false);
    expect(r.inconclusivo).toBe(true);
    expect(r.motivo).toContain("HTTP 403");
  });

  it("rede fora nas duas sondas é inconclusivo, não recusa definitiva", async () => {
    const fetch = vi.fn(async () => {
      throw new Error("fetch failed");
    });
    vi.stubGlobal("fetch", fetch);
    const r = await sondarMidia("https://assets.jw-cdn.org/v/arquivo_r720P.mp4");
    expect(r.ok).toBe(false);
    expect(r.inconclusivo).toBe(true);
    expect(r.motivo).toContain("fetch failed");
  });
});
