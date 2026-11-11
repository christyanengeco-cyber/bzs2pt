import { DatabaseBackup, FileUp, Highlighter, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PASSOS = [
  {
    icone: FileUp,
    titulo: "Importe o estudo",
    texto:
      "Toque em “Importar estudo” e use o link do jw.org, um arquivo salvo do navegador ou o mês inteiro da apostila ou da Sentinela.",
  },
  {
    icone: PlayCircle,
    titulo: "Estude com o vídeo",
    texto:
      "O vídeo em Libras abre junto do texto. Cada parágrafo fica sincronizado com o momento certo do vídeo.",
  },
  {
    icone: Highlighter,
    titulo: "Marque e anote",
    texto:
      "Selecione o texto para destacar ou escrever uma nota. Tudo fica salvo no seu aparelho, mesmo sem internet.",
  },
  {
    icone: DatabaseBackup,
    titulo: "Proteja seus estudos",
    texto:
      "Em Configurações, use “Backup e restauração” para guardar seus estudos e anotações antes de trocar de celular.",
  },
];

/** Tutorial curto do app, aberto sozinho na primeira visita e depois pelo botão
 *  em Configurações. */
export function TutorialDialog({
  aberto,
  onOpenChange,
}: {
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
}) {
  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-lg bg-card">
        <DialogHeader>
          <DialogTitle>Como usar o app</DialogTitle>
          <DialogDescription>Quatro passos para começar.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-4">
          {PASSOS.map((passo, indice) => (
            <li key={passo.titulo} className="flex gap-3">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
                aria-hidden="true"
              >
                <passo.icone className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {indice + 1}. {passo.titulo}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{passo.texto}</p>
              </div>
            </li>
          ))}
        </ol>
        <Button className="mt-2 w-full" onClick={() => onOpenChange(false)}>
          Entendi
        </Button>
      </DialogContent>
    </Dialog>
  );
}
