import { describe, expect, it } from "vitest";
import { nomeDoBackup, podeCompartilhar } from "@/lib/salvar-backup";

describe("nome do arquivo de backup", () => {
  it("leva data e hora, para dois backups não se sobrescreverem", () => {
    const nome = nomeDoBackup(new Date("2026-11-11T13:05:09.000Z"));
    expect(nome).toBe("estudo-em-libras-2026-11-11-130509.json");
  });

  it("não usa caracteres inválidos para nome de arquivo", () => {
    expect(nomeDoBackup()).toMatch(/^estudo-em-libras-\d{4}-\d{2}-\d{2}-\d{6}\.json$/);
  });
});

describe("compartilhamento de arquivo", () => {
  it("cai para download quando o aparelho não expõe Web Share", () => {
    // jsdom não implementa navigator.canShare: é o caso do aparelho sem suporte.
    const pronto = { conteudo: "{}", nome: "backup.json" };
    expect(podeCompartilhar(pronto)).toBe(false);
  });
});
