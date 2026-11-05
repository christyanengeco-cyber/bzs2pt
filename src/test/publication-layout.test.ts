import { describe, expect, it } from "vitest";
import { elementosPublicacao, imagemDoElemento, mesclarEstrutura } from "@/lib/publication-layout";
import type { Paragrafo } from "@/lib/db";

describe("estrutura das publicações", () => {
  it("extrai a imagem responsiva na posição original, sem capa ou cartaz do vídeo", () => {
    const doc = new DOMParser().parseFromString(
      '<article><div class="relatedImage" data-src="cover.jpg"></div><header><h1 data-pid="1">2-8 de novembro</h1></header><h2>TESOUROS DA PALAVRA DE DEUS</h2><figure><span class="jsRespImg" data-img-size-lg="/image.jpg"><noscript><img src="/small.jpg"></noscript></span></figure><p>Corpo</p></article>',
      "text/html",
    );
    const els = elementosPublicacao(doc);
    expect(els.map((el) => el.tagName)).toEqual(["H1", "H2", "SPAN", "P"]);
    const img = els[2];
    expect(img && imagemDoElemento(img, "https://www.jw.org/bzs/")).toBe(
      "https://www.jw.org/image.jpg",
    );
  });

  it("prefere o zoom (maior variante listada) antes do lg", () => {
    const doc = new DOMParser().parseFromString(
      '<figure><span class="jsRespImg" data-img-size-sm="/sm.jpg" data-img-size-lg="/lg.jpg" data-zoom="/xl.jpg"><noscript><img src="/xs.jpg"></noscript></span></figure>',
      "text/html",
    );
    const els = elementosPublicacao(doc);
    expect(els).toHaveLength(1);
    expect(imagemDoElemento(els[0]!, "https://www.jw.org/pt/")).toBe("https://www.jw.org/xl.jpg");
  });
  it("mantém IDs e tempos das respostas já preparadas ao recuperar imagens", () => {
    const antigo: Paragrafo = {
      id: "original",
      publicacao_id: "pub",
      numero_ordem: 0,
      texto_portugues: "Pergunta",
      timestamp_inicio: 42,
      oculto: true,
    };
    const novo = { ...antigo, id: "novo", timestamp_inicio: 0, resposta: true };
    const imagem = {
      ...novo,
      id: "imagem",
      texto_portugues: "",
      imagem: "data:image/png;base64,abc",
    };
    const resultado = mesclarEstrutura([antigo], [imagem, novo], "pub");
    expect(resultado[1]).toMatchObject({
      id: "original",
      timestamp_inicio: 42,
      oculto: true,
      resposta: true,
      numero_ordem: 1,
    });
    expect(resultado[0]?.imagem).toBe("data:image/png;base64,abc");
  });
});
