import { describe, expect, it } from "vitest";
import { escolherSemanaInicial, extrairIntervaloSemana } from "@/lib/study-dates";
import type { Publicacao } from "@/lib/db";

const pub = (id: string, semana_inicio: string, semana_fim: string): Publicacao => ({
  id, tipo: "sentinela", titulo: id, semana: id, semana_inicio, semana_fim,
  url_origem: `https://www.jw.org/${id}`, video_url: "", criado_em: 1,
});

describe("datas de estudo", () => {
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