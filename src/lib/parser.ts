import { uid, type Paragrafo, type Publicacao, type TipoPub } from "./db";
import { baixarPagina } from "./fetch-page.functions";

const PROXIES = [
  (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
];

async function fetchProxy(url: string): Promise<string> {
  let lastErr: unknown;
  try {
    return (await baixarPagina({ data: { url } })).texto;
  } catch (e) {
    lastErr = e;
  }
  for (const p of PROXIES) {
    try {
      const r = await fetch(p(url));
      if (r.ok) return await r.text();
      lastErr = new Error(`HTTP ${r.status}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error("Não foi possível baixar a página. " + (lastErr instanceof Error ? lastErr.message : String(lastErr)));
}

export interface ArtigoRevista { titulo: string; url: string }

/** Se o link for o sumário de uma revista, devolve a lista de artigos; senão, lista vazia. */
export async function listarArtigos(url: string): Promise<ArtigoRevista[]> {
  const html = await fetchProxy(url);
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (doc.querySelectorAll("p[data-pid]").length > 5) return [];
  const base = new URL(url);
  const basePath = base.pathname.endsWith("/") ? base.pathname : base.pathname + "/";
  const vistos = new Map<string, string>();
  doc.querySelectorAll("a[href]").forEach((a) => {
    let u: URL;
    try { u = new URL(a.getAttribute("href")!, url); } catch { return; }
    if (u.hostname !== base.hostname || !u.pathname.startsWith(basePath) || u.pathname === basePath) return;
    const href = u.origin + u.pathname;
    const t = a.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (t.length > (vistos.get(href)?.length ?? 0)) vistos.set(href, t);
  });
  return Array.from(vistos, ([u, t]) => ({
    url: u,
    titulo: t || decodeURIComponent(u.split("/").filter(Boolean).pop() ?? "").replace(/-/g, " "),
  }));
}

/** "00:01:23.500" | "1:23" | "83" -> segundos */
export function parseTempo(t: string): number {
  const parts = t.trim().replace(",", ".").split(":").map(Number);
  return parts.reduce((acc, n) => acc * 60 + (isNaN(n) ? 0 : n), 0);
}

function findMp4(obj: unknown, out: string[] = []): string[] {
  if (typeof obj === "string") {
    if (/\.mp4(\?|$)/i.test(obj)) out.push(obj);
  } else if (Array.isArray(obj)) obj.forEach((o) => findMp4(o, out));
  else if (obj && typeof obj === "object") Object.values(obj).forEach((o) => findMp4(o, out));
  return out;
}

interface Marker {
  label?: string;
  startTime: number;
  docId?: string;
}
function findMarkers(obj: unknown, out: Marker[] = []): Marker[] {
  if (Array.isArray(obj)) obj.forEach((o) => findMarkers(o, out));
  else if (obj && typeof obj === "object") {
    const o = obj as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (Array.isArray(o.markers)) {
      const docId = o.documentId != null ? String(o.documentId) : undefined;
      for (const m of o.markers as any[]) {
        const st = m.startTime ?? m.start ?? m.time;
        if (st != null)
          out.push({
            label: m.mepsParagraphId != null ? String(m.mepsParagraphId) : String(m.label ?? ""),
            startTime: typeof st === "number" ? st : parseTempo(String(st)),
            docId,
          });
      }
    } else Object.values(o).forEach((v) => findMarkers(v, out));
  }
  return out;
}

function parseVtt(vtt: string): number[] {
  const res: number[] = [];
  for (const m of vtt.matchAll(/(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->/g)) res.push(parseTempo(m[0].replace("-->", "")));
  return res;
}

export interface ResultadoImport {
  publicacao: Publicacao;
  paragrafos: Paragrafo[];
  avisos: string[];
}

export async function importarUrl(url: string): Promise<ResultadoImport> {
  const avisos: string[] = [];
  const html = await fetchProxy(url);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const abs = (h: string) => {
    try { return new URL(h, url).href; } catch { return h; }
  };

  // 1. título e semana
  const titulo =
    doc.querySelector("article h1, h1")?.textContent?.trim() ||
    doc.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
    doc.title || "Sem título";
  const bodyText = doc.body?.textContent ?? "";
  const semanaMatch =
    doc.querySelector(".contextTtl, .pubRefs, header p, .du-color--textSubdued")?.textContent?.match(/\d{1,2}(?:\s*(?:de\s+\w+)?\s*[-–a]\s*\d{1,2})?\s+de\s+\w+(?:\s+de\s+\d{4})?/i) ||
    bodyText.match(/(?:SEMANA DE\s*)?\d{1,2}(?:\s*(?:de\s+\w+)?)?\s*[-–]\s*\d{1,2}\s+de\s+\w+(?:\s+de\s+\d{4})?/i);
  const semana = semanaMatch?.[0].trim() ?? new Date().toLocaleDateString("pt-BR");

  // 2. tipo
  const sinal = (url + " " + titulo + " " + bodyText.slice(0, 3000)).toLowerCase();
  const tipo: TipoPub = /vida-e-minist|vida e minist|apostila|\bmwb\b|nossa vida crist/.test(sinal) ? "apostila" : "sentinela";

  // 3. vídeo
  let video_url = "";
  const mediaEls = Array.from(doc.querySelectorAll("video source[src], video[src], a[href*='.mp4'], [data-video], [data-src*='.mp4']"));
  for (const el of mediaEls) {
    const v = el.getAttribute("src") || el.getAttribute("href") || el.getAttribute("data-src") || el.getAttribute("data-video");
    if (v && /\.mp4/i.test(v)) { video_url = abs(v); break; }
  }
  let markers: Marker[] = [];
  const jsonBlobs: unknown[] = [];
  doc.querySelectorAll('script[type="application/ld+json"], script[type="application/json"]').forEach((s) => {
    try { jsonBlobs.push(JSON.parse(s.textContent || "")); } catch { /* ignore */ }
  });
  const jsonUrls = Array.from(doc.querySelectorAll("[data-jsonurl]")).map((e) => abs(e.getAttribute("data-jsonurl")!));
  const docId = jsonUrls.map((u) => u.match(/docid=(\d+)/)?.[1]).find(Boolean);
  const ordenadas = [...jsonUrls.filter((u) => /track=/.test(u) && /mp4/i.test(u)), ...jsonUrls];
  for (const ju of Array.from(new Set(ordenadas)).slice(0, 3)) {
    try { jsonBlobs.push(JSON.parse(await fetchProxy(ju))); } catch { /* ignore */ }
  }
  for (const j of jsonBlobs) {
    if (!video_url) {
      const mp4s = findMp4(j);
      video_url = mp4s.find((m) => /720|480/.test(m)) || mp4s[0] || "";
    }
    markers.push(...findMarkers(j));
  }
  if (docId && markers.some((m) => m.docId === docId)) markers = markers.filter((m) => m.docId === docId);
  {
    const vistos = new Set<string>();
    markers = markers.filter((m) => { const k = m.label + "@" + m.startTime; if (vistos.has(k)) return false; vistos.add(k); return true; });
  }
  if (!video_url) {
    const m = html.match(/https?:[^"'\s<>]+?\.mp4/i);
    if (m) video_url = m[0].replace(/\\\//g, "/");
  }
  if (!video_url) avisos.push("Vídeo em Libras não encontrado — você pode colar o link MP4 no leitor.");

  // 5. VTT
  if (!markers.length) {
    const track = doc.querySelector("track[src]")?.getAttribute("src") || html.match(/https?:[^"'\s<>]+?\.vtt/i)?.[0];
    if (track) {
      try { markers = parseVtt(await fetchProxy(abs(track))).map((t) => ({ startTime: t })); } catch { /* ignore */ }
    }
  }

  // 4. parágrafos e perguntas
  const root = doc.querySelector("article, #article, .docSubContent, main") || doc.body;
  const nodes = Array.from(root.querySelectorAll("p[data-pid], p.qu, p.p, p.sb, h2, h3, p")).filter(
    (el, i, arr) => arr.indexOf(el) === i && !el.closest("nav, footer, header, figure, .footnote, .jsRelatedPubs"),
  );
  const seen = new Set<Element>();
  const textos: { texto: string; pergunta: boolean; pid?: string | undefined }[] = [];
  for (const el of nodes) {
    if (seen.has(el)) continue;
    seen.add(el);
    const t = el.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (t.length < 3) continue;
    const pergunta = el.classList.contains("qu") || /^\d+[,\s\d-]*\.\s.*\?$/.test(t) || (el.tagName.startsWith("H") && t.endsWith("?"));
    textos.push({ texto: t, pergunta, pid: el.getAttribute("data-pid") ?? undefined });
  }
  if (!textos.length) throw new Error("Nenhum parágrafo encontrado nesta página.");

  const pubId = uid();
  const usaPid = textos.some((t) => t.pid && markers.some((m) => m.label === t.pid));
  let ultimo = 0;
  const paragrafos: Paragrafo[] = textos.map((t, i) => {
    const byPid = t.pid ? markers.find((m) => m.label === t.pid) : undefined;
    const ts = usaPid ? (byPid?.startTime ?? ultimo) : (markers[i]?.startTime ?? 0);
    ultimo = ts;
    return {
      id: uid(),
      publicacao_id: pubId,
      numero_ordem: i,
      texto_portugues: t.texto,
      pergunta: t.pergunta,
      timestamp_inicio: ts,
    };
  });
  if (!markers.length) avisos.push("Marcadores de tempo não encontrados — use o botão de relógio em cada parágrafo para sincronizar.");

  return {
    publicacao: { id: pubId, tipo, titulo, semana, url_origem: url, video_url, criado_em: Date.now() },
    paragrafos,
    avisos,
  };
}
