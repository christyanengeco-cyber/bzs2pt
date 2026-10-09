import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock, MessageCircle, Pause, Play, Eraser, Video, EyeOff, Eye, Trash2, X } from "lucide-react";
import { LIXO } from "@/lib/parser";
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
  const [paras, setParas] = useState<Paragrafo[]>([]);
  const [notas, setNotas] = useState<Anotacao[]>([]);
  const video = useRef<HTMLVideoElement>(null);
  const [tocando, setTocando] = useState(false);
  const [tempo, setTempo] = useState(0);
  const [dur, setDur] = useState(0);
  const [vel, setVel] = useState(1);
  const [ativo, setAtivo] = useState<string | null>(null);
  const [sel, setSel] = useState<{ pid: string; inicio: number; fim: number; trecho: string } | null>(null);
  const [editMarca, setEditMarca] = useState<Anotacao | null>(null);
  const [modoTempo, setModoTempo] = useState(false);
  const [painelOcultos, setPainelOcultos] = useState(false);
  const [erroVideo, setErroVideo] = useState(false);
  const trava = useRef<number | null>(null);
  const estaOculto = (p: Paragrafo) => p.oculto ?? LIXO.test(p.texto_portugues);
  const visiveis = paras.filter((p) => !estaOculto(p));
  const ocultos = paras.filter(estaOculto);
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
    hudTimer.current = setTimeout(() => setHud(null), 900);
  };
  const aplicarVel = (n: number) => {
    const v = limitarVel(n); setVel(v);
    if (video.current) video.current.playbackRate = v;
    return v;
  };
  const alternar = () => {
    const v = video.current; if (!v) return;
    if (v.paused) { v.play().catch(() => {}); mostrarHud("▶"); } else { v.pause(); mostrarHud("❚❚"); }
  };
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches;
    if (t.length >= 2) gesto.current = { dedos: 2, y: 0, velIni: vel, moveu: false };
    else if (!gesto.current) gesto.current = { dedos: 1, y: t[0]!.clientY, velIni: vel, moveu: false };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const g = gesto.current; if (!g || g.dedos !== 1) return;
    const dy = g.y - e.touches[0]!.clientY;
    if (Math.abs(dy) > 15) g.moveu = true;
    if (g.moveu) mostrarHud(`${aplicarVel(g.velIni + Math.trunc(dy / 25) * 0.1).toFixed(1)}x`);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const g = gesto.current; if (!g) return;
    if (e.touches.length > 0) return;
    gesto.current = null;
    if (g.dedos === 2) { e.preventDefault(); alternar(); }
    else if (g.moveu) e.preventDefault();
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
    const r = s.getRangeAt(0);
    const pre = document.createRange();
    pre.selectNodeContents(el); pre.setEnd(r.startContainer, r.startOffset);
    const inicio = pre.toString().length;
    const trecho = r.toString();
    if (trecho.trim()) setSel({ pid, inicio, fim: inicio + trecho.length, trecho });
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

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      {/* PLAYER 35% */}
      <div className="relative flex h-[35dvh] shrink-0 flex-col bg-player">
        <Link to="/" aria-label="Voltar" className="absolute left-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-background/70 backdrop-blur">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="absolute right-3 top-3 z-10 flex gap-2">
          {ocultos.length > 0 && (
            <button aria-label="Itens ocultos" onClick={() => setPainelOcultos(true)} className="flex h-9 items-center gap-1 rounded-full bg-background/70 px-3 text-xs font-bold backdrop-blur">
              <EyeOff className="h-4 w-4" /> {ocultos.length}
            </button>
          )}
          {pub.video_url && (
            <button aria-label="Modo ajustar tempos" aria-pressed={modoTempo} onClick={() => setModoTempo((m) => !m)} className={`grid h-9 w-9 place-items-center rounded-full backdrop-blur ${modoTempo ? "bg-primary text-primary-foreground" : "bg-background/70"}`}>
              <Clock className="h-4 w-4" />
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
            onClick={alternar}
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
          <div className="pointer-events-none absolute left-1/2 top-[40%] z-10 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-background/80 px-5 py-3 text-2xl font-bold tabular-nums backdrop-blur">
            {hud}
          </div>
        )}
        {pub.video_url && (
          <div className="flex items-center gap-3 bg-card/95 px-3 py-2">
            <button aria-label={tocando ? "Pausar" : "Tocar"} onClick={() => (tocando ? video.current?.pause() : video.current?.play())} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              {tocando ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <span className="w-10 text-xs tabular-nums text-muted-foreground">{fmt(tempo)}</span>
            <input type="range" min={0} max={dur || 0} step={0.1} value={tempo} onChange={(e) => { if (video.current) video.current.currentTime = +e.target.value; }} className="flex-1 accent-primary" aria-label="Progresso" />
            <button
              onClick={() => { const i = VELOCIDADES.indexOf(vel); aplicarVel(VELOCIDADES[(i + 1) % VELOCIDADES.length] ?? 1); }}
              className="w-14 rounded-lg bg-secondary py-1 text-xs font-bold tabular-nums"
            >
              {vel.toFixed(1)}x
            </button>
          </div>
        )}
      </div>

      {/* TEXTO 65% */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 pb-24 pt-5">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">{pub.semana}</p>
          <h1 className="mb-5 text-2xl font-bold leading-tight">{pub.titulo}</h1>
          {modoTempo && (
            <p className="mb-4 rounded-xl bg-accent p-3 text-sm text-accent-foreground">
              Modo ajustar tempos ligado: o relógio em cada trecho grava o tempo atual do vídeo. Toque no relógio do topo para sair.
            </p>
          )}
          {visiveis.map((p) => (
            <ParagrafoView
              key={p.id}
              p={p}
              ativo={ativo === p.id}
              acompanhando={tocando}
              notas={notas.filter((n) => n.paragrafo_id === p.id)}
              temVideo={!!pub.video_url}
              modoTempo={modoTempo}
              onTap={() => { setAtivo(p.id); if (pub.video_url) { trava.current = p.timestamp_inicio; seekTo(p.timestamp_inicio); } }}
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

      {sel && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-popover p-2 shadow-2xl">
          {CORES.map((c) => (
            <button key={c} aria-label={`Marcar ${c}`} onMouseDown={(e) => e.preventDefault()} onClick={() => marcar(c)} className="h-9 w-9 rounded-full border-2 border-background" style={{ background: c }} />
          ))}
          <button onClick={() => setSel(null)} className="px-2 text-sm text-muted-foreground">Cancelar</button>
        </div>
      )}
    </div>
  );
}

function renderMarcado(texto: string, marcas: Anotacao[], onMarca: (m: Anotacao) => void) {
  const ms = marcas.filter((m) => m.tipo === "destaque" && m.inicio != null).sort((a, b) => a.inicio! - b.inicio!);
  const out: React.ReactNode[] = [];
  let pos = 0;
  for (const m of ms) {
    const ini = Math.max(m.inicio!, pos), fim = Math.min(m.fim!, texto.length);
    if (fim <= ini) continue;
    if (ini > pos) out.push(texto.slice(pos, ini));
    out.push(<mark key={m.id} style={{ background: m.cor_destaque }} className="cursor-pointer rounded-sm" onClick={(e) => { if (window.getSelection()?.toString()) return; e.stopPropagation(); onMarca(m); }}>{texto.slice(ini, fim)}</mark>);
    pos = fim;
  }
  out.push(texto.slice(pos));
  return out;
}

function ParagrafoView({ p, ativo, acompanhando, notas, temVideo, modoTempo, onTap, onOcultar, onMarca, onSelect, onSync, onNotas }: {
  p: Paragrafo; ativo: boolean; acompanhando: boolean; notas: Anotacao[]; temVideo: boolean; modoTempo: boolean;
  onTap: () => void; onOcultar: () => void; onMarca: (m: Anotacao) => void; onSelect: (el: HTMLElement) => void; onSync: () => void;
  onNotas: React.Dispatch<React.SetStateAction<Anotacao[]>>;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const nota = notas.find((n) => n.tipo === "nota");
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState(nota?.texto_comentario ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  return (
    <div aria-current={ativo ? "true" : undefined} className={`mb-2 border-l-2 px-3 py-2 transition ${ativo ? "border-primary bg-selection" : "border-transparent"}`}>
      <p
        ref={ref}
        onClick={() => { if (!window.getSelection()?.toString()) onTap(); }}
        onMouseUp={() => ref.current && onSelect(ref.current)}
        onTouchEnd={() => setTimeout(() => ref.current && onSelect(ref.current), 50)}
        className={`cursor-pointer select-text leading-relaxed ${p.pergunta ? "text-base font-bold italic text-primary" : "text-[1.1rem]"}`}
      >
        {renderMarcado(p.texto_portugues, notas, onMarca)}
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
        <button aria-label="Ocultar trecho" title="Ocultar" onClick={() => { if (confirm("Ocultar este trecho? Você pode mostrar de novo em Itens ocultos.")) onOcultar(); }} className="rounded-lg p-1.5 hover:bg-secondary">
          <EyeOff className="h-4 w-4" />
        </button>
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
          className="mt-1 w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
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
