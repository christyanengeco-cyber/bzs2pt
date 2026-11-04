import { describe, expect, it } from "vitest";
import { desfazerEspelho, urlEspelho } from "@/lib/espelho";

describe("urlEspelho", () => {
  it("mapeia um link do jw.org para o espelho do Google", () => {
    expect(urlEspelho("https://www.jw.org/pt/biblioteca/revistas/")).toBe(
      "https://www-jw-org.translate.goog/pt/biblioteca/revistas/?_x_tr_sl=auto&_x_tr_tl=en&_x_tr_hl=en&_x_tr_pto=wapp",
    );
  });

  it("preserva a consulta original e acrescenta os parâmetros do tradutor", () => {
    expect(urlEspelho("https://wol.jw.org/pt/wol/dt/r5/lp-t?x=y")).toBe(
      "https://wol-jw-org.translate.goog/pt/wol/dt/r5/lp-t?x=y&_x_tr_sl=auto&_x_tr_tl=en&_x_tr_hl=en&_x_tr_pto=wapp",
    );
  });

  it("cobre subdomínios do CDN", () => {
    expect(urlEspelho("https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?pub=mwb")).toBe(
      "https://b-jw-cdn-org.translate.goog/apis/pub-media/GETPUBMEDIALINKS?pub=mwb&_x_tr_sl=auto&_x_tr_tl=en&_x_tr_hl=en&_x_tr_pto=wapp",
    );
  });

  it("aceita modo alternativo para escapar do limite de rajada", () => {
    expect(urlEspelho("https://www.jw.org/pt/x/", "nv")).toBe(
      "https://www-jw-org.translate.goog/pt/x/?_x_tr_sl=auto&_x_tr_tl=en&_x_tr_hl=en&_x_tr_pto=nv",
    );
  });
});

describe("desfazerEspelho", () => {
  it("desembrulha links no formato real visto numa página espelhada", () => {
    const espelhada =
      '<a href="https://translate.google.com/website?sl=pt&amp;tl=en&amp;hl=en&amp;client=webapp&amp;u=https%3A%2F%2Fwww.jw.org%2Fpt%2Fbiblioteca%2Frevistas%2Fsentinela-estudo-novembro-2026%2FPastores-que-realmente-pastorear%C3%A3o">artigo</a>';
    expect(desfazerEspelho(espelhada)).toBe(
      '<a href="https://www.jw.org/pt/biblioteca/revistas/sentinela-estudo-novembro-2026/Pastores-que-realmente-pastorearão">artigo</a>',
    );
  });

  it("desembrulha link com consulta codificada", () => {
    const espelhada =
      'href="https://translate.google.com/website?sl=pt&amp;tl=en&amp;u=https%3A%2F%2Fb.jw-cdn.org%2Fapis%2Fpub-media%2FGETPUBMEDIALINKS%3Fissue%3D202611%26output%3Djson%26pub%3Dmwb"';
    expect(desfazerEspelho(espelhada)).toBe(
      'href="https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?issue=202611&output=json&pub=mwb"',
    );
  });

  it("devolve hosts na forma de caminho ao original", () => {
    expect(
      desfazerEspelho('img src="https://www-jw-org.translate.goog/assets/ct/08c9985de2/x.png"'),
    ).toBe('img src="https://www.jw.org/assets/ct/08c9985de2/x.png"');
    expect(desfazerEspelho('a href="https://b-jw-cdn-org.translate.goog/apis/x?y=1"')).toBe(
      'a href="https://b.jw-cdn.org/apis/x?y=1"',
    );
  });

  it("limpa entidades que sobram em urls duplamente embrulhadas", () => {
    const espelhada =
      'href="https://translate.google.com/website?sl=pt&amp;u=https%3A%2F%2Fwww.jw.org%2Fpt%2Fx%3F_x_tr_sl%3Dpt%26amp%3B_x_tr_tl%3Den"';
    expect(desfazerEspelho(espelhada)).toBe(
      'href="https://www.jw.org/pt/x?_x_tr_sl=pt&_x_tr_tl=en"',
    );
  });

  it("não altera HTML sem marca do espelho", () => {
    const direta = '<p data-pid="1" class="du-alternate">Texto &amp; mais</p>';
    expect(desfazerEspelho(direta)).toBe(direta);
  });
});
