import type { BackupEstudos } from "@/lib/backup";
import { listarTodosDados } from "@/lib/db";

export interface BackupPronto {
  /** JSON completo, já serializado. Ver `montarBackup`. */
  conteudo: string;
  nome: string;
}

/** Nome fixo por data: dois backups no mesmo dia não se sobrescrevem no Drive. */
export function nomeDoBackup(data = new Date()): string {
  const iso = data.toISOString();
  return `estudo-em-libras-${iso.slice(0, 10)}-${iso.slice(11, 19).replace(/:/g, "")}.json`;
}

/** Monta o backup agora e devolve o arquivo pronto.
 *
 *  Chamar isto ANTES do clique é obrigatório para "Salvar no Drive": a Web
 *  Share API exige gesto do usuário, e qualquer `await` antes do
 *  `navigator.share` perde essa permissão. Por isso o diálogo monta o backup
 *  já na abertura e os botões só entregam o que está pronto. */
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

function arquivoDe(backup: BackupPronto): File {
  return new File([backup.conteudo], backup.nome, { type: "application/json" });
}

/** O aparelho sabe compartilhar arquivos (folha de compartilhamento com Drive)?
 *
 *  No TWA isso depende do Chrome instalado. Quando dá falso, o certo é cair no
 *  download normal em vez de oferecer um botão que não faz nada. */
export function podeCompartilhar(backup: BackupPronto): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [arquivoDe(backup)] });
  } catch {
    return false;
  }
}

export type ResultadoCompartilhar = "compartilhado" | "cancelado" | "indisponivel";

/** Abre a folha de compartilhamento do sistema (Drive, WhatsApp, arquivos…).
 *
 *  Não colocar `await` antes do `navigator.share`: o gesto do usuário expira e
 *  o Chrome recusa com NotAllowedError. */
export async function compartilharBackup(backup: BackupPronto): Promise<ResultadoCompartilhar> {
  if (!podeCompartilhar(backup)) return "indisponivel";
  try {
    await navigator.share({ title: "Backup dos estudos", files: [arquivoDe(backup)] });
    return "compartilhado";
  } catch (erro) {
    // AbortError = o usuário fechou a folha de compartilhamento; não é falha.
    if (erro instanceof Error && erro.name === "AbortError") return "cancelado";
    return "indisponivel";
  }
}

/** Salva direto na pasta de downloads do aparelho. Sempre funciona, por isso é
 *  o plano B de todo caminho de backup. */
export function baixarBackup(backup: BackupPronto): void {
  const url = URL.createObjectURL(new Blob([backup.conteudo], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = backup.nome;
  a.click();
  URL.revokeObjectURL(url);
}
