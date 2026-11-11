import { describe, expect, it } from "vitest";
import { extrairUrlCanonical, importarHtml, LIXO, linkEstudoLivro } from "@/lib/parser";

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
  it("pega a variante _r720P.mp4 do CDN na faixa da apostila (P maiúsculo)", () => {
    const itens = [
      {
        url: "https://x/mwbv_BZS_202611_f1_r240P.mp4",
        docid: "202026400",
        track: "1",
        markers: [],
      },
      {
        url: "https://x/mwbv_BZS_202611_f1_r720P.mp4",
        docid: "202026400",
        track: "1",
        markers: [],
      },
    ];
    expect(selecionarFaixa(itens, "202026400")?.mp4).toContain("_r720P.mp4");
  });
  it("lê versículos do link da Bíblia", () => {
    expect(
      idsBiblia("https://www.jw.org/bzs/biblioteca/biblia/nwt/livros/proverbios/3/#v20003005"),
    ).toEqual([20003005]);
  });
});

describe("faixa com zero à esquerda", () => {
  it("track=02 da página pega a faixa 2 da API, não a faixa 1", () => {
    const itens = [
      { url: "https://x/mwb_01_r720P.mp4", track: "1", markers: [] },
      { url: "https://x/mwb_02_r720P.mp4", track: "2", markers: [] },
    ];
    expect(selecionarFaixa(itens, undefined, "02")?.mp4).toBe("https://x/mwb_02_r720P.mp4");
  });
});

describe("estrutura do leitor vinda do jw.org", () => {
  const html = `<article>
    <h1 data-pid="1">Para agradar a Jeová, continue treinando sua consciência</h1>
    <p id="p1" class="contextTtl">4-10 DE JANEIRO DE 2027</p>
    <p id="p2" class="pubRefs"><a href="/c/36">CÂNTICO 36</a> Proteja o Coração</p>
    <h2>SUA CONSCIÊNCIA PODE PROTEGER VOCÊ</h2>
    <p id="p8" data-pid="8"><span class="parNum" data-pnum="2"><strong><sup>2</sup></strong></span> Uma consciência treinada.</p>
    <p id="p10">(10 min)</p>
    <p id="p11"><span>PARA MEDITAR:</span> O que eu tenho que fazer?</p>
    <p id="p12">Saiba mais on-line</p>
    <p id="p13" class="pubRefs"><strong>OBJETIVO</strong></p>
    <div class="boxSupplement"><div class="boxTtl" data-pid="30"><h2>COMO VOCÊ RESPONDERIA?</h2></div><p id="p31">Pergunta de revisão?</p></div>
    <p id="p91"><strong>DESCRIÇÃO DA IMAGEM:</strong> Um irmão brinda.</p>
  </article>`;

  it("classifica duração, PARA MEDITAR, Saiba mais on-line, OBJETIVO e data", async () => {
    const { paragrafos } = await importarHtml(html, "https://www.jw.org/pt/artigo/");
    const porTexto = (t: string) => paragrafos.find((p) => p.texto_portugues.startsWith(t));
    expect(porTexto("4-10 DE JANEIRO")?.estilo).toBe("dataEstudo");
    expect(porTexto("CÂNTICO 36")?.estilo).toBe("cantico");
    expect(porTexto("SUA CONSCIÊNCIA")?.estilo).toBe("subtitulo");
    expect(porTexto("(10 min)")?.estilo).toBe("duracao");
    expect(porTexto("PARA MEDITAR")?.estilo).toBe("meditar");
    expect(porTexto("Saiba mais on-line")?.estilo).toBe("saibaMais");
    expect(porTexto("OBJETIVO")?.estilo).toBe("objetivo");
    expect(porTexto("DESCRIÇÃO DA IMAGEM")?.estilo).toBe("descricaoImagem");
  });

  it("separa o número do parágrafo e agrupa o quadro num bloco só", async () => {
    const { paragrafos } = await importarHtml(html, "https://www.jw.org/pt/artigo/");
    const corpo = paragrafos.find((p) => p.texto_portugues.startsWith("Uma consciência"));
    expect(corpo?.numero_paragrafo).toBe(2);
    expect(corpo?.texto_portugues).toBe("Uma consciência treinada.");
    const titulo = paragrafos.find((p) => p.texto_portugues === "COMO VOCÊ RESPONDERIA?");
    const pergunta = paragrafos.find((p) => p.texto_portugues.startsWith("Pergunta de revisão"));
    expect(titulo?.estilo).toBe("revisao");
    expect(titulo?.bloco).toBeDefined();
    expect(pergunta?.bloco).toBe(titulo?.bloco);
  });

  it("marca a versão 2 do layout para reimportar os estudos antigos", async () => {
    const { publicacao } = await importarHtml(html, "https://www.jw.org/pt/artigo/");
    expect(publicacao.layout_versao).toBe(2);
  });

  it("não importa o link 'Baixar o vídeo' do <noscript> do player", async () => {
    const comPlayer = `<article>
      <h1 data-pid="1">Para agradar a Jeová, continue treinando sua consciência</h1>
      <div class="slContentVideo"><div class="jsIncludeVideo">
        <noscript>
          <p class="error">Desculpe-nos. O tocador de mídia não carregou.</p>
          <p><a href="https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS">Baixar o vídeo</a></p>
        </noscript>
      </div></div>
      <p data-pid="8">Uma consciência treinada.</p>
    </article>`;
    const { paragrafos } = await importarHtml(comPlayer, "https://www.jw.org/pt/artigo/");
    expect(paragrafos.map((p) => p.texto_portugues)).toEqual([
      "Para agradar a Jeová, continue treinando sua consciência",
      "Uma consciência treinada.",
    ]);
  });

  it("reconhece o texto do link como lixo, com ou sem o artigo", () => {
    expect(LIXO.test("Baixar o vídeo")).toBe(true);
    expect(LIXO.test("Baixar vídeo")).toBe(true);
  });
});
