import { afterEach, describe, expect, it, vi } from "vitest";
import {
  baixarBackup,
  nomeDoBackup,
  salvarEmPasta,
  suportaEscolherPasta,
} from "@/lib/salvar-backup";

/** O TypeScript do projeto não conhece a File System Access API: o teste
 *  instala e remove o seletor pela janela, como o navegador faria. */
type JanelaComSeletor = Window & { showSaveFilePicker?: unknown };

function instalarSeletor(fn: unknown) {
  (window as JanelaComSeletor).showSaveFilePicker = fn;
}

function removerSeletor() {
  delete (window as JanelaComSeletor).showSaveFilePicker;
}

describe("nome do arquivo de backup", () => {
  it("leva data e hora, para dois backups não se sobrescreverem", () => {
    const nome = nomeDoBackup(new Date("2026-11-11T13:05:09.000Z"));
    expect(nome).toBe("estudo-em-libras-2026-11-11-130509.json");
  });

  it("não usa caracteres inválidos para nome de arquivo", () => {
    expect(nomeDoBackup()).toMatch(/^estudo-em-libras-\d{4}-\d{2}-\d{2}-\d{6}\.json$/);
  });
});

describe("escolher a pasta de destino", () => {
  const pronto = { conteudo: '{"app":"estudo-em-libras"}', nome: "backup.json" };

  afterEach(() => {
    removerSeletor();
  });

  it("não promete escolher pasta onde o aparelho não suporta", () => {
    // jsdom não tem showSaveFilePicker: é o caso do Android.
    expect(suportaEscolherPasta()).toBe(false);
  });

  it("cai para o download quando não há seletor de pasta", async () => {
    await expect(salvarEmPasta(pronto)).resolves.toBe("sem-escolha");
  });

  it("grava o conteúdo na pasta escolhida", async () => {
    const escrito: Blob[] = [];
    instalarSeletor(async () => ({
      createWritable: async () => ({
        write: async (dados: Blob) => {
          escrito.push(dados);
        },
        close: async () => {},
      }),
    }));

    await expect(salvarEmPasta(pronto)).resolves.toBe("salvo");
    expect(escrito).toHaveLength(1);
    // jsdom 20 não tem Blob.text(): lê pelo FileReader, como o navegador faria.
    const lido = await new Promise<string>((ok, falhou) => {
      const leitor = new FileReader();
      leitor.onload = () => ok(String(leitor.result));
      leitor.onerror = () => falhou(leitor.error);
      leitor.readAsText(escrito[0] as Blob);
    });
    expect(lido).toBe(pronto.conteudo);
  });

  it("trata o cancelamento como cancelamento, não como falha", async () => {
    instalarSeletor(async () => {
      throw Object.assign(new Error("cancelado"), { name: "AbortError" });
    });

    await expect(salvarEmPasta(pronto)).resolves.toBe("cancelado");
  });

  it("cai para o download quando o seletor de pasta dá erro", async () => {
    instalarSeletor(async () => {
      throw new Error("sem permissão");
    });

    await expect(salvarEmPasta(pronto)).resolves.toBe("sem-escolha");
  });
});

describe("download do backup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("usa o nome do arquivo pronto e não deixa o blob preso na memória", () => {
    const criados: string[] = [];
    const revogados: string[] = [];
    URL.createObjectURL = vi.fn(() => {
      criados.push("blob:teste");
      return "blob:teste";
    });
    URL.revokeObjectURL = vi.fn((url: string) => revogados.push(url));
    const cliques: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      cliques.push(this.download);
    });

    baixarBackup({ conteudo: "{}", nome: "backup.json" });

    expect(cliques).toEqual(["backup.json"]);
    expect(revogados).toEqual(criados);
  });
});
