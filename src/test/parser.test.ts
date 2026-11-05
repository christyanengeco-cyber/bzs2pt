import { describe, expect, it } from "vitest";
import { extrairUrlCanonical, linkEstudoLivro } from "@/lib/parser";

describe("link do estudo de livro (wcg/lff)", () => {
  it("cria o link quando o livro está no mesmo parágrafo do Estudo bíblico", () => {
    const l = linkEstudoLivro("8. Estudo bíblico de congregação (30 min) wcg cap. 15");
    expect(l).toMatchObject({ href: "livro:wcg:15" });
    expect("8. Estudo bíblico de congregação (30 min) wcg cap. 15".slice(l!.inicio, l!.fim)).toBe(
      "wcg cap. 15",
    );
  });

  it("cria o link quando o livro vem em um parágrafo separado do título da parte", () => {
    const l = linkEstudoLivro("wcg cap. 15", "8. Estudo bíblico de congregação (30 min)");
    expect(l).toMatchObject({ href: "livro:wcg:15" });
  });

  it("cria o link para lff lição 20 quando o contexto da parte vem antes", () => {
    const l = linkEstudoLivro("lff lição 20 ponto 4", "8. Estudo bíblico de congregação (30 min)");
    expect(l).toMatchObject({ href: "livro:lff:20" });
  });

  it("também aceita o código do livro sozinho (formato novo da apostila)", () => {
    const l = linkEstudoLivro("wcg 15");
    expect(l).toMatchObject({ href: "livro:wcg:15" });
  });

  it("aceita o nome do livro por extenso com número da lição", () => {
    const l = linkEstudoLivro(
      "Estudo bíblico de congregação (30 min): Ande corajosamente com Deus, lição 13",
    );
    expect(l).toMatchObject({ href: "livro:wcg:13" });
  });

  it("não cria link em parágrafos sem menção a livro de estudo", () => {
    expect(linkEstudoLivro("Cântico 44 e oração")).toBeNull();
    expect(linkEstudoLivro("Que lições você aprendeu? Sua resposta")).toBeNull();
  });
});

describe("URL canônica de páginas do jw.org", () => {
  it("devolve a URL da lição a partir do canonical da página em Libras", () => {
    const doc = new DOMParser().parseFromString(
      '<html><head><link rel="canonical" href="https://www.jw.org/bzs/biblioteca/livros/ande-corajosamente-com-deus/licao-15/"></head><body></body></html>',
      "text/html",
    );
    expect(extrairUrlCanonical(doc)).toBe(
      "https://www.jw.org/bzs/biblioteca/livros/ande-corajosamente-com-deus/licao-15/",
    );
  });

  it("aceita a URL do og:url quando não há canonical", () => {
    const doc = new DOMParser().parseFromString(
      '<html><head><meta property="og:url" content="https://www.jw.org/bzs/biblioteca/livros/ande-corajosamente-com-deus/licao-15/"></head><body></body></html>',
      "text/html",
    );
    expect(extrairUrlCanonical(doc)).toContain("/bzs/biblioteca/livros/");
  });

  it("rejeita a home e URLs fora do idioma de sinais", () => {
    const home = new DOMParser().parseFromString(
      '<html><head><link rel="canonical" href="https://www.jw.org/bzs/"></head></html>',
      "text/html",
    );
    expect(extrairUrlCanonical(home)).toBeUndefined();
    const pt = new DOMParser().parseFromString(
      '<html><head><link rel="canonical" href="https://www.jw.org/pt/biblioteca/livros/livro/"></head></html>',
      "text/html",
    );
    expect(extrairUrlCanonical(pt)).toBeUndefined();
  });
});

import { selecionarFaixa, idsBiblia } from "@/lib/parser";
describe("seleção de faixa", () => {
  it("usa só o vídeo do docid da página, não a faixa 1 da revista", () => {
    const itens = [
      { url: "https://x/mwb_f1_720p.mp4", docid: "202026400", track: "1", markers: [] },
      {
        url: "https://x/mwb_f10_720p.mp4",
        docid: "202026478",
        track: "10",
        markers: [{ label: "4", startTime: 11.144 }],
      },
    ];
    const r = selecionarFaixa(itens, "202026478");
    expect(r?.mp4).toBe("https://x/mwb_f10_720p.mp4");
    expect(r?.markers[0]?.startTime).toBe(11.144);
  });
  it("lê versículos do link da Bíblia", () => {
    expect(
      idsBiblia("https://www.jw.org/bzs/biblioteca/biblia/nwt/livros/proverbios/3/#v20003005"),
    ).toEqual([20003005]);
  });
});
