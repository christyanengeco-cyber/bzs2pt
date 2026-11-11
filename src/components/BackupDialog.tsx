import { useEffect, useRef, useState } from "react";
import { FileUp, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotoesBackup } from "@/components/BotoesBackup";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { restaurarDados } from "@/lib/db";
import { validarBackup, type BackupEstudos } from "@/lib/backup";
import { ROTULO_BUILD } from "@/lib/build";
import { montarBackup, type BackupPronto } from "@/lib/salvar-backup";

export function BackupDialog({
  aberto,
  onOpenChange,
  onRestored,
}: {
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  onRestored: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [backup, setBackup] = useState<BackupEstudos | null>(null);
  const [pronto, setPronto] = useState<BackupPronto | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  // O arquivo é montado na abertura, não no clique: a Web Share API exige gesto
  // do usuário e qualquer espera antes de compartilhar invalida o gesto.
  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    setPronto(null);
    montarBackup()
      .then((arquivo) => vivo && setPronto(arquivo))
      .catch(() => vivo && setErro("Não foi possível montar o backup agora."));
    return () => {
      vivo = false;
    };
  }, [aberto]);

  async function lerArquivo(file?: File) {
    if (!file) return;
    setErro("");
    setBackup(null);
    try {
      setBackup(validarBackup(JSON.parse(await file.text())));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o backup.");
    }
  }

  async function restaurar(substituir: boolean) {
    if (!backup) return;
    if (
      substituir &&
      !confirm(
        "Substituir todos os estudos atuais pelo conteúdo deste backup? Esta ação não pode ser desfeita.",
      )
    )
      return;
    setOcupado(true);
    try {
      await restaurarDados(backup, substituir);
      setBackup(null);
      onRestored();
      onOpenChange(false);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] rounded-lg">
        <DialogHeader>
          <DialogTitle>Backup e restauração</DialogTitle>
          <DialogDescription>
            Guarde estudos, marcações, notas, tempos e itens ocultos em um arquivo seu.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-3 border-y py-4 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p>
            O arquivo é criado no seu aparelho. Nenhum conteúdo é enviado para uma conta do app.
          </p>
        </div>
        <BotoesBackup pronto={pronto} />
        <Button variant="outline" className="w-full" onClick={() => input.current?.click()}>
          <FileUp /> Restaurar de um arquivo
        </Button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => lerArquivo(e.target.files?.[0])}
        />
        {erro && (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        )}
        <p className="pt-2 text-center text-xs text-muted-foreground">
          Versão do app: {ROTULO_BUILD}
        </p>
        {backup && (
          <div className="space-y-4 border-t pt-4">
            <div>
              <p className="font-semibold">Backup pronto para restaurar</p>
              <p className="text-sm text-muted-foreground">
                {backup.publicacoes.length} estudos, {backup.paragrafos.length} trechos e{" "}
                {backup.anotacoes.length} anotações ou marcações.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button disabled={ocupado} onClick={() => restaurar(false)}>
                Mesclar com os atuais
              </Button>
              <Button disabled={ocupado} variant="destructive" onClick={() => restaurar(true)}>
                Substituir tudo
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
