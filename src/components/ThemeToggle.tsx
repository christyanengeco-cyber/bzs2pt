import { Check, HelpCircle, Monitor, Moon, Settings, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AtualizacaoApp } from "@/components/AtualizacaoApp";
import { TutorialDialog } from "@/components/TutorialDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  aplicarCor,
  aplicarTema,
  CORES_INTERFACE,
  corValida,
  type CorInterface,
  type Tema,
} from "@/lib/appearance";

/** Uma seção do painel. Todas fecham e abrem, para o painel caber na tela do
 *  celular mesmo com tudo preenchido: cada categoria ocupa só a linha do título
 *  até o usuário pedir para abrir. */
function Secao({
  valor,
  titulo,
  children,
}: {
  valor: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem value={valor} className="border-b last:border-b-0">
      <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
        {titulo}
      </AccordionTrigger>
      <AccordionContent className="pb-4">{children}</AccordionContent>
    </AccordionItem>
  );
}

export function ThemeToggle() {
  const [tema, setTema] = useState<Tema>("sistema");
  const [cor, setCor] = useState<CorInterface>("lilas");
  const [escala, setEscala] = useState(1);
  const [tutorial, setTutorial] = useState(false);

  useEffect(() => {
    const salvo = localStorage.getItem("tema");
    const inicial: Tema = salvo === "claro" || salvo === "escuro" ? salvo : "sistema";
    setTema(inicial);
    aplicarTema(inicial);
    const corSalva = corValida(localStorage.getItem("cor-interface"));
    setCor(corSalva);
    aplicarCor(corSalva);
    const e = Number(localStorage.getItem("escala-texto")) || 1;
    setEscala(e);
    document.documentElement.style.setProperty("--escala-texto", String(e));
  }, []);

  const mudarEscala = (e: number) => {
    setEscala(e);
    localStorage.setItem("escala-texto", String(e));
    document.documentElement.style.setProperty("--escala-texto", String(e));
  };

  return (
    <>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Configurações" title="Configurações">
            <Settings className="h-5 w-5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-lg bg-card">
          <DialogHeader>
            <DialogTitle>Configurações</DialogTitle>
          </DialogHeader>
          <Accordion
            type="multiple"
            defaultValue={["aparencia"]}
            className="rounded-md border px-3"
          >
            <Secao valor="aparencia" titulo="Aparência">
              <div className="grid grid-cols-3 gap-1 rounded-md border p-1">
                {(
                  [
                    { id: "sistema", nome: "Sistema", icon: Monitor },
                    { id: "claro", nome: "Claro", icon: Sun },
                    { id: "escuro", nome: "Escuro", icon: Moon },
                  ] as const
                ).map((opcao) => (
                  <Button
                    key={opcao.id}
                    variant={tema === opcao.id ? "secondary" : "ghost"}
                    aria-pressed={tema === opcao.id}
                    className="flex h-16 flex-col gap-1 px-1 text-xs"
                    onClick={() => {
                      setTema(opcao.id);
                      aplicarTema(opcao.id);
                    }}
                  >
                    <opcao.icon />
                    {opcao.nome}
                  </Button>
                ))}
              </div>
            </Secao>

            <Secao valor="texto" titulo={`Tamanho do texto (${Math.round(escala * 100)}%)`}>
              <div className="flex items-center gap-3">
                <span className="text-xs">A</span>
                <input
                  type="range"
                  min={0.5}
                  max={1.8}
                  step={0.1}
                  value={escala}
                  onChange={(ev) => mudarEscala(+ev.target.value)}
                  aria-label="Tamanho do texto"
                  className="flex-1 accent-primary"
                />
                <span className="text-xl font-bold">A</span>
              </div>
            </Secao>

            <Secao valor="cor" titulo="Cor de destaque">
              <div className="grid grid-cols-4 justify-items-center gap-3">
                {CORES_INTERFACE.map((opcao) => (
                  <Button
                    key={opcao.id}
                    variant="ghost"
                    size="icon"
                    data-swatch={opcao.id}
                    aria-label={opcao.nome}
                    title={opcao.nome}
                    aria-pressed={cor === opcao.id}
                    className="accent-swatch h-11 w-11 rounded-full border-2 border-transparent"
                    onClick={() => {
                      setCor(opcao.id);
                      aplicarCor(opcao.id);
                    }}
                  >
                    {cor === opcao.id && <Check />}
                  </Button>
                ))}
              </div>
            </Secao>

            <Secao valor="app" titulo="App e atualizações">
              <AtualizacaoApp />
            </Secao>
          </Accordion>

          <Button variant="outline" className="w-full" onClick={() => setTutorial(true)}>
            <HelpCircle /> Tutorial
          </Button>
        </DialogContent>
      </Dialog>
      <TutorialDialog aberto={tutorial} onOpenChange={setTutorial} />
    </>
  );
}
