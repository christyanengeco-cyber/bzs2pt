import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock, MessageCircle, Pause, Play, Eraser, Video, EyeOff, Eye, Trash2, X, Pencil, Maximize, Minimize, RotateCcw, RotateCw, Loader2, BookOpen, ExternalLink } from "lucide-react";
import { LIXO, buscarReferencia, linkEstudoLivro, resolverEstudoLivro, importarUrl, type ConteudoReferencia } from "@/lib/parser";
import { salvarPublicacao, listarPublicacoes } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  CORES, atualizarParagrafo, atualizarPublicacao, excluirAnotacao, getPublicacao, listarAnotacoes,
  listarParagrafos, salvarAnotacao, uid, type Anotacao, type Paragrafo, type Publicacao,
} from "@/lib/db";

export const Route = createFileRoute("/estudo/$id")({
  head: () => ({
    meta: [
      { title: "Leitor bilíngue — Estudo em Libras" },
      { name: "description", content: "Leia o texto em português com o vídeo em Libras sincronizado por parágrafo." },
      { property: "og:title", content: "Leitor bilíngue — Estudo em Libras" },
      { property: "og:description", content: "Toque em um parágrafo e o vídeo em Libras pula para o trecho certo." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Leitor,
});

const VELOCIDADES = Array.from({ length: 16 }, (_, i) => Math.round((0.5 + i * 0.1) * 10) / 10);
const limitarVel = (v: number) => Math.min(2, Math.max(0.5, Math.round(v * 10) / 10));
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function Leitor() {
  const { id } = Route.useParams();
  const [pub, setPub] = useState<Publicacao | null>(null);
  const navigateLivro = useNavigate();
  const [paras, setParas] = useState<Paragrafo[]>([]);
  const [notas, setNotas] = useState<Anotacao[]>([]);
  const video = useRef<HTMLVideoElement>(null);
  const [tocando, setTocando] = useState(false);
  const [tempo, setTempo] = useState(0);
  const [dur, setDur] = useState(0);
  const [vel, setVel] = useState(1);
  const [ativo, setAtivo] = useState<string | null>(null);
  const [sel, setSel] = useState<{ pid: string; inicio: number; fim: number; trecho: string; x: number; y: number } | null>(null);
  const [editMarca, setEditMarca] = useState<Anotacao | null>(null);
  const [modoTempo, setModoTempo] = useState(false);
  const [painelOcultos, setPainelOcultos] = useState(false);
  const [erroVideo, setErroVideo] = useState(false);
  const trava = useRef<number | null>(null);
  const ultimaSelecao = useRef(0);
  const [ref, setRef] = useState<{ href: string; texto: string } | null>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [telaCheia, setTelaCheia] = useState(false);
  const [controles, setControles] = useState(true);
  const ctrlTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const cutucar = () => {
    setControles(true); clearTimeout(ctrlTimer.current);
    ctrlTimer.current = setTimeout(() => { if (video.current && !video.current.paused) setControles(false); }, 2500);
  };
  useEffect(() => { if (!tocando) { setControles(true); clearTimeout(ctrlTimer.current); } else cutucar(); }, [tocando]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const f = () => setTelaCheia(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);
  const alternarTelaCheia = async () => {
    const el = playerRef.current; const v = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (el?.requestFullscreen) await el.requestFullscreen();
      else v?.webkitEnterFullscreen?.();
    } catch { v?.webkitEnterFullscreen?.(); }
  };
  const pular = (d: number) => { const v = video.current; if (!v) return; v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + d)); mostrarHud(d > 0 ? `+${d}s` : `${d}s`); cutucar(); };
  // seleção no celular: acompanha a seleção nativa
  useEffect(() => {
    const f = () => {
      const s = window.getSelection();
      if (!s || s.isCollapsed) return;
      const n = s.anchorNode; const el = (n instanceof Element ? n : n?.parentElement)?.closest<HTMLElement>("[data-par]");
      if (el?.dataset["par"]) { ultimaSelecao.current = Date.now(); onSelect(el.dataset["par"], el); }
    };
    document.addEventListener("selectionchange", f);
    return () => document.removeEventListener("selectionchange", f);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  const estaOculto = (p: Paragrafo) => p.oculto ?? LIXO.test(p.texto_portugues);
  const visiveis = paras.filter((p) => !estaOculto(p));
  const ocultos = paras.filter(estaOculto);
  const secoes = (() => {
    let c: string | undefined;
    return visiveis.map((p) => {
      const t = p.texto_portugues.toUpperCase();
      if (/TESOUROS DA PALAVRA/.test(t)) c = "var(--sec-tesouros)";
      else if (/FA[ÇC]A SEU MELHOR/.test(t)) c = "var(--sec-ministerio)";
      else if (/NOSSA VIDA CRIST/.test(t)) c = "var(--sec-vida)";
      return c;
    });
  })();
  async function definirOculto(p: Paragrafo, oculto: boolean) {
    const np = { ...p, oculto };
    await atualizarParagrafo(np);
    setParas((ps) => ps.map((x) => (x.id === p.id ? np : x)));
  }

  useEffect(() => {
    getPublicacao(id).then((p) => setPub(p ?? null));
    listarParagrafos(id).then(setParas);
    listarAnotacoes(id).then(setNotas);
  }, [id]);

  const seekTo = (s: number) => {
    const v = video.current; if (!v) return;
    v.currentTime = s; v.play().catch(() => {});
  };

  // gestos estilo JW Library
  const [hud, setHud] = useState<string | null>(null);
  const hudTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const gesto = useRef<{ dedos: number; y: number; velIni: number; moveu: boolean } | null>(null);
  const mostrarHud = (t: string) => {
    setHud(t); clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => setHud(null), 700);
  };
  const aplicarVel = (n: number) => {
    const v = limitarVel(n); setVel(v);
    if (video.current) video.current.playbackRate = v;
    return v;
  };
  const alternar = () => {
    const v = video.current; if (!v) return;
    if (v.paused) { v.play().catch(() => {}); mostrarHud("▶"); } else { v.pause(); mostrarHud("❚❚"); }
    cutucar();
  };
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches;
    if (t.length >= 2) gesto.current = { dedos: 2, y: 0, velIni: vel, moveu: false };
    else if (!gesto.current) {
      const toque = t[0];
      if (toque) gesto.current = { dedos: 1, y: toque.clientY, velIni: vel, moveu: false };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const g = gesto.current; if (!g || g.dedos !== 1) return;
    const toque = e.touches[0];
    if (!toque) return;
    const dy = g.y - toque.clientY;
    if (Math.abs(dy) > 15) g.moveu = true;
    if (g.moveu) mostrarHud(`${aplicarVel(g.velIni + Math.trunc(dy / 25) * 0.1).toFixed(1)}x`);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const g = gesto.current; if (!g) return;
    if (e.touches.length > 0) return;
    gesto.current = null;
    if (g.dedos === 2) { e.preventDefault(); alternar(); }
    else if (g.moveu) e.preventDefault();
    else { e.preventDefault(); if (controles && tocando) setControles(false); else cutucar(); }
  };

  // paragrafo atual conforme o vídeo
  useEffect(() => {
    if (!tocando) return;
    let cur: Paragrafo | undefined;
    for (const p of visiveis)
      if (p.timestamp_inicio > 0 && p.timestamp_inicio <= tempo + 0.2 && (!cur || p.timestamp_inicio >= cur.timestamp_inicio)) cur = p;
    if (!cur) return;
    if (trava.current != null) {
      if (Math.abs(cur.timestamp_inicio - trava.current) < 0.05) return;
      trava.current = null;
    }
    if (cur.id !== ativo) setAtivo(cur.id);
  }, [tempo]); // eslint-disable-line react-hooks/exhaustive-deps

  function onSelect(pid: string, el: HTMLElement) {
    const s = window.getSelection();
    if (!s || s.isCollapsed || !el.contains(s.anchorNode)) return;
    if (!s.rangeCount) return;
    const r = s.getRangeAt(0);
    const pre = document.createRange();
    pre.selectNodeContents(el); pre.setEnd(r.startContainer, r.startOffset);
    const inicio = pre.toString().length;
    const trecho = r.toString();
    if (!trecho.trim()) return;
    const rect = r.getBoundingClientRect();
    const x = Math.min(window.innerWidth - 120, Math.max(120, rect.left + rect.width / 2));
    const y = Math.min(window.innerHeight - 64, rect.bottom + 12);
    setSel({ pid, inicio, fim: inicio + trecho.length, trecho, x, y });
  }

  async function marcar(cor: string) {
    if (!sel) return;
    const a: Anotacao = { id: uid(), paragrafo_id: sel.pid, publicacao_id: id, tipo: "destaque", cor_destaque: cor, inicio: sel.inicio, fim: sel.fim, trecho: sel.trecho };
    await salvarAnotacao(a);
    setNotas((n) => [...n, a]); setSel(null); window.getSelection()?.removeAllRanges();
  }

  async function sincronizar(p: Paragrafo) {
    const novo = video.current?.currentTime ?? 0;
    if (!confirm(`Mudar o início deste trecho de ${fmt(p.timestamp_inicio)} para ${fmt(novo)}?`)) return;
    const np = { ...p, timestamp_inicio: Math.round((video.current?.currentTime ?? 0) * 10) / 10 };
    await atualizarParagrafo(np);
    setParas((ps) => ps.map((x) => (x.id === p.id ? np : x)));
  }

  if (!pub) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;
  const navLivro = navigateLivro;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      {/* PLAYER 35% */}
      <div ref={playerRef} onMouseMove={cutucar} className={`relative flex shrink-0 flex-col bg-player ${telaCheia ? "h-[100dvh]" : "h-[35dvh]"}`}>
        <Link to="/" aria-label="Voltar" className={`absolute left-3 top-3 z-10 transition-opacity duration-300 ${controles ? "opacity-100" : "pointer-events-none opacity-0"} grid h-9 w-9 place-items-center rounded-full bg-background/70 backdrop-blur`}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className={`absolute right-3 top-3 z-10 flex gap-2 transition-opacity duration-300 ${controles ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <span className="rounded-md bg-card"><ThemeToggle /></span>
          {ocultos.length > 0 && (
            <button aria-label="Itens ocultos" onClick={() => setPainelOcultos(true)} className="flex h-9 items-center gap-1 rounded-full bg-background/70 px-3 text-xs font-bold backdrop-blur">
              <EyeOff className="h-4 w-4" /> {ocultos.length}
            </button>
          )}
          {pub.video_url && (
            <button aria-label="Modo de edição" aria-pressed={modoTempo} onClick={() => setModoTempo((m) => !m)} className={`grid h-9 w-9 place-items-center rounded-full backdrop-blur ${modoTempo ? "bg-primary text-primary-foreground" : "bg-background/70"}`}>
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
        {pub.video_url ? (
          <video
            ref={video}
            src={pub.video_url}
            playsInline
            preload="metadata"
            className="min-h-0 w-full flex-1 touch-none object-contain"
            onPlay={() => setTocando(true)}
            onPause={() => setTocando(false)}
            onTimeUpdate={(e) => setTempo(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => { setDur(e.currentTarget.duration); e.currentTarget.playbackRate = vel; }}
            onError={() => setErroVideo(true)}
            onClick={() => (controles && tocando ? setControles(false) : cutucar())}
            onDoubleClick={alternar}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          />
        ) : (
          <SemVideo onSave={async (u) => { const np = { ...pub, video_url: u }; await atualizarPublicacao(np); setPub(np); }} />
        )}
        {erroVideo && (
          <div role="alert" className="absolute inset-x-4 top-1/2 z-10 -translate-y-1/2 border bg-popover p-4 text-center text-sm">
            <p className="font-semibold">O vídeo não pôde ser carregado.</p>
            <p className="mt-1 text-muted-foreground">Confira sua conexão ou tente abrir o estudo novamente.</p>
          </div>
        )}
        {hud && (
          <div aria-live="polite" className="pointer-events-none absolute left-3 top-14 z-10 rounded-md bg-background/70 px-2 py-0.5 text-xs font-bold tabular-nums backdrop-blur">
            {hud}
          </div>
        )}
        {pub.video_url && (
          <div className={`absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 bg-background/70 px-2 py-1.5 backdrop-blur transition-opacity duration-300 ${controles ? "opacity-100" : "pointer-events-none opacity-0"}`}>
            <button aria-label="Voltar 5 segundos" onClick={() => pular(-5)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full"><RotateCcw className="h-4 w-4" /></button>
            <button aria-label={tocando ? "Pausar" : "Tocar"} onClick={() => { if (tocando) video.current?.pause(); else video.current?.play().catch(() => {}); }} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              {tocando ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button aria-label="Avançar 5 segundos" onClick={() => pular(5)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full"><RotateCw className="h-4 w-4" /></button>
            <span className="w-9 text-xs tabular-nums text-muted-foreground">{fmt(tempo)}</span>
            <input type="range" min={0} max={dur || 0} step={0.1} value={tempo} onChange={(e) => { if (video.current) video.current.currentTime = +e.target.value; cutucar(); }} className="min-w-0 flex-1 accent-primary" aria-label="Progresso" />
            <button
              aria-label="Velocidade"
              onClick={() => { const i = VELOCIDADES.indexOf(vel); aplicarVel(VELOCIDADES[(i + 1) % VELOCIDADES.length] ?? 1); cutucar(); }}
              className="shrink-0 px-1 text-xs font-semibold tabular-nums text-muted-foreground"
            >
              {vel.toFixed(1)}x
            </button>
            <button aria-label={telaCheia ? "Sair da tela cheia" : "Tela cheia"} onClick={alternarTelaCheia} className="grid h-8 w-8 shrink-0 place-items-center rounded-full">
              {telaCheia ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          </div>
        )}
      </div>

      {/* TEXTO 65% */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 pb-24 pt-5">
          <p className="text-xs font-bold uppercase text-section">{pub.semana}</p>
          <h1 className="mb-5 text-2xl font-bold leading-tight">{pub.titulo}</h1>
          {modoTempo && (
            <p className="mb-4 rounded-xl bg-accent p-3 text-sm text-accent-foreground">
              Modo de edição ligado: o relógio em cada trecho grava o tempo atual do vídeo e o olho oculta o trecho. Toque no lápis do topo para sair.
            </p>
          )}
          {visiveis.map((p, i) => (
            <ParagrafoView
              cor={pub.tipo === "apostila" ? secoes[i] : undefined}
              anterior={pub.tipo === "apostila" ? (visiveis[i - 1]?.texto_portugues ?? "") : ""}
              key={p.id}
              p={p}
              ativo={ativo === p.id}
              acompanhando={tocando}
              notas={notas.filter((n) => n.paragrafo_id === p.id)}
              temVideo={!!pub.video_url}
              modoTempo={modoTempo}
              onRef={(href, texto) => {
                if (!href.startsWith("livro:")) return setRef({ href, texto });
                const [, code, n] = href.split(":");
                (async () => {
                  const u = (await resolverEstudoLivro(code!, Number(n))).split("#")[0]!;
                  const ex = (await listarPublicacoes()).find((x) => x.url_origem === u);
                  if (ex) return navLivro({ to: "/estudo/$id", params: { id: ex.id } });
                  const r = await importarUrl(u);
                  r.publicacao.tipo = "referencia"; r.publicacao.pai_id = id;
                  r.publicacao.semana = pub.semana; r.publicacao.semana_inicio = pub.semana_inicio; r.publicacao.semana_fim = pub.semana_fim;
                  await salvarPublicacao(r.publicacao, r.paragrafos);
                  navLivro({ to: "/estudo/$id", params: { id: r.publicacao.id } });
                })().catch((e) => alert(e instanceof Error ? e.message : "Falha ao buscar a lição"));
              }}
              onTap={() => { if (sel || Date.now() - ultimaSelecao.current < 600 || window.getSelection()?.toString()) return; setAtivo(p.id); if (pub.video_url) { trava.current = p.timestamp_inicio; seekTo(p.timestamp_inicio); } }}
              onOcultar={() => definirOculto(p, true)}
              onMarca={(m) => { setSel(null); setEditMarca(m); }}
              onSelect={(el) => onSelect(p.id, el)}
              onSync={() => sincronizar(p)}
              onNotas={setNotas}
            />
          ))}
        </div>
      </div>

      {editMarca && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-popover p-2 shadow-2xl">
          {CORES.map((c) => (
            <button
              key={c}
              aria-label={`Trocar para ${c}`}
              onClick={async () => { const na = { ...editMarca, cor_destaque: c }; await salvarAnotacao(na); setNotas((ns) => ns.map((n) => (n.id === na.id ? na : n))); setEditMarca(null); }}
              className={`h-9 w-9 rounded-full border-2 ${editMarca.cor_destaque === c ? "border-foreground" : "border-background"}`}
              style={{ background: c }}
            />
          ))}
          <button aria-label="Apagar marcação" onClick={async () => { await excluirAnotacao(editMarca.id); setNotas((ns) => ns.filter((n) => n.id !== editMarca.id)); setEditMarca(null); }} className="grid h-9 w-9 place-items-center rounded-full bg-destructive text-destructive-foreground">
            <Trash2 className="h-4 w-4" />
          </button>
          <button aria-label="Fechar" onClick={() => setEditMarca(null)} className="grid h-9 w-9 place-items-center text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>
      )}

      {painelOcultos && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center" onClick={() => setPainelOcultos(false)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border bg-card p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Itens ocultos</h2>
              <button onClick={() => setPainelOcultos(false)} aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>
            {ocultos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item oculto.</p>}
            <ul className="space-y-2">
              {ocultos.map((p) => (
                <li key={p.id} className="flex items-start gap-2 rounded-xl border bg-background p-3">
                  <p className="line-clamp-3 min-w-0 flex-1 text-sm">{p.texto_portugues}</p>
                  <button onClick={() => definirOculto(p, false)} className="flex shrink-0 items-center gap-1 rounded-lg bg-secondary px-2 py-1.5 text-xs font-bold">
                    <Eye className="h-3.5 w-3.5" /> Mostrar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {ref && <PainelReferencia href={ref.href} texto={ref.texto} pubId={id} onClose={() => setRef(null)} />}

      {sel && (
        <div style={{ left: sel.x, top: sel.y }} className="fixed z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-popover p-2 shadow-2xl">
          {CORES.map((c) => (
            <button key={c} aria-label={`Marcar ${c}`} onPointerDown={(e) => { e.preventDefault(); marcar(c); }} className="h-9 w-9 rounded-full border-2 border-background" style={{ background: c }} />
          ))}
          <button onPointerDown={(e) => { e.preventDefault(); setSel(null); window.getSelection()?.removeAllRanges(); }} className="px-2 text-sm text-muted-foreground">Cancelar</button>
        </div>
      )}
    </div>
  );
}

function renderMarcado(texto: string, marcas: Anotacao[], onMarca: (m: Anotacao) => void, links: Paragrafo["links"] = [], onRef?: (href: string, t: string) => void) {
  const ms = marcas.filter((m) => m.tipo === "destaque" && m.inicio != null);
  const cortes = new Set([0, texto.length]);
  for (const m of ms) { cortes.add(Math.max(0, m.inicio ?? 0)); cortes.add(Math.min(texto.length, m.fim ?? texto.length)); }
  for (const l of links ?? []) { cortes.add(l.inicio); cortes.add(l.fim); }
  const pts = [...cortes].filter((x) => x >= 0 && x <= texto.length).sort((x, y) => x - y);
  const out: React.ReactNode[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const ini = pts[i]!, fim = pts[i + 1]!;
    if (fim <= ini) continue;
    let node: React.ReactNode = texto.slice(ini, fim);
    const l = (links ?? []).find((x) => x.inicio <= ini && x.fim >= fim);
    if (l && onRef) node = <span className="text-reference underline decoration-reference/40 underline-offset-2" onClick={(e) => { if (window.getSelection()?.toString()) return; e.stopPropagation(); onRef(l.href, texto.slice(l.inicio, l.fim)); }}>{node}</span>;
    const m = [...ms].reverse().find((x) => (x.inicio ?? 0) <= ini && (x.fim ?? texto.length) >= fim);
    if (m) node = <mark style={{ background: m.cor_destaque }} className="cursor-pointer rounded-sm font-medium text-black" onClick={(e) => { if (window.getSelection()?.toString()) return; e.stopPropagation(); onMarca(m); }}>{node}</mark>;
    out.push(<span key={ini}>{node}</span>);
  }
  return out;
}

function PainelReferencia({ href, texto, pubId, onClose }: { href: string; texto: string; pubId: string; onClose: () => void }) {
  const [dados, setDados] = useState<ConteudoReferencia | null>(null);
  const [erro, setErro] = useState("");
  const [importando, setImportando] = useState(false);
  const [existente, setExistente] = useState<string | null>(null);
  const navigate = useNavigate();
  const origem = href.split("#")[0] ?? href;
  useEffect(() => {
    let vivo = true;
    buscarReferencia(href).then((d) => vivo && setDados(d)).catch((e) => vivo && setErro(e instanceof Error ? e.message : String(e)));
    listarPublicacoes().then(async (ps) => {
      const p = ps.find((x) => x.url_origem === origem);
      if (!vivo) return;
      if (p) { setExistente(p.id); const pr = await listarParagrafos(p.id); if (vivo && p.video_url) setMini({ pub: p, paras: pr }); return; }
      if (/\/biblia\//i.test(href)) return;
      try {
        const r = await importarUrl(origem);
        r.publicacao.tipo = "referencia"; r.publicacao.pai_id = pubId;
        await salvarPublicacao(r.publicacao, r.paragrafos);
        if (vivo) { setExistente(r.publicacao.id); if (r.publicacao.video_url) setMini({ pub: r.publicacao, paras: r.paragrafos }); }
      } catch { /* só texto */ }
    });
    history.pushState({ popup: 1 }, "");
    const voltar = () => onClose();
    addEventListener("popstate", voltar);
    return () => { vivo = false; removeEventListener("popstate", voltar); };
  }, [href, origem]); // eslint-disable-line react-hooks/exhaustive-deps
  const [mini, setMini] = useState<{ pub: Publicacao; paras: Paragrafo[] } | null>(null);
  const vRef = useRef<HTMLVideoElement>(null);
  const [tMini, setTMini] = useState(0);
  const fechar = () => history.back();
  async function importar() {
    setImportando(true);
    try {
      const r = await importarUrl(origem);
      r.publicacao.tipo = "referencia";
      r.publicacao.pai_id = pubId;
      await salvarPublicacao(r.publicacao, r.paragrafos);
      onClose();
      navigate({ to: "/estudo/$id", params: { id: r.publicacao.id } });
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); setImportando(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 sm:p-8" onClick={fechar}>
      <div role="dialog" aria-modal="true" aria-label={texto} className="flex max-h-[85dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <p className="min-w-0 flex-1 truncate font-bold text-reference">{texto}</p>
          <button onClick={fechar} aria-label="Fechar" className="grid h-8 w-8 place-items-center"><X className="h-5 w-5" /></button>
        </div>
        {mini && <video ref={vRef} src={mini.pub.video_url} controls playsInline className="aspect-video w-full bg-background" onTimeUpdate={(e) => setTMini(e.currentTarget.currentTime)} />}
        {dados && !dados.biblia && !mini && !existente && !erro && <p className="flex items-center gap-2 border-b px-4 py-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Buscando vídeo em Libras…</p>}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-[1.05rem] leading-relaxed">
          {!dados && !erro && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Buscando…</p>}
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          {mini ? <>
            <p className="mb-2 font-bold">{mini.pub.titulo}</p>
            {mini.paras.filter((p) => !p.oculto).map((p, i, arr) => {
              const ativoP = tMini >= p.timestamp_inicio && tMini < (arr[i + 1]?.timestamp_inicio ?? Infinity);
              const alvo = !dados?.biblia && dados?.trechos.length === 1 && dados.trechos[0] === p.texto_portugues;
              return <p key={p.id} ref={alvo ? (el) => { if (el && vRef.current && vRef.current.currentTime === 0) { el.scrollIntoView({ block: "center" }); vRef.current.currentTime = p.timestamp_inicio; } } : undefined}
                onClick={() => { if (vRef.current) { vRef.current.currentTime = p.timestamp_inicio; vRef.current.play(); } }}
                className={`mb-2 cursor-pointer rounded px-1 ${p.pergunta ? "text-sm text-section" : ""} ${ativoP ? "bg-accent/40" : ""} ${alvo ? "ring-1 ring-reference" : ""}`}>{p.texto_portugues}</p>;
            })}
          </> : dados && <>
            {!dados.biblia && dados.titulo && <p className="mb-2 font-bold">{dados.titulo}</p>}
            {dados.trechos.map((t, i) => <p key={i} className="mb-2">{t}</p>)}
          </>}
        </div>
        {dados && (
          <div className="flex gap-2 border-t p-3">
            {existente ? (
              <Button className="flex-1" onClick={() => navigate({ to: "/estudo/$id", params: { id: existente } })}>
                <BookOpen /> Abrir estudo
              </Button>
            ) : !dados.biblia && (
              <Button className="flex-1" disabled={importando} onClick={importar}>
                {importando ? <Loader2 className="animate-spin" /> : <BookOpen />} Importar como estudo
              </Button>
            )}
            <a href={href} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-2 rounded-md border bg-secondary px-4 py-2 text-sm font-bold">
              <ExternalLink className="h-4 w-4" /> Abrir no jw.org
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function ParagrafoView({ cor, anterior = "", p, ativo, acompanhando, notas, temVideo, modoTempo, onRef, onTap, onOcultar, onMarca, onSelect, onSync, onNotas }: {
  cor?: string | undefined; anterior?: string; p: Paragrafo; ativo: boolean; acompanhando: boolean; notas: Anotacao[]; temVideo: boolean; modoTempo: boolean;
  onRef: (href: string, t: string) => void; onTap: () => void; onOcultar: () => void; onMarca: (m: Anotacao) => void; onSelect: (el: HTMLElement) => void; onSync: () => void;
  onNotas: React.Dispatch<React.SetStateAction<Anotacao[]>>;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const nota = notas.find((n) => n.tipo === "nota");
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState(nota?.texto_comentario ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setTexto(nota?.texto_comentario ?? "");
  }, [nota?.texto_comentario]);

  useEffect(() => {
    if (!ativo || !acompanhando || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.42 || rect.bottom > window.innerHeight * 0.9) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [ativo, acompanhando]);

  function escrever(v: string) {
    setTexto(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const a: Anotacao = nota ?? { id: uid(), paragrafo_id: p.id, publicacao_id: p.publicacao_id, tipo: "nota" };
      const na = { ...a, texto_comentario: v };
      await salvarAnotacao(na);
      onNotas((ns) => [...ns.filter((n) => n.id !== na.id), na]);
    }, 400);
  }

  const temDestaque = notas.some((n) => n.tipo === "destaque");
  const livro = linkEstudoLivro(p.texto_portugues, anterior);
  const links = livro ? [...(p.links ?? []).filter((l) => !(l.inicio < livro.fim && l.fim > livro.inicio)), livro].sort((a, b) => a.inicio - b.inicio) : p.links;
  const titulo = cor && (p.pergunta || /^\d+\.\s/.test(p.texto_portugues) || (p.texto_portugues.length < 60 && p.texto_portugues === p.texto_portugues.toUpperCase()));
  if (p.imagem) return <img src={p.imagem} alt="" loading="lazy" className="mb-3 w-full rounded-lg" />;

  return (
    <div aria-current={ativo ? "true" : undefined} className={`mb-2 border-l-2 px-3 py-2 transition ${ativo ? "border-primary bg-selection" : "border-transparent"}`}>
      <p
        ref={ref}
        onClick={() => { if (!window.getSelection()?.toString()) onTap(); }}
        data-par={p.id}
        onMouseUp={() => ref.current && onSelect(ref.current)}
         style={titulo ? { color: cor } : undefined}
         className={`cursor-pointer select-text leading-relaxed ${titulo ? "font-bold" : p.pergunta ? "text-base font-bold text-section" : "text-[1.1rem]"}`}
      >
        {renderMarcado(p.texto_portugues, notas, onMarca, links, onRef)}
      </p>
      <div className="mt-1 flex items-center gap-1 text-muted-foreground">
        {temVideo && (
          <span className="mr-auto flex items-center gap-1 text-xs tabular-nums">
            <Video className="h-3 w-3" /> {fmt(p.timestamp_inicio)}
          </span>
        )}
        {!temVideo && <span className="mr-auto" />}
        {temVideo && modoTempo && (
          <button onClick={onSync} title="Usar o tempo atual do vídeo" aria-label="Sincronizar com o tempo atual" className="rounded-lg bg-primary p-1.5 text-primary-foreground">
            <Clock className="h-4 w-4" />
          </button>
        )}
        {temDestaque && (
          <button
            aria-label="Limpar marcações"
            onClick={async () => {
              const ds = notas.filter((n) => n.tipo === "destaque");
              await Promise.all(ds.map((d) => excluirAnotacao(d.id)));
              onNotas((ns) => ns.filter((n) => !ds.includes(n)));
            }}
            className="rounded-lg p-1.5 hover:bg-secondary"
          >
            <Eraser className="h-4 w-4" />
          </button>
        )}
        {modoTempo && <Button variant="ghost" size="icon" aria-label="Ocultar trecho" title="Ocultar" onClick={() => { if (confirm("Ocultar este trecho? Você pode mostrar de novo em Itens ocultos.")) onOcultar(); }}>
          <EyeOff className="h-4 w-4" />
        </Button>}
        <button aria-label="Anotação" onClick={() => setAberto((a) => !a)} className={`rounded-lg p-1.5 hover:bg-secondary ${texto ? "text-primary" : ""}`}>
          <MessageCircle className="h-4 w-4" fill={texto ? "currentColor" : "none"} />
        </button>
      </div>
      {aberto && (
        <textarea
          autoFocus
          value={texto}
          onChange={(e) => escrever(e.target.value)}
          placeholder="Minha anotação… (salva automaticamente)"
          rows={3}
          className="mt-1 w-full rounded-md border bg-transparent p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      )}
    </div>
  );
}

function SemVideo({ onSave }: { onSave: (u: string) => void }) {
  const [u, setU] = useState("");
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <Video className="h-8 w-8 text-primary" />
      <p className="text-sm text-muted-foreground">Vídeo em Libras não encontrado. Cole o link MP4:</p>
      <div className="flex w-full max-w-md gap-2">
        <input value={u} onChange={(e) => setU(e.target.value)} placeholder="https://...mp4" className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm" />
        <button onClick={() => u && onSave(u.trim())} className="rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">Salvar</button>
      </div>
    </div>
  );
}
