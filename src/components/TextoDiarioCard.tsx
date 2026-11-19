import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { baixarPagina } from "@/lib/fetch-page.functions";
import {
  EVENTO_PREF,
  obterTextoDiario,
  textoDiarioAtivo,
  type TextoDiario,
} from "@/lib/texto-diario";

export function TextoDiarioCard() {
  const [ativo, setAtivo] = useState(false);
  const [desvio, setDesvio] = useState(0);
  const [texto, setTexto] = useState<TextoDiario | null>(null);
  const [erro, setErro] = useState(false);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const ler = () => setAtivo(textoDiarioAtivo());
    ler();
    window.addEventListener(EVENTO_PREF, ler);
    return () => window.removeEventListener(EVENTO_PREF, ler);
  }, []);

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    const d = new Date();
    d.setDate(d.getDate() + desvio);
    setTexto(null);
    setErro(false);
    obterTextoDiario(d, async (url) => (await baixarPagina({ data: { url } })).texto)
      .then((t) => vivo && setTexto(t))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [ativo, desvio]);

  if (!ativo) return null;

  return (
    <section className="border-b bg-card px-4 py-3" aria-label="Texto diário">
      <div className="mb-1 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-primary" />
        <span className="flex-1 text-sm font-semibold">
          {texto?.titulo || "Texto diário"}
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Dia anterior" onClick={() => setDesvio((v) => v - 1)}>
          <ChevronLeft />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Próximo dia" onClick={() => setDesvio((v) => v + 1)}>
          <ChevronRight />
        </Button>
      </div>
      {erro ? (
        <p className="text-sm text-muted-foreground">Não foi possível carregar o texto diário. Verifique a internet.</p>
      ) : !texto ? (
        <div className="h-10 animate-pulse rounded bg-muted" />
      ) : (
        <div style={{ fontSize: "calc(1rem * var(--escala-texto, 1))" }}>
          <p className="font-medium italic text-primary">{texto.tema}</p>
          {aberto && texto.comentario.map((p, i) => (
            <p key={i} className="mt-2 text-sm leading-relaxed" style={{ fontSize: "inherit" }}>{p}</p>
          ))}
          <button className="mt-1 text-sm text-primary underline-offset-2 hover:underline" onClick={() => setAberto((a) => !a)}>
            {aberto ? "Recolher" : "Ler mais"}
          </button>
        </div>
      )}
    </section>
  );
}
