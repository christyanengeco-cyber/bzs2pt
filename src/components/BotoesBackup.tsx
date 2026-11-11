import { useState } from "react";
import { Download, FolderDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  baixarBackup,
  salvarEmPasta,
  suportaEscolherPasta,
  type BackupPronto,
} from "@/lib/salvar-backup";

/** Um único caminho: salvar o backup como arquivo.
 *
 *  No computador o navegador abre "salvar como" e o usuário escolhe a pasta. No
 *  celular isso não existe — o Android não deixa página escolher pasta —, então
 *  o arquivo vai para Downloads e o aviso diz onde encontrá-lo.
 *
 *  Envio automático para o Drive (OAuth) foi tentado e descartado: em modo de
 *  teste o Google exige cadastrar cada conta antes, o que não escala para todos
 *  os que usam o app. Ver histórico do repositório. */
export function BotoesBackup({ pronto }: { pronto: BackupPronto | null }) {
  const [aviso, setAviso] = useState("");
  const escolhePasta = suportaEscolherPasta();

  const salvar = async () => {
    if (!pronto) return;
    setAviso("");

    // Sem suporte, baixa na hora: `await` à toa aqui só adia o download.
    if (!escolhePasta) {
      baixarBackup(pronto);
      setAviso(`Backup salvo em Downloads: ${pronto.nome}`);
      return;
    }

    const resultado = await salvarEmPasta(pronto);
    if (resultado === "salvo") {
      setAviso("Backup salvo na pasta escolhida.");
      return;
    }
    if (resultado === "cancelado") return;

    baixarBackup(pronto);
    setAviso(`Backup salvo em Downloads: ${pronto.nome}`);
  };

  return (
    <div className="space-y-2">
      <Button className="w-full" disabled={!pronto} onClick={salvar}>
        {escolhePasta ? <FolderDown /> : <Download />}
        {escolhePasta ? "Escolher pasta e salvar" : "Baixar backup"}
      </Button>
      {aviso ? (
        <p role="status" className="text-center text-xs text-muted-foreground">
          {aviso}
        </p>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          {escolhePasta
            ? "O navegador pergunta em qual pasta guardar o arquivo."
            : "Vai para a pasta Downloads do aparelho. Para mudar, use Configurações do Chrome › Downloads."}
        </p>
      )}
    </div>
  );
}
