import { describe, expect, it } from "vitest";
import { escolherSemanaInicial, extrairIntervaloSemana, intervaloDaPublicacao, ordenarSemanasCronologicamente } from "@/lib/study-dates";
import type { Publicacao } from "@/lib/db";

const pub = (id: string, semana_inicio: string, semana_fim: string): Publicacao => ({
  id, tipo: "sentinela", titulo: id, semana: id, semana_inicio, semana_fim,
  url_origem: `https://www.jw.org/${id}`, video_url: "", criado_em: 1,
});

describe("datas de estudo", () => {
  it.each(["26 de outubro–1º de novembro", "26 de outubro–1.º de novembro", "26 de outubro–1 de novembro"])("reconhece a virada de outubro: %s", (label) => {
    expect(extrairIntervaloSemana(label, 2026)).toEqual({ inicio: "2026-10-26", fim: "2026-11-01" });
  });
  it("recupera a semana já importada com apenas a data inicial", () => {
    const estudo = { ...pub("antigo", "2026-10-19", "2026-10-25"), semana: "26 de outubro", url_origem: "https://www.jw.org/bzs/2026/", criado_em: new Date(2026, 9, 26).getTime() };
    expect(intervaloDaPublicacao(estudo)).toEqual({ inicio: "2026-10-26", fim: "2026-11-01" });
    expect(escolherSemanaInicial([pub("anterior", "2026-10-19", "2026-10-25"), estudo], "2026-10-28")).toEqual({ id: "antigo", atual: true });
  });
  it("seleciona a semana de novembro após a de outubro", () => {
    const estudos = [pub("outubro", "2026-10-26", "2026-11-01"), pub("novembro", "2026-11-02", "2026-11-08")];
    expect(escolherSemanaInicial(estudos, "2026-11-03")).toEqual({ id: "novembro", atual: true });
  });
  it("mostra a anterior à esquerda e a próxima à direita sem alterar a seleção inicial", () => {
    const estudos = [pub("proxima", "2026-10-12", "2026-10-18"), pub("anterior", "2026-09-28", "2026-10-04"), pub("atual", "2026-10-05", "2026-10-11")];
    const ordenados = estudos.sort(ordenarSemanasCronologicamente);
    expect(ordenados.map((p) => p.id)).toEqual(["anterior", "atual", "proxima"]);
    expect(escolherSemanaInicial(ordenados, "2026-10-09")).toEqual({ id: "atual", atual: true });
    expect(escolherSemanaInicial(ordenados, "2026-10-25")).toEqual({ id: "proxima", atual: false });
  });
  it("interpreta semanas no mesmo mês", () => {
    expect(extrairIntervaloSemana("12–18 de outubro de 2026")).toEqual({ inicio: "2026-10-12", fim: "2026-10-18" });
  });

  it("interpreta semanas na virada do ano", () => {
    expect(extrairIntervaloSemana("28 de dezembro–3 de janeiro de 2027")).toEqual({ inicio: "2026-12-28", fim: "2027-01-03" });
  });

  it("escolhe a semana atual ou a anterior mais recente", () => {
    const estudos = [pub("anterior", "2026-10-05", "2026-10-11"), pub("atual", "2026-10-12", "2026-10-18")];
    expect(escolherSemanaInicial(estudos, "2026-10-14")).toEqual({ id: "atual", atual: true });
    expect(escolherSemanaInicial(estudos, "2026-10-25")).toEqual({ id: "atual", atual: false });
  });
});