import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, CalendarDays, Check, Link2, Loader2, Plus, Trash2, X } from "lucide-react";
import { excluirPublicacao, listarPublicacoes, salvarPublicacao, type Publicacao, type TipoPub } from "@/lib/db";
import { importarUrl, listarArtigos, type ArtigoRevista } from "@/lib/parser";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Biblioteca — Estudo em Libras" },
      { name: "description", content: "Importe matérias do jw.org em Libras e estude com vídeo sincronizado ao texto." },
      { property: "og:title", content: "Biblioteca — Estudo em Libras" },
      { property: "og:description", content: "Estudo pessoal bilíngue Libras / Português, offline no seu celular." },
    ],
  }),
  component: Biblioteca,
});

const ABAS: { id: TipoPub; nome: string }[] = [
  { id: "sentinela", nome: "A Sentinela" },
  { id: "apostila", nome: "Apostila Vida e Ministério" },
];

function Biblioteca() {
  const [pubs, setPubs] = useState<Publicacao[]>([]);
  const [aba, setAba] = useState<TipoPub>("sentinela");
  const [aberto, setAberto] = useState(false);
  const recarregar = () => listarPublicacoes().then(setPubs);
  useEffect(() => { recarregar(); }, []);
  const lista = pubs.filter((p) => p.tipo === aba);

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 pb-28 pt-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Libras · Português</p>
          <h1 className="text-3xl font-bold">Meus estudos</h1>
        </div>
        <ThemeToggle />
      </header>

      <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-secondary p-1">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`rounded-xl px-3 py-2.5 text-sm font-bold transition ${aba === a.id ? "bg-card text-foreground shadow" : "text-muted-foreground"}`}
          >
            {a.nome}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          <BookOpen className="mx-auto mb-3 h-10 w-10 text-primary" />
          <p>Nenhuma matéria importada ainda.</p>
          <p className="text-sm">Toque em “Importar” e cole um link do jw.org.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {lista.map((p) => (
            <li key={p.id} className="flex items-stretch gap-2 rounded-2xl border bg-card">
              <Link to="/estudo/$id" params={{ id: p.id }} className="min-w-0 flex-1 p-4">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-primary">
                  <CalendarDays className="h-3.5 w-3.5" /> {p.semana}
                </p>
                <p className="font-display text-lg font-semibold leading-snug">{p.titulo}</p>
              </Link>
              <button
                aria-label="Excluir"
                onClick={async () => {
                  if (confirm(`Excluir “${p.titulo}”?`)) { await excluirPublicacao(p.id); recarregar(); }
                }}
                className="px-4 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => setAberto(true)}
        className="fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-6 py-4 font-bold text-primary-foreground shadow-xl"
      >
        <Plus className="h-5 w-5" /> Importar matéria
      </button>

      {aberto && (
        <ImportModal
          onClose={() => setAberto(false)}
          onDone={(tipo) => { setAberto(false); setAba(tipo); recarregar(); }}
        />
      )}
    </div>
  );
}

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: (t: TipoPub) => void }) {
  const [url, setUrl] = useState("");
  const [carregando, setCarregando] = useState("");
  const [erro, setErro] = useState("");
  const [avisos, setAvisos] = useState<string[]>([]);
  const [artigos, setArtigos] = useState<ArtigoRevista[] | null>(null);
  const [feitos, setFeitos] = useState<Set<string>>(new Set());
  const [ultimoTipo, setUltimoTipo] = useState<TipoPub | null>(null);

  async function importarUm(u: string) {
    const r = await importarUrl(u);
    await salvarPublicacao(r.publicacao, r.paragrafos);
    setUltimoTipo(r.publicacao.tipo);
    return r;
  }

  async function buscar() {
    setErro(""); setAvisos([]);
    try { new URL(url.trim()); } catch { setErro("Cole um link válido do jw.org."); return; }
    setCarregando("Abrindo...");
    try {
      const lista = await listarArtigos(url.trim());
      if (lista.length) { setArtigos(lista); return; }
      const r = await importarUm(url.trim());
      if (r.avisos.length) { setAvisos(r.avisos); setTimeout(() => onDone(r.publicacao.tipo), 3500); }
      else onDone(r.publicacao.tipo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando("");
    }
  }

  async function importarVarios(lista: ArtigoRevista[]) {
    setErro("");
    for (const a of lista) {
      if (feitos.has(a.url)) continue;
      setCarregando(a.url);
      try {
        await importarUm(a.url);
        setFeitos((s) => new Set(s).add(a.url));
      } catch (e) {
        setErro(`${a.titulo}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setCarregando("");
  }

  const fechar = () => (ultimoTipo ? onDone(ultimoTipo) : onClose());

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center" onClick={fechar}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border bg-card p-6 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{artigos ? "Artigos da revista" : "Importar do jw.org"}</h2>
          <button onClick={fechar} aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>
        {artigos ? (
          <>
            <ul className="space-y-2">
              {artigos.map((a) => (
                <li key={a.url} className="flex items-center gap-2 rounded-xl border bg-background p-3">
                  <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">{a.titulo}</p>
                  {feitos.has(a.url) ? (
                    <Check className="h-5 w-5 text-primary" />
                  ) : carregando === a.url ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <button disabled={!!carregando} onClick={() => importarVarios([a])} className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-bold disabled:opacity-50">
                      Importar
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}
            <button
              disabled={!!carregando || feitos.size === artigos.length}
              onClick={() => importarVarios(artigos)}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-bold text-primary-foreground disabled:opacity-50"
            >
              {carregando && <Loader2 className="h-5 w-5 animate-spin" />}
              {carregando ? "Importando..." : "Importar todos"}
            </button>
          </>
        ) : (
          <>
            <label className="mb-2 block text-sm text-muted-foreground">Link da revista ou da matéria</label>
            <div className="flex items-center gap-2 rounded-xl border bg-background px-3">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.jw.org/bzs/..."
                className="w-full bg-transparent py-3 outline-none"
                inputMode="url"
              />
            </div>
            {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}
            {avisos.map((a) => <p key={a} className="mt-3 rounded-lg bg-accent p-2 text-sm text-accent-foreground">{a}</p>)}
            <button
              disabled={!!carregando || !url}
              onClick={buscar}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-bold text-primary-foreground disabled:opacity-50"
            >
              {carregando && <Loader2 className="h-5 w-5 animate-spin" />}
              {carregando ? "Abrindo..." : "Continuar"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
