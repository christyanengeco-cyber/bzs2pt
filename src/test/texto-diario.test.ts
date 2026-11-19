import { describe, expect, it } from "vitest";
import { extrairReferencia, extrairTextoDiario } from "@/lib/texto-diario";

const dia = `<!doctype html><html><body><div class="itemData">
<h2 id="p56">Quinta-feira, 19 de novembro</h2>
<p class="themeScrp"><em>Acheguem-se a Deus. —</em><a class="fn" href="/pt/wol/fn/r5/lp-t/1/1">*</a> <a href="/pt/wol/bc/r5/lp-t/1/2/0" class="b">Tia. 4:8</a></p>
<div class="bodyTxt"><p id="p58">Comentário <a href="/pt/wol/bc/r5/lp-t/1/3/0">Gên. 39:9</a> fim.</p></div>
</div></body></html>`;

const biblia = `<!doctype html><html><head><title>Tiago 4 — BIBLIOTECA ON-LINE da Torre de Vigia</title></head><body>
<div class="section" data-key="59-4-8"><span id="v59-4-8-1" class="v"><a class="vl vx vp">8 </a>Acheguem-se a Deus.<a class="fn" href="/pt/wol/fn/r5/lp-t/1/1">*</a><a class="b" href="/pt/wol/bc/r5/lp-t/1/1/0">+</a></span><span id="v59-4-8-2" class="v">Limpem as mãos.</span></div>
<div class="section" data-key="59-4-9"><span id="v59-4-9-1" class="v"><a class="vl">9 </a>Fiquem tristes.</span></div>
</body></html>`;

describe("texto diário", () => {
  it("extrai tema, comentário e links absolutos", () => {
    const texto = extrairTextoDiario(dia, "2026-11-19");
    expect(texto?.titulo).toBe("Quinta-feira, 19 de novembro");
    expect(texto?.tema.map((x) => x.t).join("")).toBe("Acheguem-se a Deus. — Tia. 4:8");
    expect(texto?.tema.find((x) => x.href)?.href).toBe("https://wol.jw.org/pt/wol/bc/r5/lp-t/1/2/0");
    expect(texto?.tema.some((x) => x.t.includes("*") || x.t.includes("+"))).toBe(false);
    expect(texto?.comentario[0]?.map((x) => x.t)).toContain("Gên. 39:9");
  });

  it("abre só o versículo citado quando o link não traz hash", () => {
    const ref = extrairReferencia(biblia, "https://wol.jw.org/pt/wol/b/r5/lp-t/nwtsty/59/4", "Tia. 4:8");
    expect(ref.titulo).toBe("Tiago 4:8");
    expect(ref.paragrafos).toHaveLength(1);
    expect(ref.paragrafos[0]).toContain("Acheguem-se a Deus.");
    expect(ref.paragrafos[0]).toContain("Limpem as mãos.");
    expect(ref.paragrafos.join(" ")).not.toMatch(/[*+]/);
    expect(ref.paragrafos[0]).not.toContain("Fiquem tristes");
  });

  it("mantém o recorte por parágrafo do hash #h=", () => {
    const pagina = `<html><body><h1>Estudo</h1><p id="p3">Parágrafo três.</p></body></html>`;
    const ref = extrairReferencia(pagina, "https://wol.jw.org/pt/wol/d/r5/lp-t/123#h=3:0-4:0");
    expect(ref.paragrafos).toEqual(["Parágrafo três."]);
  });
});