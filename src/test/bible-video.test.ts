import { describe, expect, it, vi } from "vitest";
import { buscarVideoBiblia } from "@/lib/parser";

const respostas = vi.hoisted(() => new Map<string, unknown>());
vi.mock("@/lib/fetch-page.functions", () => ({
  baixarPagina: async ({ data }: { data: { url: string } }) => ({
    texto: JSON.stringify(respostas.get(data.url)),
    url: data.url,
  }),
}));

function preparar(cap: number, markers: unknown[]) {
  respostas.set(
    `https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?output=json&pub=nwt&fileformat=MP4&alllangs=0&langwritten=LSB&txtCMSLang=LSB&booknum=43&track=${cap}`,
    {
      files: {
        LSB: {
          MP4: [
            {
              track: cap,
              file: { url: `https://example.org/john_${cap}_r720P.mp4` },
              markers: { markers },
            },
          ],
        },
      },
    },
  );
  return `https://www.jw.org/bzs/biblioteca/biblia/nwt/livros/joao/${cap}/#v${43000000 + cap * 1000 + 16}`;
}

describe("início do vídeo no versículo bíblico citado", () => {
  it("reconhece verseNumber mesmo quando o marcador de parágrafo é diferente", async () => {
    const href = preparar(3, [
      { verseNumber: 1, mepsParagraphId: 16, startTime: 0 },
      { verseNumber: 16, mepsParagraphId: 32, label: "João 3:16", startTime: 83.5 },
    ]);
    expect((await buscarVideoBiblia(href))?.inicio).toBe(83.5);
  });

  it("reconhece o versículo na etiqueta completa sem confundir 16 com 116", async () => {
    const href = preparar(4, [
      { label: "João 4:116", startTime: 4 },
      { label: "João 4:16", startTime: "00:02:03.500" },
    ]);
    expect((await buscarVideoBiblia(href))?.inicio).toBe(123.5);
  });

  it("preserva o suporte a códigos completos de versículo", async () => {
    const href = preparar(5, [{ label: "43005016", startTime: 45 }]);
    expect((await buscarVideoBiblia(href))?.inicio).toBe(45);
  });
});
