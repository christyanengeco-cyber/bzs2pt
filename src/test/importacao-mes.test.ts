import { describe, expect, it } from "vitest";
import {
  candidatosDeEdicao,
  edicoesDoIndice,
  extrairEstudosDaEdicao,
  mesDeslocado,
  rotuloDoMes,
} from "@/lib/importacao-mes";

const INDICE_APOSTILA = `
  <a href="/bzs/biblioteca/jw-apostila-do-mes/">Apostilas</a>
  <a href="/bzs/biblioteca/jw-apostila-do-mes/novembro-dezembro-2026-mwb/">Novembro-dezembro de 2026</a>
  <a href="/bzs/biblioteca/jw-apostila-do-mes/janeiro-fevereiro-2027-mwb/">Janeiro-fevereiro de 2027</a>
`;

const INDICE_SENTINELA = `
  <a href="/bzs/biblioteca/revistas/">Revistas</a>
  <a href="/bzs/biblioteca/revistas/sentinela-estudo-setembro-2026/">Setembro de 2026</a>
  <a href="/bzs/biblioteca/revistas/sentinela-estudo-outubro-2026/">Outubro de 2026</a>
  <a href="/bzs/biblioteca/revistas/sentinela-estudo-novembro-2026/">Novembro de 2026</a>
`;

const EDICAO_APOSTILA = (base: string) => `
  <div class="synopsis">
    <div class="syn-body"><h2><a href="${base}semana-2-8/">2-8 de novembro</a></h2></div>
  </div>
  <div class="synopsis">
    <div class="syn-body"><h2><a href="${base}semana-30-11/">30 de novembro-6 de dezembro</a></h2></div>
  </div>
  <div class="synopsis">
    <div class="syn-body"><h2><a href="${base}semana-7-13/">7-13 de dezembro</a></h2></div>
  </div>
  <div class="synopsis">
    <div class="syn-body"><h2><a href="${base}semana-28-12/">28 de dezembro de 2026-3 de janeiro de 2027</a></h2></div>
  </div>
  <div class="synopsis">
    <div class="syn-body"><h2><a href="${base}referencias/">Referências para a Apostila</a></h2></div>
  </div>
`;

const BASE_APOSTILA =
  "https://www.jw.org/bzs/biblioteca/jw-apostila-do-mes/novembro-dezembro-2026-mwb/";

const EDICAO_SENTINELA = `
  <div class="synopsis">
    <div class="syn-body">
      <p class="contextTitle">4-10 DE JANEIRO DE 2027</p>
      <h2><a href="estudo-1/">Artigo um</a></h2>
    </div>
  </div>
  <div class="synopsis">
    <div class="syn-body">
      <p class="contextTitle">11-17 DE JANEIRO DE 2027</p>
      <h2><a href="estudo-2/">Artigo dois</a></h2>
    </div>
  </div>
  <div class="synopsis">
    <div class="syn-body"><h2><a href="voce-sabia/">Você Sabia?</a></h2></div>
  </div>
  <div class="synopsis">
    <div class="syn-body"><h2><a href="estudo-3/">Estudo sem data</a></h2></div>
  </div>
`;

const BASE_SENTINELA = "https://www.jw.org/bzs/biblioteca/revistas/sentinela-estudo-novembro-2026/";

describe("edição do mês", () => {
  it("lista só as edições da pasta da publicação", () => {
    expect(edicoesDoIndice(INDICE_APOSTILA, "apostila").map((e) => e.rotulo)).toEqual([
      "Novembro-dezembro de 2026",
      "Janeiro-fevereiro de 2027",
    ]);
    expect(edicoesDoIndice(INDICE_SENTINELA, "sentinela")).toHaveLength(3);
  });

  it("tenta a Sentinela de dois meses antes primeiro", () => {
    const edicoes = edicoesDoIndice(INDICE_SENTINELA, "sentinela");
    const candidatos = candidatosDeEdicao(edicoes, "sentinela", 2027, 0);
    expect(candidatos[0]?.rotulo).toBe("Novembro de 2026");
  });

  it("usa a edição bimestral que contém dezembro", () => {
    const edicoes = edicoesDoIndice(INDICE_APOSTILA, "apostila");
    const candidatos = candidatosDeEdicao(edicoes, "apostila", 2026, 11);
    expect(candidatos[0]?.url).toContain("novembro-dezembro-2026-mwb");
  });
});

describe("estudos do mês", () => {
  it("separa as semanas da apostila pelo mês de início", () => {
    const novembro = extrairEstudosDaEdicao(
      EDICAO_APOSTILA(BASE_APOSTILA),
      BASE_APOSTILA,
      "apostila",
      2026,
      10,
    );
    expect(novembro.map((e) => e.inicio)).toEqual(["2026-11-02", "2026-11-30"]);

    const dezembro = extrairEstudosDaEdicao(
      EDICAO_APOSTILA(BASE_APOSTILA),
      BASE_APOSTILA,
      "apostila",
      2026,
      11,
    );
    expect(dezembro.map((e) => e.inicio)).toEqual(["2026-12-07", "2026-12-28"]);
  });

  it("ignora referências sem data", () => {
    const novembro = extrairEstudosDaEdicao(
      EDICAO_APOSTILA(BASE_APOSTILA),
      BASE_APOSTILA,
      "apostila",
      2026,
      10,
    );
    expect(novembro.some((e) => /refer/i.test(e.titulo))).toBe(false);
  });

  it("na Sentinela só entram artigos com semana de estudo", () => {
    const janeiro = extrairEstudosDaEdicao(EDICAO_SENTINELA, BASE_SENTINELA, "sentinela", 2027, 0);
    expect(janeiro.map((e) => e.titulo)).toEqual(["Artigo um", "Artigo dois"]);
    expect(janeiro[0]?.semana).toBe("4-10 DE JANEIRO DE 2027");
    expect(janeiro[0]?.url).toBe(`${BASE_SENTINELA}estudo-1/`);
  });
});

describe("mês de referência", () => {
  it("vira o ano ao pedir o próximo mês em dezembro", () => {
    expect(mesDeslocado(0, new Date(2026, 10, 11))).toEqual({ ano: 2026, mes: 10 });
    expect(mesDeslocado(1, new Date(2026, 11, 15))).toEqual({ ano: 2027, mes: 0 });
    expect(rotuloDoMes(2026, 10)).toBe("Novembro de 2026");
  });
});
