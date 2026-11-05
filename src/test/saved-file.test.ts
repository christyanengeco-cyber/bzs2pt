import { describe, expect, it } from "vitest";
import { decodificarPaginaSalva, extrairUrlDeHtmlSalvo, importarHtml } from "@/lib/parser";

describe("decodificarPaginaSalva", () => {
  it("passa HTML puro adiante e acha a URL pelo canonical", () => {
    const html =
      '<!doctype html><html><head><link rel="canonical" href="https://www.jw.org/pt/biblioteca/revistas/x/"></head><body><p>oi</p></body></html>';
    const r = decodificarPaginaSalva(html, "pagina.html");
    expect(r.html).toBe(html);
    expect(r.url).toBe("https://www.jw.org/pt/biblioteca/revistas/x/");
  });

  it("decodifica MHTML quoted-printable (Chrome Android) com a URL original", () => {
    // "Vídeo" em UTF-8 quoted-printable: í = =C3=AD (como o Chrome grava)
    const corpo =
      "<!doctype html><html><head><title>V=C3=ADdeo</title></head><body><p>Assista ao v=C3=ADdeo do item 7.</p></body></html>";
    const mhtml = [
      "MIME-Version: 1.0",
      'Content-Type: multipart/related; boundary="----=_Part_1"',
      "",
      "------=_Part_1",
      "Snapshot-Content-Location: https://www.jw.org/pt/apostila-semana/",
      "Content-Transfer-Encoding: quoted-printable",
      "Content-Type: text/html; charset=UTF-8",
      "",
      corpo,
      "------=_Part_1--",
    ].join("\r\n");
    const r = decodificarPaginaSalva(mhtml, "apostila.mhtml");
    expect(r.url).toBe("https://www.jw.org/pt/apostila-semana/");
    expect(r.html).toContain("Vídeo");
    expect(r.html).toContain("Assista ao vídeo do item 7.");
  });

  it("decodifica MHTML base64", () => {
    const html = "<html><body><p>Base64 aqui.</p></body></html>";
    const b64 = btoa(unescape(encodeURIComponent(html)));
    const mhtml = [
      "MIME-Version: 1.0",
      'Content-Type: multipart/related; boundary="B"',
      "",
      "--B",
      "Content-Transfer-Encoding: base64",
      "Content-Type: text/html; charset=UTF-8",
      "",
      b64,
      "--B--",
    ].join("\r\n");
    const r = decodificarPaginaSalva(mhtml, "x.mht");
    expect(r.html).toContain("Base64 aqui.");
  });
});

describe("importarHtml (importação por arquivo salvo)", () => {
  it("importa uma apostila mínima salva do jw.org", async () => {
    const html = `<html><head><title>Reunião vida e ministério</title></head><body>
      <article><h1>Programa da reunião</h1>
      <p data-pid="1">Cântico 44 e oração.</p>
      <p data-pid="2">Comentários iniciais.</p></article>
    </body></html>`;
    const r = await importarHtml(html, "arquivo:apostila.mhtml");
    expect(r.publicacao.url_origem).toBe("arquivo:apostila.mhtml");
    expect(r.paragrafos.some((p) => p.texto_portugues.includes("Cântico 44"))).toBe(true);
  });

  it("falha com mensagem clara quando o arquivo não tem parágrafos", async () => {
    await expect(importarHtml("<html><body></body></html>", "arquivo:vazio.html")).rejects.toThrow(
      /Nenhum parágrafo/,
    );
  });
});

describe("extrairUrlDeHtmlSalvo", () => {
  it("rejeita arquivos sem URL do jw.org", () => {
    expect(extrairUrlDeHtmlSalvo("<html><head></head><body></body></html>")).toBe("");
    expect(
      extrairUrlDeHtmlSalvo(
        '<html><head><link rel="canonical" href="https://exemplo.com/"></head></html>',
      ),
    ).toBe("");
  });
});
