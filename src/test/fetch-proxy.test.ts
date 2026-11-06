import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/fetch-page.functions", () => ({
  baixarPagina: vi.fn(async () => { throw new Error("direto: HTTP 202"); }),
}));
import { fetchProxy } from "@/lib/parser";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("contingência da importação", () => {
  it("não espera um proxy travado antes de aproveitar outro com conteúdo", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("codetabs")) return Promise.resolve(new Response('<!doctype html><html><article class="bodyTxt">Estudo real</article></html>'));
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("cancelado")), { once: true });
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchProxy("https://www.jw.org/bzs/?test=paralelo")).resolves.toMatchObject({ texto: '<!doctype html><html><article class="bodyTxt">Estudo real</article></html>' });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.every(([, init]) => init?.signal?.aborted)).toBe(true);
  });

  it("limita os quatro proxies a uma única espera de 10 segundos", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("tempo esgotado")), { once: true });
    })));
    const resultado = expect(fetchProxy("https://www.jw.org/bzs/?test=prazo")).rejects.toThrow("direto: HTTP 202");
    await vi.advanceTimersByTimeAsync(10000);
    await resultado;
  });
});