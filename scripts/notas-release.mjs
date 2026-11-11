// Imprime as mudanças da versão atual em Markdown, para as notas do release.
// Lê de src/lib/build.ts — a mesma fonte que o app mostra no rodapé.
import { readFileSync } from "node:fs";

const fonte = readFileSync(new URL("../src/lib/build.ts", import.meta.url), "utf8");
const bloco = fonte.match(/mudancas:\s*\[([\s\S]*?)\]/);

if (!bloco) {
  console.error("Bloco `mudancas` não encontrado em src/lib/build.ts");
  process.exit(1);
}

const itens = [...bloco[1].matchAll(/"([^"]+)"/g)].map((m) => m[1].trim()).filter(Boolean);

console.log(itens.map((item) => `- ${item}`).join("\n"));
