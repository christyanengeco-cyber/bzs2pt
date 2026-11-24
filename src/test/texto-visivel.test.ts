import { describe, expect, it } from "vitest";
import { textoVisivel } from "@/lib/publication-layout";
describe("textoVisivel na Bíblia", () => {
  it("remove + e * do versículo", () => {
    const d = new DOMParser().parseFromString(
      '<span id="v"><sup>1</sup> O livro da história<a class="footnoteLink">*</a> de Davi,<a class="xrefLink">+</a> fim.</span>',
      "text/html",
    );
    expect(textoVisivel(d.getElementById("v"))).toBe("O livro da história de Davi, fim.");
  });
});
