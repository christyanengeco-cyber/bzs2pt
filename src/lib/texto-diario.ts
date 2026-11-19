/** Texto diário em português, buscado sob demanda (um dia por vez) no wol.jw.org
 *  e guardado no aparelho. A data vem do relógio, então a virada de ano é automática. */
import { textoVisivel } from "./publication-layout";

export type Trecho = { t: string; href?: string };
export type TextoDiario = { data: string; titulo: string; tema: Trecho[]; comentario: Trecho[][] };

export const CHAVE_PREF = "texto-diario-ativo";
export const EVENTO_PREF = "texto-diario-pref";
const WOL = "https://wol.jw.org";

export function textoDiarioAtivo(): boolean {
  return localStorage.getItem(CHAVE_PREF) !== "0";
}
export function definirTextoDiario(ativo: boolean) {
  localStorage.setItem(CHAVE_PREF, ativo ? "1" : "0");
  window.dispatchEvent(new Event(EVENTO_PREF));
}

export function chaveDia(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function urlDia(d: Date) {
  return `${WOL}/pt/wol/dt/r5/lp-t/${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/** Texto e links (Bíblia e publicação de estudo) de um parágrafo. */
function trechos(el: Element): Trecho[] {
  const out: Trecho[] = [];
  const andar = (n: Node) => {
    if (n.nodeType === 3) out.push({ t: n.textContent ?? "" });
    else if (n instanceof Element && n.matches("a.fn, .fn, .footnote, sup, .parNum, .pageNum, .refID")) return;
    else if (n instanceof Element && n.tagName === "A" && n.getAttribute("href")) {
      const t = (n.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!t || /^[+*†‡§]+$/.test(t)) return;
      out.push({ t, href: new URL(n.getAttribute("href")!, WOL).href });
    } else n.childNodes.forEach(andar);
  };
  el.childNodes.forEach(andar);
  return out.map((x) => ({ ...x, t: x.t.replace(/\s+/g, " ") })).filter((x) => x.t);
}

export function extrairTextoDiario(html: string, data: string): TextoDiario | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tema = doc.querySelector("p.themeScrp");
  if (!tema) return null;
  const bloco = tema.parentElement;
  const titulo = bloco?.querySelector("h2")?.textContent?.trim() ?? "";
  const comentario = Array.from(bloco?.querySelectorAll(".bodyTxt p") ?? [])
    .map(trechos)
    .filter((t) => t.length);
  return { data, titulo, tema: trechos(tema), comentario };
}

/** Números de versículo no rótulo do link ("Tia. 4:8", "Êxo. 17:2,7"). */
function versosDoRotulo(rotulo: string): number[] {
  const depois = rotulo.includes(":") ? rotulo.slice(rotulo.lastIndexOf(":") + 1) : rotulo;
  const out = new Set<number>();
  for (const m of depois.matchAll(/(\d+)(?:\s*[-–]\s*(\d+))?/g)) {
    const ini = +m[1]!;
    const fim = m[2] ? +m[2] : ini;
    for (let n = ini; n <= fim && n < ini + 20; n++) out.add(n);
  }
  return [...out];
}

/** Conteúdo de um link do texto diário: versículos (#v=l:c:v[-l:c:v]) ou
 *  parágrafos (#h=23:0-25:0) da página de destino. Sem hash, como nos links
 *  /bc/ do wol.jw.org, o versículo vem do rótulo ("Tia. 4:8"). */
export function extrairReferencia(
  html: string,
  urlFinal: string,
  rotulo = "",
): { titulo: string; paragrafos: string[] } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const hash = urlFinal.split("#")[1] ?? "";
  const limpo = (e: Element) => textoVisivel(e);
  const lerVersos = (l: string, c: string, numeros: number[]) =>
    numeros
      .map((n) => {
        const partes = Array.from(doc.querySelectorAll(`[id^="v${l}-${c}-${n}-"]`)).map(limpo).join(" ");
        return partes.replace(/^\d+\s*/, `${n} `);
      })
      .filter(Boolean);
  const nomeLivro = doc.querySelector("title")?.textContent?.split(/\s+[|—]\s+/)[0]?.trim() ?? "";
  const tituloVersos = (numeros: number[]) => `${nomeLivro}${nomeLivro ? ":" : ""}${numeros.join(",")}`;
  const v = /v=(\d+):(\d+):(\d+)(?:-(\d+):(\d+):(\d+))?/.exec(hash);
  if (v) {
    const [l, c, ini] = [v[1]!, v[2]!, +v[3]!];
    const fim = v[6] && v[5] === c ? +v[6] : ini;
    const numeros = Array.from({ length: Math.max(0, fim - ini + 1) }, (_, i) => ini + i);
    return { titulo: tituloVersos(numeros), paragrafos: lerVersos(l, c, numeros) };
  }
  // O link /bc/ do wol.jw.org cai na página do capítulo sem #v=; o versículo
  // citado está no próprio rótulo do link.
  const biblia = /\/wol\/b\/[^/]+\/[^/]+\/[^/]+\/(\d+)\/(\d+)/.exec(urlFinal);
  if (biblia && rotulo) {
    const numeros = versosDoRotulo(rotulo);
    const paragrafos = numeros.length ? lerVersos(biblia[1]!, biblia[2]!, numeros) : [];
    if (paragrafos.length) return { titulo: tituloVersos(numeros), paragrafos };
  }
  const h = /h=(\d+)(?::\d+)?(?:-(\d+))?/.exec(hash);
  const titulo = doc.querySelector("h1")?.textContent?.trim() ?? "";
  if (h) {
    const out: string[] = [];
    for (let n = +h[1]!; n <= +(h[2] ?? h[1]!); n++) {
      const e = doc.getElementById(`p${n}`);
      if (e) out.push(limpo(e));
    }
    return { titulo, paragrafos: out.filter(Boolean) };
  }
  return { titulo, paragrafos: Array.from(doc.querySelectorAll("article p")).slice(0, 6).map(limpo).filter(Boolean) };
}

const PREFIXO = "texto-diario2:";

export async function obterTextoDiario(
  d: Date,
  baixar: (url: string) => Promise<string>,
): Promise<TextoDiario> {
  const data = chaveDia(d);
  const salvo = localStorage.getItem(PREFIXO + data);
  if (salvo) return JSON.parse(salvo) as TextoDiario;
  const texto = extrairTextoDiario(await baixar(urlDia(d)), data);
  if (!texto) throw new Error("Texto diário não encontrado");
  Object.keys(localStorage).filter((k) => k.startsWith("texto-diario:")).forEach((k) => localStorage.removeItem(k));
  const chaves = Object.keys(localStorage).filter((k) => k.startsWith(PREFIXO)).sort();
  while (chaves.length >= 10) localStorage.removeItem(chaves.shift()!);
  localStorage.setItem(PREFIXO + data, JSON.stringify(texto));
  return texto;
}
