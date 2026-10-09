import type { Anotacao, Paragrafo, Publicacao } from "./db";

export interface BackupEstudos {
  app: "estudo-em-libras";
  versao: 1;
  exportado_em: string;
  publicacoes: Publicacao[];
  paragrafos: Paragrafo[];
  anotacoes: Anotacao[];
}

export function validarBackup(valor: unknown): BackupEstudos {
  if (!valor || typeof valor !== "object") throw new Error("O arquivo não contém um backup válido.");
  const b = valor as Partial<BackupEstudos>;
  if (b.app !== "estudo-em-libras" || b.versao !== 1) throw new Error("Este formato de backup não é compatível.");
  if (!Array.isArray(b.publicacoes) || !Array.isArray(b.paragrafos) || !Array.isArray(b.anotacoes)) {
    throw new Error("O backup está incompleto.");
  }
  const publicacoesValidas = b.publicacoes.every((p) => p && typeof p.id === "string" && typeof p.titulo === "string");
  const paragrafosValidos = b.paragrafos.every((p) => p && typeof p.id === "string" && typeof p.publicacao_id === "string");
  const anotacoesValidas = b.anotacoes.every((a) => a && typeof a.id === "string" && typeof a.publicacao_id === "string");
  if (!publicacoesValidas || !paragrafosValidos || !anotacoesValidas) throw new Error("O backup contém registros inválidos.");
  return b as BackupEstudos;
}