import { useState } from "react";
import { CloudUpload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { iniciarAutorizacao, driveConfigurado, URL_DRIVE } from "@/lib/drive";
import { baixarBackup, compartilharBackup, type BackupPronto } from "@/lib/salvar-backup";

/** Dois caminhos para o backup: Drive e download.
 *
 *  "Salvar no Drive" abre a lista de contas Google do aparelho e sobe o arquivo
 *  direto para a conta escolhida (ver src/lib/drive.ts). Quando o Client ID
 *  ainda não foi configurado, cai no caminho antigo: folha de compartilhamento
 *  do Android e, se ela não existir, download com atalho para o Drive.
 *
 *  O botão aparece sempre. Dentro do TWA a Web Share API não funciona — o Chrome
 *  não propaga o gesto do usuário e `navigator.share` falha em silêncio —, então
 *  esconder o botão não resolveria nada. */
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

    if (driveConfigurado()) {
      // A página inteira vai para o Google e volta com o token. Não dá para usar
      // popup: dentro do TWA ele abre em outra aba e nunca devolve a resposta.
      window.location.assign(iniciarAutorizacao(window.location.origin));
      return;
    }

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
      {driveConfigurado() && !aviso && (
        <p className="text-center text-xs text-muted-foreground">
          O Google abre a lista de contas do aparelho: escolha em qual Drive quer guardar.
        </p>
      )}
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
