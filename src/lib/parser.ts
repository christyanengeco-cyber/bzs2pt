import { uid, type Paragrafo, type Publicacao, type TipoPub } from "./db";
import { baixarPagina } from "./fetch-page.functions";
import { extrairIntervaloSemana } from "./study-dates";
import { elementosPublicacao, imagemDoElemento, estruturaDoElemento, guardarImagem } from "./publication-layout";

// corsproxy.io passou a exigir chave de API (responde 401), então o encadeamento agora
// começa pelos proxies públicos sem chave e trata corpo vazio/desafio do WAF como falha.
const PROXIES: ((u: string) => string)[] = [
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  (u: string) => `https://api.cors.lol/?url=${encodeURIComponent(u)}`,
  (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
];

/** Páginas reais do jw.org são HTML, JSON (data-jsonurl) ou legendas VTT — nunca um corpo vazio. */
function respostaUtil(t: string): boolean {
  const s = t.trim();
  if (!s) return false;
  return /^<!doctype/i.test(s) || /^<html/i.test(s) || /^[{[]/.test(s) || /^WEBVTT/i.test(s) || s.length > 1000;
}

// Cache de curto prazo: o painel de referência e a importação buscam a mesma página
// mais de uma vez; em redes fracas cada download passa por vários proxies.
const cacheFetch = new Map<string, { texto: string; expira: number }>();
const TEMPO_CACHE = 120000;

export async function fetchProxy(url: string): Promise<string> {
  const c = cacheFetch.get(url);
  if (c && c.expira > Date.now()) return c.texto;
  const erros: string[] = [];
  try {
    const r = await baixarPagina({ data: { url } });
    if (respostaUtil(r.texto)) {
      cacheFetch.set(url, { texto: r.texto, expira: Date.now() + TEMPO_CACHE });
      return r.texto;
    }
    erros.push("jw.org devolveu uma resposta vazia");
  } catch (e) {
    erros.push(e instanceof Error ? e.message : String(e));
  }
  for (const p of PROXIES) {
    try {
      const r = await fetch(p(url), { signal: AbortSignal.timeout(20000) });
      if (!r.ok) {
        erros.push(`HTTP ${r.status}`);
        continue;
      }
      const t = await r.text();
      if (!respostaUtil(t)) {
        erros.push("proxy devolveu uma resposta vazia");
        continue;
      }
      cacheFetch.set(url, { texto: t, expira: Date.now() + TEMPO_CACHE });
      return t;
    } catch (e) {
      erros.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new Error(`Não foi possível baixar a página (${erros.slice(0, 2).join("; ")}). Verifique sua conexão e tente de novo.`);
}

export const LIXO = /^(Desculpe-nos\. O tocador de mídia não carregou\.?|Baixar vídeo|Baixar|Compartilhar|Reproduzir)$/i;

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
  docId?: string | undefined;
}
function findMarkers(obj: unknown, out: Marker[] = []): Marker[] {
  if (Array.isArray(obj)) obj.forEach((o) => findMarkers(o, out));
  else if (obj && typeof obj === "object") {
    const o = obj as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (Array.isArray(o.markers)) {
      const docId = o.documentId != null ? String(o.documentId) : undefined;
      for (const m of o.markers as any[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
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

async function videoDaPagina(html: string, base: string): Promise<{ titulo: string; mp4s: string[]; doc: Document }> {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const titulo = doc.querySelector("meta[property='og:title']")?.getAttribute("content") || doc.title || "";
  const mp4s: string[] = [];
  for (const el of Array.from(doc.querySelectorAll("video source[src], video[src], a[href*='.mp4'], [data-src*='.mp4']"))) {
    const v = el.getAttribute("src") || el.getAttribute("href") || el.getAttribute("data-src");
    if (v && /\.mp4/i.test(v)) { try { mp4s.push(new URL(v, base).href); } catch { /* ignore */ } }
  }
  const extras: unknown[] = [];
  doc.querySelectorAll('script[type="application/ld+json"], script[type="application/json"]').forEach((s) => {
    try { extras.push(JSON.parse(s.textContent || "")); } catch { /* ignore */ }
  });
  const jsonUrls = Array.from(doc.querySelectorAll("[data-jsonurl]")).map((e) => { try { return new URL(e.getAttribute("data-jsonurl")!, base).href; } catch { return ""; } }).filter(Boolean).slice(0, 6);
  for (const ju of jsonUrls) {
    try { extras.push(JSON.parse(await fetchProxy(ju))); } catch { /* ignore */ }
  }
  for (const b of extras) mp4s.push(...findMp4(b));
  const m = html.match(/https?:[^"'\s<>]+?\.mp4/i);
  if (m) mp4s.push(m[0].replace(/\\\//g, "/"));
  return { titulo, mp4s, doc };
}

function escolherMp4(mp4s: string[]): string | undefined {
  return mp4s.find((m) => /720p/.test(m)) || mp4s.find((m) => /480p/.test(m)) || mp4s.find((m) => /360|240/.test(m)) || mp4s[0];
}

export interface VideoEncontrado { titulo: string; mp4: string }

/** Descobre o MP4 de um vídeo do jw.org a partir do link (página de vídeo ou listagem com #mid=). */
export async function extrairVideo(url: string): Promise<VideoEncontrado | undefined> {
  const mid = url.match(/mid=(\d+)/)?.[1];
  const pag = await videoDaPagina(await fetchProxy(url.split("#")[0] ?? url), url);
  if (mid) {
    const a = Array.from(pag.doc.querySelectorAll("a[href]")).find((x) => (x.getAttribute("href") ?? "").includes(mid));
    const h = a?.getAttribute("href");
    if (h) {
      const alvo = new URL(h, url).href;
      if (alvo.split("#")[0] !== url.split("#")[0]) {
        try {
          const pag2 = await videoDaPagina(await fetchProxy(alvo.split("#")[0] ?? alvo), alvo);
          const mp4 = escolherMp4(pag2.mp4s);
          if (mp4) return { titulo: pag2.titulo || pag.titulo, mp4 };
        } catch { /* segue para a própria página */ }
      }
    }
  }
  const mp4 = escolherMp4(pag.mp4s);
  return mp4 ? { titulo: pag.titulo, mp4 } : undefined;
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
  const intervaloRe = /\d{1,2}(?:\s*\.?[º°])?(?:\s+de\s+\w+)?\s*[-–a]\s*\d{1,2}(?:\s*\.?[º°])?\s+de\s+\w+(?:\s+de\s+\d{4})?/i;
  const semana = [titulo, doc.querySelector(".contextTtl, .pubRefs")?.textContent ?? "", bodyText].map((t) => t.match(intervaloRe)?.[0]).find(Boolean) ?? new Date().toLocaleDateString("pt-BR");
  const anoUrl = url.match(/(?:19|20)\d{2}/)?.[0];
  const intervalo = extrairIntervaloSemana(semana, anoUrl ? Number(anoUrl) : new Date().getFullYear());

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
  const pids = new Set(Array.from(doc.querySelectorAll("[data-pid]")).map((e) => e.getAttribute("data-pid") ?? ""));
  const blobs = jsonBlobs.map((j) => ({ mp4s: findMp4(j), markers: findMarkers(j) }));
  for (const ju of Array.from(new Set(ordenadas)).slice(0, 8)) {
    try {
      const j: unknown = JSON.parse(await fetchProxy(ju));
      blobs.push({ mp4s: findMp4(j), markers: findMarkers(j) });
    } catch { /* ignore */ }
  }
  const pontos = (b: { markers: Marker[] }) => b.markers.filter((m) => m.label && pids.has(m.label)).length;
  const comMp4 = blobs.filter((b) => b.mp4s.length);
  if (comMp4.length) {
    const melhor = [...comMp4].sort((a, b) => pontos(b) - pontos(a))[0]!;
    video_url = melhor.mp4s.find((m) => /720p/.test(m)) || melhor.mp4s.find((m) => /480p/.test(m)) || melhor.mp4s[0] || "";
    markers = pontos(melhor) > 0 ? melhor.markers : comMp4.flatMap((b) => b.markers);
  } else {
    markers = blobs.flatMap((b) => b.markers);
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
  const nodes = elementosPublicacao(doc);
  const seen = new Set<Element>();
  const textos: { estrutura?: ReturnType<typeof estruturaDoElemento>; imagem_alt?: string; texto: string; imagem?: string; pergunta: boolean; pid?: string | undefined; links: { inicio: number; fim: number; href: string }[] }[] = [];
  for (const el of nodes) {
    if (seen.has(el)) continue;
    seen.add(el);
    if (el.tagName === "IMG" || el.classList.contains("jsRespImg")) {
      const imagem = imagemDoElemento(el, url);
      if (imagem) textos.push({ texto: "", imagem: await guardarImagem(imagem), imagem_alt: el.getAttribute("data-img-att-alt") || el.getAttribute("alt") || "", estrutura: estruturaDoElemento(el), pergunta: false, links: [] });
      continue;
    }
    const t = el.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (t.length < 3) continue;
    const pergunta = el.classList.contains("qu") || /^\d+[,\s\d-]*\.\s.*\?$/.test(t) || (el.tagName.startsWith("H") && t.endsWith("?"));
    const links: { inicio: number; fim: number; href: string }[] = [];
    let pos = 0;
    el.querySelectorAll("a[href]").forEach((a) => {
      const at = a.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const href = a.getAttribute("href") ?? "";
      if (!at || !href || href.startsWith("#")) return;
      const i = t.indexOf(at, pos);
      if (i < 0) return;
      links.push({ inicio: i, fim: i + at.length, href: abs(href) });
      pos = i + at.length;
    });
    textos.push({ estrutura: estruturaDoElemento(el), texto: t, pergunta, pid: el.getAttribute("data-pid") ?? undefined, links });
  }
  if (!textos.some((t) => t.texto)) {
    // Páginas de vídeo (links “Mostre o VÍDEO” da apostila) quase não têm parágrafos;
    // se o vídeo foi encontrado, o estudo ainda é salvo com o player em Libras.
    if (video_url) {
      avisos.push("Esta página é um vídeo: ela foi importada com o vídeo em Libras.");
      textos.push({ texto: titulo, pergunta: false, links: [] });
    } else {
      throw new Error("Nenhum parágrafo encontrado nesta página.");
    }
  }

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
      ...t.estrutura,
      ...(t.imagem_alt ? { imagem_alt: t.imagem_alt } : {}),
      pergunta: t.pergunta,
      oculto: LIXO.test(t.texto),
      timestamp_inicio: ts,
      ...(t.links.length ? { links: t.links } : {}),
      ...(t.imagem ? { imagem: t.imagem } : {}),
    };
  });
  if (!markers.length) avisos.push("Marcadores de tempo não encontrados — use o botão de relógio em cada parágrafo para sincronizar.");

  return {
    publicacao: {
      id: pubId, tipo, titulo, semana, layout_versao: 1,
      ...(intervalo ? { semana_inicio: intervalo.inicio, semana_fim: intervalo.fim } : {}),
      url_origem: url, video_url, criado_em: Date.now(),
    },
    paragrafos,
    avisos,
  };
}

export interface ConteudoReferencia { titulo: string; trechos: string[]; biblia: boolean }

/** Busca só o trecho referenciado (versículos ou início do artigo), sem importar tudo. */
export async function buscarReferencia(href: string): Promise<ConteudoReferencia> {
  const html = await fetchProxy(href.split("#")[0] ?? href);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const limpar = (x: string | null | undefined) => (x ?? "").replace(/\s+/g, " ").trim();
  const titulo = limpar(doc.querySelector("article h1, h1")?.textContent) || limpar(doc.title);
  const hash = href.split("#")[1] ?? "";
  const ids = hash.match(/\d{6,}/g)?.map(Number) ?? [];
  const numPar = hash.match(/^p(\d+)$/)?.[1];
  const biblia = /\/biblia\//i.test(href) || ids.length > 0;
  if (ids.length) {
    const ini = ids[0]!, fim = ids[ids.length - 1]!;
    const trechos: string[] = [];
    doc.querySelectorAll("[id]").forEach((e) => {
      const m = e.id.match(/^v(\d+)(?:-\d+)?$/);
      if (!m) return;
      const n = Number(m[1]);
      if (n >= ini && n <= fim) { const t = limpar(e.textContent); if (t && !trechos.includes(t)) trechos.push(t); }
    });
    if (trechos.length) return { titulo, trechos, biblia: true };
  }
  const root = doc.querySelector("article, #article, main") || doc.body;
  let alvo: Element | undefined;
  if (numPar) {
    alvo = doc.getElementById("p" + numPar) ?? Array.from(root.querySelectorAll("p[data-pid]"))[Number(numPar) - 1];
    if (alvo) return { titulo, trechos: [limpar(alvo.textContent)], biblia: false };
  }
  const trechos = Array.from(root.querySelectorAll("p")).map((p) => limpar(p.textContent)).filter((t) => t.length > 2 && !LIXO.test(t)).slice(0, 12);
  if (!trechos.length) throw new Error("Não encontramos o conteúdo desta referência.");
  return { titulo, trechos, biblia };
}

/** Estudo bíblico de congregação: encontra a lição em Libras pelo código da publicação. */
const LIVROS_BZS: Record<string, { slug: string; meps: string }> = {
  wcg: { slug: "ande-corajosamente-com-deus", meps: "11020259" },
  lff: { slug: "seja-feliz-para-sempre", meps: "11020212" },
};

/** URL canônica de uma página do jw.org (a partir de <link rel=canonical>), válida
 *  também quando a página chega via proxy, já que o redirect já foi seguido. */
export function extrairUrlCanonical(doc: Document): string | undefined {
  const u =
    doc.querySelector('link[rel="canonical"]')?.getAttribute("href") ||
    doc.querySelector('meta[property="og:url"]')?.getAttribute("content");
  if (!u) return undefined;
  try {
    const parsed = new URL(u, "https://www.jw.org");
    const segmentos = parsed.pathname.split("/").filter(Boolean);
    if (/^bzs$/i.test(segmentos[0] ?? "") && segmentos.length >= 3 && !/finder|home/i.test(parsed.pathname)) return parsed.href;
  } catch { /* ignore */ }
  return undefined;
}

export async function resolverEstudoLivro(code: string, n: number): Promise<string> {
  const info = LIVROS_BZS[code];
  // 1) Caminho canônico: o finder do jw.org redireciona direto para a lição em Libras;
  //    a URL final sai do <link rel=canonical>, imune a mudanças de estrutura do site.
  if (info) {
    const docId = `${info.meps}${String(n).padStart(2, "0")}`;
    try {
      const html = await fetchProxy(`https://www.jw.org/finder?wtlocale=BZS&docid=${docId}`);
      const doc = new DOMParser().parseFromString(html, "text/html");
      const u = extrairUrlCanonical(doc);
      if (u) return u;
    } catch { /* tenta o sumário do livro */ }
  }
  // 2) Sumário do livro em Libras: procura o docid da lição nos atributos da página-índice.
  const base = info
    ? `https://www.jw.org/bzs/biblioteca/livros/${info.slug}/`
    : `https://www.jw.org/finder?wtlocale=BZS&pub=${encodeURIComponent(code)}`;
  const html = await fetchProxy(base);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const abs = (h: string) => new URL(h, "https://www.jw.org").href;
  if (info) {
    const id = `${info.meps}${String(n).padStart(2, "0")}`;
    for (const el of Array.from(doc.querySelectorAll("*"))) {
      const attrs = Array.from(el.attributes).map((a) => a.value).join(" ");
      if (!new RegExp(`(mid|docid=|^|\\D)${id}(\\D|$)`).test(attrs)) continue;
      const a = el.closest("a[href]") ?? el.querySelector("a[href]");
      const h = a?.getAttribute("href");
      if (h && h.includes("/bzs/")) return abs(h);
    }
  }
  const re = new RegExp(`(^|\\b(li[çc][aã]o|cap[ií]tulo|cap\\.?)\\s*)0*${n}\\b`, "i");
  for (const a of Array.from(doc.querySelectorAll("a[href]"))) {
    const t = a.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const href = a.getAttribute("href") ?? "";
    if (!href.includes("/bzs/") || !re.test(t)) continue;
    return abs(href);
  }
  throw new Error("Lição não encontrada no sumário em Libras.");
}

const LIVRO_RE = /\b(wcg|lff|lfb|bt|jy|rr|ia|lv|lr|bhs|cl|scl|wp|ld|lmd|jl)\s*[-–—]?\s*(?:li[çc][aã]o|cap(?:[ií]tulo|\.)?|hist[óo]ria|ex(?:er[cç][íi]cios)?\.?)?\s*[º°]?\s*(\d+)/i;
const NOMES_LIVROS: [RegExp, string][] = [
  [/ande\s+corajosamente\s+com\s+deus/i, "wcg"],
  [/seja\s+feliz\s+para\s+sempre/i, "lff"],
];
/** Cria link interno para o estudo de livro no parágrafo do Estudo bíblico de congregação. */
export function linkEstudoLivro(texto: string, anterior = "") {
  if (!/estudo b[íi]blico de congrega|\(30 min\)|\b(?:wcg|lff)\s*[-–—]?\s*(?:li[çc][aã]o|cap(?:[ií]tulo|\.)?|hist[óo]ria|ex(?:er[cç][íi]cios)?\.?)?\s*[º°]?\s*\d|ande\s+corajosamente\s+com\s+deus|seja\s+feliz\s+para\s+sempre/i.test(texto + " " + anterior)) return null;
  const m = texto.match(LIVRO_RE);
  if (m && m.index != null) return { inicio: m.index, fim: m.index + m[0].length, href: `livro:${m[1]!.toLowerCase()}:${m[2]}` };
  // Nome do livro por extenso: "Ande corajosamente com Deus, lição 13"
  for (const [re, code] of NOMES_LIVROS) {
    const nm = texto.match(new RegExp(re.source + "\\D{0,30}?(\\d+)", "i"));
    if (nm && nm.index != null) return { inicio: nm.index, fim: nm.index + nm[0].length, href: `livro:${code}:${nm[1]}` };
  }
  return null;
}
