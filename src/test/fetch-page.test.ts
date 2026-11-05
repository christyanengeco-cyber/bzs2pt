import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ inputValidator: () => ({ handler: (fn: unknown) => fn }) }),
}));
import { baixarPagina } from "@/lib/fetch-page.functions";

describe("download de mídia pelo servidor", () => {
  it("aceita JSON GETPUBMEDIALINKS sem marcadores HTML", async () => {
    const texto = JSON.stringify({ files: { LSB: { MP4: [{ file: { url: "https://cfp2.jw-cdn.org/video.mp4" } }] } } });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(texto)));
    const handler = baixarPagina as unknown as (args: { data: { url: string } }) => Promise<{ texto: string }>;
    await expect(handler({ data: { url: "https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?test=regression" } })).resolves.toMatchObject({ texto });
    vi.unstubAllGlobals();
  });
});