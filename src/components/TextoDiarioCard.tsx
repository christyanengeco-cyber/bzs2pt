import { BookOpen, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { baixarPagina } from "@/lib/fetch-page.functions";
import {
  EVENTO_PREF,
  extrairReferencia,
  type Trecho,
  obterTextoDiario,
  textoDiarioAtivo,
  type TextoDiario,
} from "@/lib/texto-diario";

type Ref = { href: string; rotulo: string; titulo?: string; paragrafos?: string[]; erro?: boolean };

export function TextoDiarioCard() {
  const [ref, setRef] = useState<Ref | null>(null);
  const abrir = (href: string, rotulo: string) => {
    setRef({ href, rotulo });
    baixarPagina({ data: { url: href } })
      .then((r) => setRef((a) => a && a.href === href ? { ...a, ...extrairReferencia(r.texto, r.url) } : a))
      .catch(() => setRef((a) => a && a.href === href ? { ...a, erro: true } : a));
  };
  const linha = (ts: Trecho[]) =>
    ts.map((x, i) =>
      x.href ? (
        <button key={i} className="text-reference underline-offset-2 hover:underline" onClick={() => abrir(x.href!, x.t)}>
          {x.t}
        </button>
      ) : (
        <span key={i}>{x.t}</span>
      ),
    );
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
          <p className="font-medium italic text-primary">{linha(texto.tema)}</p>
          {aberto && texto.comentario.map((p, i) => (
            <p key={i} className="mt-2 text-sm leading-relaxed" style={{ fontSize: "inherit" }}>{linha(p)}</p>
          ))}
          <button className="mt-1 text-sm text-primary underline-offset-2 hover:underline" onClick={() => setAberto((a) => !a)}>
            {aberto ? "Recolher" : "Ler mais"}
          </button>
        </div>
      )}
      <Dialog open={!!ref} onOpenChange={(o) => !o && setRef(null)}>
        <DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg bg-card">
          <DialogHeader>
            <DialogTitle>{ref?.titulo || ref?.rotulo}</DialogTitle>
          </DialogHeader>
          {ref?.erro ? (
            <p className="text-sm text-muted-foreground">Não foi possível carregar. Verifique a internet.</p>
          ) : !ref?.paragrafos ? (
            <div className="h-24 animate-pulse rounded bg-muted" />
          ) : (
            <div className="space-y-3 leading-relaxed" style={{ fontSize: "calc(1rem * var(--escala-texto, 1))" }}>
              {ref.paragrafos.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          )}
          {ref && (
            <a href={ref.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary">
              <ExternalLink className="h-4 w-4" /> Abrir no jw.org
            </a>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
