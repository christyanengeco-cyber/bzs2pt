import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CalendarDays, Check, Clock3, DatabaseBackup, Link2, Loader2, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { excluirPublicacao, listarPublicacoes, salvarPublicacao, type Publicacao, type TipoPub } from "@/lib/db";
import { importarUrl, listarArtigos, type ArtigoRevista } from "@/lib/parser";
import { escolherSemanaInicial, hojeIso, intervaloDaPublicacao, ordenarSemanasCronologicamente } from "@/lib/study-dates";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BackupDialog } from "@/components/BackupDialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Biblioteca — Estudo em Libras" },
      { name: "description", content: "Importe matérias do jw.org em Libras e estude com vídeo sincronizado ao texto." },
      { property: "og:title", content: "Biblioteca — Estudo em Libras" },
      { property: "og:description", content: "Estudo pessoal bilíngue Libras / Português, offline no seu celular." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Biblioteca,
});

const ABAS: { id: TipoPub; nome: string }[] = [
  { id: "sentinela", nome: "A Sentinela" },
  { id: "apostila", nome: "Vida e Ministério" },
  { id: "extras", nome: "Extras" },
];

const chaveSemana = (p: Publicacao) => intervaloDaPublicacao(p)?.inicio ?? `texto:${p.semana}`;
const ordenarPorTitulo = (a: Publicacao, b: Publicacao) =>
  a.titulo.localeCompare(b.titulo, "pt-BR", { numeric: true, sensitivity: "base" }) ||
  b.criado_em - a.criado_em;

