import { Check, Monitor, Moon, Settings, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { aplicarCor, aplicarTema, CORES_INTERFACE, corValida, type CorInterface, type Tema } from "@/lib/appearance";

export function ThemeToggle() {
  const [tema, setTema] = useState<Tema>("sistema");
  const [cor, setCor] = useState<CorInterface>("lilas");
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
  const [escala, setEscala] = useState(1);
  const mudarEscala = (e: number) => { setEscala(e); localStorage.setItem("escala-texto", String(e)); document.documentElement.style.setProperty("--escala-texto", String(e)); };
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Configurações" title="Configurações"><Settings className="h-5 w-5" /></Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-lg bg-card">
        <DialogHeader><DialogTitle>Configurações</DialogTitle></DialogHeader>
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">Aparência</legend>
          <div className="grid grid-cols-3 gap-1 rounded-md border p-1">
            {([{ id: "sistema", nome: "Sistema", icon: Monitor }, { id: "claro", nome: "Claro", icon: Sun }, { id: "escuro", nome: "Escuro", icon: Moon }] as const).map((opcao) => (
              <Button key={opcao.id} variant={tema === opcao.id ? "secondary" : "ghost"} aria-pressed={tema === opcao.id} className="flex h-16 flex-col gap-1 px-1 text-xs" onClick={() => { setTema(opcao.id); aplicarTema(opcao.id); }}><opcao.icon />{opcao.nome}</Button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">Tamanho do texto ({Math.round(escala * 100)}%)</legend>
          <div className="flex items-center gap-3">
            <span className="text-xs">A</span>
            <input type="range" min={0.5} max={1.8} step={0.1} value={escala} onChange={(ev) => mudarEscala(+ev.target.value)} aria-label="Tamanho do texto" className="flex-1 accent-primary" />
            <span className="text-xl font-bold">A</span>
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">Cor de destaque</legend>
          <div className="grid grid-cols-4 justify-items-center gap-3">
            {CORES_INTERFACE.map((opcao) => (
              <Button key={opcao.id} variant="ghost" size="icon" data-swatch={opcao.id} aria-label={opcao.nome} title={opcao.nome} aria-pressed={cor === opcao.id} className="accent-swatch h-11 w-11 rounded-full border-2 border-transparent" onClick={() => { setCor(opcao.id); aplicarCor(opcao.id); }}>{cor === opcao.id && <Check />}</Button>
            ))}
          </div>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
}
