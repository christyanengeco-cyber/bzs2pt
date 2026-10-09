import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type Tema = "sistema" | "claro" | "escuro";

export function aplicarTema(tema: Tema) {
  const escuro = tema === "escuro" || (tema === "sistema" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", escuro);
  document.documentElement.dataset.tema = tema;
  localStorage.setItem("tema", tema);
}

export function ThemeToggle() {
  const [tema, setTema] = useState<Tema>("sistema");
  useEffect(() => {
    const salvo = localStorage.getItem("tema");
    const inicial: Tema = salvo === "claro" || salvo === "escuro" ? salvo : "sistema";
    setTema(inicial);
    aplicarTema(inicial);
  }, []);
  const Icone = tema === "claro" ? Sun : tema === "escuro" ? Moon : Monitor;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Aparência"><Icone className="h-5 w-5" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={tema} onValueChange={(valor) => { const novo = valor as Tema; setTema(novo); aplicarTema(novo); }}>
          <DropdownMenuRadioItem value="sistema">Seguir o celular</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="claro">Claro</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="escuro">Escuro</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
