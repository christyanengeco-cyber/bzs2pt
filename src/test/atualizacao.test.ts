import { describe, expect, it } from "vitest";
import { compararVersao, haAtualizacao } from "@/lib/atualizacao";
import { BUILD } from "@/lib/build";

describe("comparação de versões do app", () => {
  it("ordena por número, não por texto", () => {
    expect(compararVersao("1.10.0", "1.9.9")).toBeGreaterThan(0);
    expect(compararVersao("1.4.0", "1.4.0")).toBe(0);
    expect(compararVersao("1.4.0", "1.4.1")).toBeLessThan(0);
  });

  it("ignora o prefixo v", () => {
    expect(compararVersao("v1.4.0", "1.4.0")).toBe(0);
  });

  it("trata partes faltando como zero", () => {
    expect(compararVersao("1.5", "1.5.0")).toBe(0);
    expect(compararVersao("2", "1.99.99")).toBeGreaterThan(0);
  });

  it("só avisa atualização quando a versão instalada é a do APK", () => {
    expect(haAtualizacao(null)).toBe(false);
    expect(haAtualizacao(BUILD.versao)).toBe(false);
    expect(haAtualizacao("0.0.1")).toBe(true);
  });
});
