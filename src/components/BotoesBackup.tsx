import { useState } from "react";
import { CloudUpload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { baixarBackup, compartilharBackup, type BackupPronto } from "@/lib/salvar-backup";

/** Página inicial do Drive, aberta quando o compartilhamento não existe. */
const URL_DRIVE = "https://drive.google.com/drive/my-drive";

/** Dois caminhos para o backup: Drive e download.
 *
 *  O botão do Drive aparece SEMPRE. Motivo: dentro do TWA a Web Share API não
 *  funciona — o Chrome não propaga o gesto do usuário e `navigator.share` falha
 *  em silêncio —, então esconder o botão não resolveria nada. Quando o
 *  compartilhamento não está disponível, o arquivo é baixado e o app oferece o
 *  link do Drive para o envio manual, que é o único caminho possível sem código
 *  nativo.
 *
 *  Upload automático (OAuth da Drive API) foi tentado e descartado: em modo de
 *  teste o Google exige que cada conta seja cadastrada antes, o que não escala
 *  para todos os que usam o app. Ver histórico do repositório se um dia voltar. */
export function BotoesBackup({
  pronto,
  className = "grid gap-2 sm:grid-cols-2",
}: {
  pronto: BackupPronto | null;
  className?: string;
}) {
  const [aviso, setAviso] = useState("");
  const [envioManual, setEnvioManual] = useState(false);

  const irParaDrive = async () => {
    if (!pronto) return;
    setAviso("");
    setEnvioManual(false);

    const resultado = await compartilharBackup(pronto);
    if (resultado === "compartilhado") {
      setAviso("Backup entregue ao app escolhido.");
      return;
    }
    if (resultado === "cancelado") return;

    // Sem folha de compartilhamento: o arquivo já foi baixado, falta enviar.
    baixarBackup(pronto);
    setEnvioManual(true);
    setAviso("Backup baixado em Downloads. Envie pelo Drive com + › Enviar.");
  };

  return (
    <div className="space-y-2">
      <div className={className}>
        <Button disabled={!pronto} onClick={irParaDrive}>
          <CloudUpload /> Salvar no Drive
        </Button>
        <Button
          variant="outline"
          disabled={!pronto}
          onClick={() => {
            if (!pronto) return;
            baixarBackup(pronto);
            setEnvioManual(false);
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
      {envioManual && (
        <a
          href={URL_DRIVE}
          target="_blank"
          rel="noreferrer"
          className="block text-center text-xs font-semibold text-primary underline"
        >
          Abrir o Drive para enviar o arquivo
        </a>
      )}
    </div>
  );
}
