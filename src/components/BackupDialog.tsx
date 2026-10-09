import { useRef, useState } from "react";
import { Download, FileUp, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listarTodosDados, restaurarDados } from "@/lib/db";
import { validarBackup, type BackupEstudos } from "@/lib/backup";

export function BackupDialog({ aberto, onOpenChange, onRestored }: { aberto: boolean; onOpenChange: (aberto: boolean) => void; onRestored: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [backup, setBackup] = useState<BackupEstudos | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function exportar() {
    const dados = await listarTodosDados();
    const conteudo: BackupEstudos = { app: "estudo-em-libras", versao: 1, exportado_em: new Date().toISOString(), ...dados };
    const url = URL.createObjectURL(new Blob([JSON.stringify(conteudo)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `estudo-em-libras-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
    if (substituir && !confirm("Substituir todos os estudos atuais pelo conteúdo deste backup? Esta ação não pode ser desfeita.")) return;
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
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
        <DialogHeader>
          <DialogTitle>Backup e restauração</DialogTitle>
          <DialogDescription>Guarde estudos, marcações, notas, tempos e itens ocultos em um arquivo no seu aparelho.</DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-3 border-y py-4 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p>O arquivo é criado no seu aparelho. Nenhum conteúdo é enviado para uma conta.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button onClick={exportar}><Download /> Exportar backup</Button>
          <Button variant="outline" onClick={() => input.current?.click()}><FileUp /> Escolher arquivo</Button>
          <input ref={input} type="file" accept="application/json,.json" className="hidden" onChange={(e) => lerArquivo(e.target.files?.[0])} />
        </div>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        {backup && (
          <div className="space-y-4 border-t pt-4">
            <div>
              <p className="font-semibold">Backup pronto para restaurar</p>
              <p className="text-sm text-muted-foreground">{backup.publicacoes.length} estudos, {backup.paragrafos.length} trechos e {backup.anotacoes.length} anotações ou marcações.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button disabled={ocupado} onClick={() => restaurar(false)}>Mesclar com os atuais</Button>
              <Button disabled={ocupado} variant="destructive" onClick={() => restaurar(true)}>Substituir tudo</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}