import { describe, expect, it, vi, beforeEach } from "vitest";
import { EH_LINK_VIDEO_RE, extrairVideo, respostaUtil } from "@/lib/parser";

// Mapa url -> html usado pelo baixarPagina "mockado". Cada teste popula só o que precisa.
const paginas = vi.hoisted(() => new Map<string, string>());

vi.mock("@/lib/fetch-page.functions", () => ({
  baixarPagina: async ({ data }: { data: { url: string } }) => {
    const texto = paginas.get(data.url);
    if (texto == null) throw new Error("jw.org respondeu HTTP 202");
    return { texto, url: data.url };
  },
}));

vi.stubGlobal(
  "fetch",
  vi.fn(async () => {
    throw new Error("os proxies públicos não devem ser usados nos testes");
  }),
);

beforeEach(() => paginas.clear());

describe("respostaUtil filtra páginas de bloqueio", () => {
  it("aceita HTML e JSON reais", () => {
    expect(respostaUtil("<!doctype html><html><body>ok</body></html>")).toBe(true);
    expect(respostaUtil('{"mediaItems":[]}')).toBe(true);
  });

  it("rejeita desafio do WAF e página de erro do proxy", () => {
    expect(
      respostaUtil(
        '<!DOCTYPE html><html><head><script src="https://d1t8s2y7x9.cloudfront.net/challenge.js"></script></head><body>window.awswaf = true;</body></html>',
      ),
    ).toBe(false);
    expect(respostaUtil("<!DOCTYPE html><html><body><h1>error code: 522</h1></body></html>")).toBe(
      false,
    );
  });
});

describe("EH_LINK_VIDEO_RE reconhece os formatos de link de vídeo", () => {
  it("reconhece biblioteca de vídeos, mid=, mp4, finder e mwbv", () => {
    expect(EH_LINK_VIDEO_RE.test("https://www.jw.org/bzs/biblioteca/videos/#mid=123456")).toBe(
      true,
    );
    expect(EH_LINK_VIDEO_RE.test("https://www.jw.org/finder?wtlocale=BZS&lank=item-7_1-VJS1")).toBe(
      true,
    );
    expect(EH_LINK_VIDEO_RE.test("https://www.jw.org/finder?wtlocale=BZS&docid=1102025907")).toBe(
      true,
    );
    expect(EH_LINK_VIDEO_RE.test("https://assets.jw-cdn.org/v/aula_720p.mp4")).toBe(true);
    expect(
      EH_LINK_VIDEO_RE.test("https://www.jw.org/finder?wtlocale=BZS&pub=mwbv&issue=202611"),
    ).toBe(true);
  });

  it("não marca links comuns de texto como vídeo", () => {
    expect(
      EH_LINK_VIDEO_RE.test(
        "https://www.jw.org/bzs/biblioteca/livros/ande-corajosamente-com-deus/licao-7/",
      ),
    ).toBe(false);
  });
});

describe("extrairVideo", () => {
  it("resolve #mid= sem devolver o vídeo da própria apostila", async () => {
    const apostila = "https://www.jw.org/bzs/biblioteca/apostilas/mwb-Un-202611/";
    paginas.set(
      apostila,
      `<html><head><title>Apostila</title></head><body>
        <video src="https://assets.jw-cdn.org/apostila_abertura_720p.mp4"></video>
        <a href="/bzs/biblioteca/videos/vid_JW-ITEM7/#mid=123456">Mostre o VÍDEO.</a>
      </body></html>`,
    );
    const video = "https://www.jw.org/bzs/biblioteca/videos/vid_JW-ITEM7/";
    paginas.set(
      video,
      `<html><head><title>Vídeo do item 7</title></head><body>
        <video><source src="https://assets.jw-cdn.org/item7_720p.mp4"></video>
      </body></html>`,
    );
    const r = await extrairVideo(`${apostila}#mid=123456`);
    expect(r?.mp4).toContain("item7_720p.mp4");
    expect(r?.mp4).not.toContain("apostila_abertura");
  });

  it("extrai o MP4 de uma página de vídeo direta (prefere 720p)", async () => {
    const pag = "https://www.jw.org/bzs/biblioteca/videos/vid_JW-ITEM7/";
    paginas.set(
      pag,
      `<html><head><title>Item 7</title></head><body>
        <video><source src="https://assets.jw-cdn.org/vid_JW-ITEM7_360p.mp4"></video>
        <video><source src="https://assets.jw-cdn.org/vid_JW-ITEM7_720p.mp4"></video>
      </body></html>`,
    );
    expect((await extrairVideo(pag))?.mp4).toContain("720p");
  });

  it("segue o link canônico quando a página do finder não traz o MP4", async () => {
    const finder = "https://www.jw.org/finder?wtlocale=BZS&lank=item-7_1-VJS1";
    paginas.set(
      finder,
      `<html><head><link rel="canonical" href="https://www.jw.org/bzs/biblioteca/videos/vid_item7/"></head><body></body></html>`,
    );
    const real = "https://www.jw.org/bzs/biblioteca/videos/vid_item7/";
    paginas.set(
      real,
      `<html><head><title>Vídeo em Libras</title></head><body>
        <video><source src="https://assets.jw-cdn.org/vid_item7_720p.mp4"></video>
      </body></html>`,
    );
    const r = await extrairVideo(finder);
    expect(r?.mp4).toContain("vid_item7_720p.mp4");
    expect(r?.titulo).toBe("Vídeo em Libras");
  });

  it("devolve undefined quando a página não tem vídeo nenhum", async () => {
    const pag = "https://www.jw.org/bzs/biblioteca/livros/ande-corajosamente-com-deus/licao-7/";
    paginas.set(
      pag,
      "<html><head><title>Lição 7</title></head><body><p>Texto da lição.</p></body></html>",
    );
    await expect(extrairVideo(pag)).resolves.toBeUndefined();
  });

  it("falha em silêncio controlado quando o jw.org bloqueia (WAF)", async () => {
    paginas.set(
      "https://www.jw.org/bzs/biblioteca/videos/#mid=999",
      '<script src="https://x.cloudfront.net/challenge.js"></script>'.repeat(20),
    );
    await expect(extrairVideo("https://www.jw.org/bzs/biblioteca/videos/#mid=999")).rejects.toThrow(
      /Não foi possível baixar/,
    );
  });
});
