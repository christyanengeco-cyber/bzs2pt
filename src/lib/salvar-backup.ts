import type { BackupEstudos } from "@/lib/backup";
import { listarTodosDados } from "@/lib/db";

export interface BackupPronto {
  /** JSON completo, já serializado. Ver `montarBackup`. */
  conteudo: string;
  nome: string;
}

/** Nome fixo por data: dois backups no mesmo dia não se sobrescrevem. */
export function nomeDoBackup(data = new Date()): string {
  const iso = data.toISOString();
  return `estudo-em-libras-${iso.slice(0, 10)}-${iso.slice(11, 19).replace(/:/g, "")}.json`;
}

/** Monta o backup agora e devolve o arquivo pronto.
 *
 *  Chamar isto ANTES do clique é obrigatório para "Salvar em uma pasta":
 *  `showSaveFilePicker` exige gesto do usuário, e qualquer `await` antes dele
 *  perde essa permissão. Por isso o diálogo monta o backup já na abertura e o
 *  botão só entrega o que está pronto. */
export async function montarBackup(): Promise<BackupPronto> {
  const dados = await listarTodosDados();
  const conteudo: BackupEstudos = {
    app: "estudo-em-libras",
    versao: 1,
    exportado_em: new Date().toISOString(),
    ...dados,
  };
  return { conteudo: JSON.stringify(conteudo), nome: nomeDoBackup() };
}

/** Só o que usamos da File System Access API, para não depender de `any`. */
interface SeletorDePasta {
  showSaveFilePicker?: (opcoes: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{
    createWritable: () => Promise<{
      write: (dados: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
}

/** O aparelho deixa escolher a pasta de destino?
 *
 *  Só navegador de computador tem `showSaveFilePicker`. No Android não existe —
 *  nem no Chrome nem dentro do app — e nenhuma página pode escolher a pasta:
 *  o download vai sempre para a pasta configurada no Chrome. Por isso o botão
 *  cai no download comum em vez de prometer algo que não acontece. */
export function suportaEscolherPasta(): boolean {
  if (typeof window === "undefined") return false;
  return typeof (window as unknown as SeletorDePasta).showSaveFilePicker === "function";
}

export type ResultadoSalvar = "salvo" | "cancelado" | "sem-escolha";

/** Abre a janela "salvar como" com a pasta escolhida pelo usuário.
 *
 *  Devolve `sem-escolha` quando o aparelho não suporta — o chamador então baixa
 *  do jeito normal, para o backup nunca depender disso. */
export async function salvarEmPasta(backup: BackupPronto): Promise<ResultadoSalvar> {
  const seletor = window as unknown as SeletorDePasta;
  if (typeof seletor.showSaveFilePicker !== "function") return "sem-escolha";

  try {
    const arquivo = await seletor.showSaveFilePicker({
      suggestedName: backup.nome,
      types: [{ description: "Backup dos estudos", accept: { "application/json": [".json"] } }],
    });
    const fluxo = await arquivo.createWritable();
    await fluxo.write(new Blob([backup.conteudo], { type: "application/json" }));
    await fluxo.close();
    return "salvo";
  } catch (erro) {
    // AbortError = o usuário fechou a janela de salvar; não é falha.
    if (erro instanceof Error && erro.name === "AbortError") return "cancelado";
    return "sem-escolha";
  }
}

/** Salva direto na pasta de downloads do aparelho. É o caminho que sempre
 *  funciona, e o único possível no Android. */
export function baixarBackup(backup: BackupPronto): void {
  const url = URL.createObjectURL(new Blob([backup.conteudo], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = backup.nome;
  a.click();
  URL.revokeObjectURL(url);
}
