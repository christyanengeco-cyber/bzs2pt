import { useState } from "react";
import { CloudUpload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  baixarBackup,
  compartilharBackup,
  podeCompartilhar,
  type BackupPronto,
} from "@/lib/salvar-backup";

/** Dois caminhos para o backup: Drive (folha de compartilhamento) e download.
 *
 *  O botão do Drive só aparece quando o aparelho sabe compartilhar arquivo;
 *  caso contrário fica só o download, com aviso. Assim ninguém aperta um botão
 *  morto dentro do TWA, onde a Web Share API depende do Chrome instalado. */
export function BotoesBackup({
  pronto,
  className = "grid gap-2 sm:grid-cols-2",
}: {
  pronto: BackupPronto | null;
  className?: string;
}) {
  const [aviso, setAviso] = useState("");
  const compartilhavel = pronto ? podeCompartilhar(pronto) : false;

  const irParaDrive = async () => {
    if (!pronto) return;
    setAviso("");
    const resultado = await compartilharBackup(pronto);
    if (resultado === "compartilhado") setAviso("Backup entregue ao app escolhido.");
    if (resultado === "indisponivel") {
      baixarBackup(pronto);
      setAviso("Este aparelho não compartilha arquivo. O backup foi baixado.");
    }
  };

  return (
    <div className="space-y-2">
      <div className={className}>
        {compartilhavel && (
          <Button disabled={!pronto} onClick={irParaDrive}>
            <CloudUpload /> Salvar no Drive
          </Button>
        )}
        <Button
          variant={compartilhavel ? "outline" : "default"}
          disabled={!pronto}
          onClick={() => {
            if (!pronto) return;
            baixarBackup(pronto);
            setAviso("Backup salvo nos downloads.");
          }}
        >
          <Download /> Salvar no aparelho
        </Button>
      </div>
      {aviso && (
        <p role="status" className="text-center text-xs text-muted-foreground">
          {aviso}
        </p>
      )}
    </div>
  );
}