function Biblioteca() {
  const [pubs, setPubs] = useState<Publicacao[]>([]);
  const [aba, setAba] = useState<TipoPub>("sentinela");
  const [aberto, setAberto] = useState(false);
  const [backup, setBackup] = useState(false);
  const semanaAtiva = useRef<HTMLButtonElement>(null);
  const [selecionadas, setSelecionadas] = useState<Partial<Record<TipoPub, string>>>({});
  const recarregar = () => listarPublicacoes().then(setPubs);
  useEffect(() => { recarregar(); }, []);

  const daAba = useMemo(
    () => pubs.filter((p) => p.tipo === aba).sort(aba === "extras" ? ordenarPorTitulo : ordenarSemanasCronologicamente),
    [pubs, aba],
  );
  const semanas = useMemo(() => {
    if (aba === "extras") return []; // Extras não usa seletor de semanas
    const grupos = new Map<string, Publicacao[]>();
    for (const p of daAba) grupos.set(chaveSemana(p), [...(grupos.get(chaveSemana(p)) ?? []), p]);
    return Array.from(grupos, ([chave, estudos]) => {
      const primeiro = estudos[0];
      return { chave, estudos, intervalo: primeiro ? intervaloDaPublicacao(primeiro) : null };
    });
  }, [daAba, aba]);

  const escolhaPadrao = aba === "extras" ? null : escolherSemanaInicial(daAba);
  const publicacaoPadrao = escolhaPadrao ? daAba.find((p) => p.id === escolhaPadrao.id) : undefined;
  const chavePadrao = publicacaoPadrao ? chaveSemana(publicacaoPadrao) : undefined;
  const chaveSelecionada = semanas.some((s) => s.chave === selecionadas[aba]) ? selecionadas[aba] : chavePadrao;
  const semanaSelecionada = semanas.find((s) => s.chave === chaveSelecionada);
  const atual = semanaSelecionada?.intervalo
    ? semanaSelecionada.intervalo.inicio <= hojeIso() && semanaSelecionada.intervalo.fim >= hojeIso()
    : false;
  const listaAtual = aba === "extras" ? daAba : (semanaSelecionada?.estudos ?? []);
  useEffect(() => {
    semanaAtiva.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [aba, chaveSelecionada]);

  return (
    <main className="mx-auto min-h-screen max-w-2xl pb-8">
      <header className="flex items-center justify-between border-b bg-card px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div>
          <p className="text-xs font-semibold text-primary">Libras · Português</p>
          <h1 className="text-2xl font-bold">Meus estudos</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Backup e restauração" onClick={() => setBackup(true)}><DatabaseBackup /></Button>
          <ThemeToggle />
        </div>
      </header>

      <div className="grid grid-cols-3 border-b bg-card px-4 pt-2" role="tablist" aria-label="Publicação">
        {ABAS.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            role="tab"
            aria-selected={aba === item.id}
            onClick={() => setAba(item.id)}
            className={`h-11 rounded-none border-b-2 px-2 text-sm font-semibold shadow-none transition hover:bg-transparent ${aba === item.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
          >
            {item.nome}
          </Button>
        ))}
      </div>

      {semanas.length > 0 && (
        <section className="border-b py-3" aria-label="Semanas disponíveis">
          <div className="no-scrollbar flex snap-x gap-2 overflow-x-auto px-4">
            {semanas.map((grupo) => {
              const estaAtual = Boolean(grupo.intervalo && grupo.intervalo.inicio <= hojeIso() && grupo.intervalo.fim >= hojeIso());
              return (
                <Button
                  key={grupo.chave}
                  ref={grupo.chave === chaveSelecionada ? semanaAtiva : undefined}
                  variant="outline"
                  onClick={() => setSelecionadas((s) => ({ ...s, [aba]: grupo.chave }))}
                  aria-pressed={grupo.chave === chaveSelecionada}
                  className={`h-auto min-w-[9rem] snap-center justify-start rounded-md px-3 py-2 text-left shadow-none transition ${grupo.chave === chaveSelecionada ? "border-primary bg-selection" : "border-border bg-card"}`}
                >
                  <span className="min-w-0 whitespace-normal">
                    <span className="block text-xs font-semibold text-primary">{estaAtual ? "Semana atual" : "Semana"}</span>
                    <span className="line-clamp-2 text-sm font-medium">{grupo.estudos[0]?.semana}</span>
                  </span>
                </Button>
              );
            })}
          </div>
        </section>
      )}

      <section className="px-4 py-5">
        {daAba.length === 0 ? (
          <div className="border border-dashed px-6 py-12 text-center text-muted-foreground">
            <BookOpen className="mx-auto mb-3 h-9 w-9 text-primary" />
            <p className="font-medium text-foreground">Nenhum estudo importado</p>
            <p className="mt-1 text-sm">
              {aba === "extras"
                ? "Importe um livro ou uma brochura do jw.org e marque “Salvar na aba Extras”."
                : "Importe uma revista ou uma matéria do jw.org."}
            </p>
          </div>
        ) : (
          <>
            {!atual && semanaSelecionada && !selecionadas[aba] && !semanas.some((g) => g.intervalo && g.intervalo.inicio <= hojeIso() && g.intervalo.fim >= hojeIso()) && (
              <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> A semana atual ainda não foi importada. Mostrando a anterior mais recente.</p>
            )}
            <ul className="space-y-3">
              {listaAtual.map((p) => (
                <li key={p.id} className="flex items-stretch rounded-lg bg-card px-3">
                  <Link to="/estudo/$id" params={{ id: p.id }} className="flex min-w-0 flex-1 items-center gap-3 py-4 pr-2">
                    <span className="grid h-16 w-12 shrink-0 place-items-center rounded-md bg-secondary text-section" aria-hidden="true"><BookOpen className="h-6 w-6" /></span>
                    <span className="min-w-0">
                      {aba !== "extras" && <span className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> {p.semana}</span>}
                      <span className="block text-lg font-semibold leading-snug">{p.titulo}</span>
                    </span>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Excluir ${p.titulo}`}
                    className="my-auto text-muted-foreground hover:text-destructive"
                    onClick={async () => { if (confirm(`Excluir “${p.titulo}”?`)) { await excluirPublicacao(p.id); recarregar(); } }}
                  ><Trash2 /></Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="px-4"><Button onClick={() => setAberto(true)} size="lg" className="w-full"><Plus /> Importar estudo</Button></div>
      <BackupDialog aberto={backup} onOpenChange={setBackup} onRestored={recarregar} />
      {aberto && <ImportModal existentes={new Set(pubs.map((p) => p.url_origem))} onClose={() => setAberto(false)} onDone={(tipo) => { setAberto(false); setAba(tipo); recarregar(); }} />}
    </main>
  );
}

type StatusImport = "aguardando" | "importando" | "concluido" | "erro" | "existente";

function ImportModal({ existentes, onClose, onDone }: { existentes: Set<string>; onClose: () => void; onDone: (t: TipoPub) => void }) {
  const [url, setUrl] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [avisos, setAvisos] = useState<string[]>([]);
  const [artigos, setArtigos] = useState<ArtigoRevista[] | null>(null);
  const [status, setStatus] = useState<Record<string, StatusImport>>({});
  const [erros, setErros] = useState<Record<string, string>>({});
  const [ultimoTipo, setUltimoTipo] = useState<TipoPub | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [extras, setExtras] = useState(false);
  const [inicio, setInicio] = useState<number | null>(null);
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    if (!carregando) { setInicio(null); return; }
    const t0 = Date.now(); setInicio(t0); setAgora(t0);
    const iv = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(iv);
  }, [carregando]);
  const decorrido = inicio ? Math.floor((agora - inicio) / 1000) : 0;
  const cron = carregando ? <span className="text-xs font-normal tabular-nums opacity-80">{Math.floor(decorrido / 60)}:{String(decorrido % 60).padStart(2, "0")}</span> : null;
  const alternarMarcado = (u: string) => setMarcados((s) => { const n = new Set(s); n.has(u) ? n.delete(u) : n.add(u); return n; });

  async function importarUm(u: string) {
    if (existentes.has(u) || status[u] === "concluido") { setStatus((s) => ({ ...s, [u]: "existente" })); return null; }
    setStatus((s) => ({ ...s, [u]: "importando" }));
    try {
      const r = await importarUrl(u);
      if (extras) r.publicacao.tipo = "extras";
      await salvarPublicacao(r.publicacao, r.paragrafos);
      existentes.add(u);
      setUltimoTipo(r.publicacao.tipo);
      setStatus((s) => ({ ...s, [u]: "concluido" }));
      return r;
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : String(e);
      setStatus((s) => ({ ...s, [u]: "erro" }));
      setErros((s) => ({ ...s, [u]: mensagem }));
      return null;
    }
  }

  async function buscar() {
    setErro(""); setAvisos([]);
    let limpa: string;
    try { const parsed = new URL(url.trim()); if (!/(^|\.)jw\.org$/.test(parsed.hostname)) throw new Error(); limpa = parsed.href; }
    catch { setErro("Cole um link válido do jw.org."); return; }
    setCarregando(true);
    try {
      const lista = await listarArtigos(limpa);
      if (lista.length) {
        setArtigos(lista);
        setMarcados(new Set(lista.filter((a) => !existentes.has(a.url)).map((a) => a.url)));
        setStatus(Object.fromEntries(lista.map((a) => [a.url, existentes.has(a.url) ? "existente" : "aguardando"])));
        return;
      }
      if (existentes.has(limpa)) { setErro("Este estudo já foi importado."); return; }
      const r = await importarUm(limpa);
      if (r?.avisos.length) { setAvisos(r.avisos); return; }
      if (r) onDone(r.publicacao.tipo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally { setCarregando(false); }
  }

  const [lote, setLote] = useState({ total: 0, feitos: 0 });
  async function importarVarios(lista: ArtigoRevista[]) {
    setErro(""); setCarregando(true); setLote({ total: lista.length, feitos: 0 });
    for (const artigo of lista) { await importarUm(artigo.url); setLote((l) => ({ ...l, feitos: l.feitos + 1 })); }
    setCarregando(false);
  }

  const pendentes = artigos?.filter((a) => marcados.has(a.url) && !["concluido", "existente"].includes(status[a.url] ?? "")) ?? [];
  const falhos = artigos?.filter((a) => status[a.url] === "erro") ?? [];
  const fechar = () => ultimoTipo ? onDone(ultimoTipo) : onClose();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-overlay backdrop-blur-sm sm:items-center" onClick={fechar}>
      <div role="dialog" aria-modal="true" aria-labelledby="import-title" className="max-h-[92dvh] w-full max-w-lg overflow-y-auto border bg-card p-5 sm:rounded-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 id="import-title" className="text-xl font-bold">{artigos ? "Artigos da revista" : "Importar do jw.org"}</h2>
          <Button variant="ghost" size="icon" onClick={fechar} aria-label="Fechar"><X /></Button>
        </div>
        {artigos ? (
          <>
            <ul className="divide-y border-y">
              {artigos.map((a) => {
                const estado = status[a.url] ?? "aguardando";
                return (
                  <li key={a.url} className="py-3">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" aria-label={`Selecionar ${a.titulo}`} disabled={["existente", "concluido", "importando"].includes(estado) || carregando} checked={estado === "concluido" || marcados.has(a.url)} onChange={() => alternarMarcado(a.url)} className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug">{a.titulo}</p>
                        <p className={`mt-1 text-xs ${estado === "erro" ? "text-destructive" : "text-muted-foreground"}`}>
                          {estado === "existente" ? "Já importado" : estado === "concluido" ? "Concluído" : estado === "importando" ? "Importando…" : estado === "erro" ? erros[a.url] : "Aguardando"}
                        </p>
                      </div>
                      {estado === "importando" && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                      {(estado === "concluido" || estado === "existente") && <Check className="h-5 w-5 text-primary" />}
                    </div>
                  </li>
                );
              })}
            </ul>
            <label className="mt-4 flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={extras}
                onChange={(e) => setExtras(e.target.checked)}
                className="h-5 w-5 shrink-0 accent-primary"
              />
              Salvar na aba <span className="font-semibold">Extras</span>&nbsp;(livros e brochuras)
            </label>
            {carregando && lote.total > 0 && <AnelProgresso feitos={lote.feitos} total={lote.total} tempo={cron} />}
            <div className="mt-4 flex flex-col gap-2">
              {falhos.length > 0 && <Button variant="outline" disabled={carregando} onClick={() => importarVarios(falhos)}><RefreshCw /> Tentar falhas novamente</Button>}
              <Button disabled={carregando || pendentes.length === 0} onClick={() => importarVarios(pendentes)}>
                {carregando && <Loader2 className="animate-spin" />}{carregando ? "Importando" : `Importar selecionados (${pendentes.length})`} {cron}
              </Button>
              {!carregando && ultimoTipo && <p className="text-center text-xs text-muted-foreground">Importação concluída. Você pode fechar ou importar os itens restantes.</p>}
            </div>
          </>
        ) : (
          <>
            <label htmlFor="import-url" className="mb-2 block text-sm text-muted-foreground">Link da revista ou da matéria</label>
            <div className="flex items-center gap-2 rounded-md border bg-transparent px-3">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <input id="import-url" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.jw.org/bzs/..." className="w-full bg-transparent py-3 outline-none" inputMode="url" />
            </div>
            {erro && <p role="alert" className="mt-3 text-sm text-destructive">{erro}</p>}
            {avisos.map((aviso) => <p key={aviso} className="mt-3 border-l-2 border-primary bg-selection p-2 text-sm">{aviso}</p>)}
            <label htmlFor="salvar-extras" className="mt-3 flex items-center gap-3 text-sm">
              <input
                id="salvar-extras"
                type="checkbox"
                checked={extras}
                onChange={(e) => setExtras(e.target.checked)}
                className="h-5 w-5 shrink-0 accent-primary"
              />
              É livro ou brochura — salvar na aba <span className="font-semibold">Extras</span>
            </label>
            <Button disabled={carregando || !url} onClick={buscar} className="mt-5 w-full">
              {carregando && <Loader2 className="animate-spin" />}{carregando ? "Abrindo" : "Continuar"} {cron}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
function AnelProgresso({ feitos, total, tempo }: { feitos: number; total: number; tempo: React.ReactNode }) {
  const r = 34, c = 2 * Math.PI * r, f = total ? feitos / total : 0;
  return (
    <div className="mt-4 flex flex-col items-center gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={feitos} aria-label="Progresso da importação">
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" strokeWidth="6" className="stroke-secondary" />
          <circle cx="40" cy="40" r={r} fill="none" strokeWidth="6" strokeLinecap="round" className="stroke-primary transition-[stroke-dashoffset] duration-500" strokeDasharray={c} strokeDashoffset={c * (1 - f)} />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-sm font-bold tabular-nums">{feitos} de {total}</span>
      </div>
      <span className="text-xs text-muted-foreground">{tempo}</span>
    </div>
  );
}
