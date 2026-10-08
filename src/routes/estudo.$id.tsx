import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock, MessageCircle, Pause, Play, Eraser, Video } from "lucide-react";
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
    ],
  }),
  component: Leitor,
});

const VELOCIDADES = [0.75, 1, 1.25, 1.5];
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

  useEffect(() => {
    getPublicacao(id).then((p) => setPub(p ?? null));
    listarParagrafos(id).then(setParas);
    listarAnotacoes(id).then(setNotas);
  }, [id]);

  const seekTo = (s: number) => {
    const v = video.current; if (!v) return;
    v.currentTime = s; v.play().catch(() => {});
  };

  // paragrafo atual conforme o vídeo
  useEffect(() => {
    const cur = [...paras].reverse().find((p) => p.timestamp_inicio > 0 && p.timestamp_inicio <= tempo + 0.2);
    if (cur && cur.id !== ativo && tocando) setAtivo(cur.id);
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
        {pub.video_url ? (
          <video
            ref={video}
            src={pub.video_url}
            playsInline
            preload="metadata"
            className="min-h-0 w-full flex-1 object-contain"
            onPlay={() => setTocando(true)}
            onPause={() => setTocando(false)}
            onTimeUpdate={(e) => setTempo(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
            onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause())}
          />
        ) : (
          <SemVideo onSave={async (u) => { const np = { ...pub, video_url: u }; await atualizarPublicacao(np); setPub(np); }} />
        )}
        {pub.video_url && (
          <div className="flex items-center gap-3 bg-card/95 px-3 py-2">
            <button aria-label={tocando ? "Pausar" : "Tocar"} onClick={() => (tocando ? video.current?.pause() : video.current?.play())} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              {tocando ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <span className="w-10 text-xs tabular-nums text-muted-foreground">{fmt(tempo)}</span>
            <input type="range" min={0} max={dur || 0} step={0.1} value={tempo} onChange={(e) => { if (video.current) video.current.currentTime = +e.target.value; }} className="flex-1 accent-primary" aria-label="Progresso" />
            <button
              onClick={() => { const n = VELOCIDADES[(VELOCIDADES.indexOf(vel) + 1) % VELOCIDADES.length]; setVel(n); if (video.current) video.current.playbackRate = n; }}
              className="w-14 rounded-lg bg-secondary py-1 text-xs font-bold"
            >
              {vel}x
            </button>
          </div>
        )}
      </div>

      {/* TEXTO 65% */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 pb-24 pt-5">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">{pub.semana}</p>
          <h1 className="mb-5 text-2xl font-bold leading-tight">{pub.titulo}</h1>
          {paras.map((p) => (
            <ParagrafoView
              key={p.id}
              p={p}
              ativo={ativo === p.id}
              notas={notas.filter((n) => n.paragrafo_id === p.id)}
              temVideo={!!pub.video_url}
              onTap={() => { setAtivo(p.id); if (pub.video_url) seekTo(p.timestamp_inicio); }}
              onSelect={(el) => onSelect(p.id, el)}
              onSync={() => sincronizar(p)}
              onNotas={setNotas}
            />
          ))}
        </div>
      </div>

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

function renderMarcado(texto: string, marcas: Anotacao[]) {
  const ms = marcas.filter((m) => m.tipo === "destaque" && m.inicio != null).sort((a, b) => a.inicio! - b.inicio!);
  const out: React.ReactNode[] = [];
  let pos = 0;
  for (const m of ms) {
    const ini = Math.max(m.inicio!, pos), fim = Math.min(m.fim!, texto.length);
    if (fim <= ini) continue;
    if (ini > pos) out.push(texto.slice(pos, ini));
    out.push(<mark key={m.id} style={{ background: m.cor_destaque }}>{texto.slice(ini, fim)}</mark>);
    pos = fim;
  }
  out.push(texto.slice(pos));
  return out;
}

function ParagrafoView({ p, ativo, notas, temVideo, onTap, onSelect, onSync, onNotas }: {
  p: Paragrafo; ativo: boolean; notas: Anotacao[]; temVideo: boolean;
  onTap: () => void; onSelect: (el: HTMLElement) => void; onSync: () => void;
  onNotas: React.Dispatch<React.SetStateAction<Anotacao[]>>;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const nota = notas.find((n) => n.tipo === "nota");
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState(nota?.texto_comentario ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { if (ativo) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [ativo]);

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
    <div className={`mb-3 rounded-2xl border-l-4 px-3 py-2 transition ${ativo ? "border-primary bg-accent/40" : "border-transparent"}`}>
      <p
        ref={ref}
        onClick={() => { if (!window.getSelection()?.toString()) onTap(); }}
        onMouseUp={() => ref.current && onSelect(ref.current)}
        onTouchEnd={() => setTimeout(() => ref.current && onSelect(ref.current), 50)}
        className={`cursor-pointer select-text leading-relaxed ${p.pergunta ? "text-base font-bold italic text-primary" : "text-[1.1rem]"}`}
      >
        {renderMarcado(p.texto_portugues, notas)}
      </p>
      <div className="mt-1 flex items-center gap-1 text-muted-foreground">
        {temVideo && (
          <span className="mr-auto flex items-center gap-1 text-xs tabular-nums">
            <Video className="h-3 w-3" /> {fmt(p.timestamp_inicio)}
          </span>
        )}
        {!temVideo && <span className="mr-auto" />}
        {temVideo && (
          <button onClick={onSync} title="Usar o tempo atual do vídeo" aria-label="Sincronizar com o tempo atual" className="rounded-lg p-1.5 hover:bg-secondary">
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
