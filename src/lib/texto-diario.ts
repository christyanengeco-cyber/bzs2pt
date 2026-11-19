/** Texto diário em português, buscado sob demanda (um dia por vez) no wol.jw.org
 *  e guardado no aparelho. A data vem do relógio, então a virada de ano é automática. */
export type TextoDiario = { data: string; titulo: string; tema: string; comentario: string[] };

export const CHAVE_PREF = "texto-diario-ativo";
export const EVENTO_PREF = "texto-diario-pref";

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
  return `https://wol.jw.org/pt/wol/dt/r5/lp-t/${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/** Extrai o texto do dia: o bloco com h2 + p.themeScrp + .bodyTxt. */
export function extrairTextoDiario(html: string, data: string): TextoDiario | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tema = doc.querySelector("p.themeScrp");
  if (!tema) return null;
  const bloco = tema.parentElement;
  const titulo = bloco?.querySelector("h2")?.textContent?.trim() ?? "";
  const comentario = Array.from(bloco?.querySelectorAll(".bodyTxt p") ?? [])
    .map((p) => p.textContent?.replace(/\s+/g, " ").trim() ?? "")
    .filter(Boolean);
  return { data, titulo, tema: tema.textContent?.replace(/\s+/g, " ").trim() ?? "", comentario };
}

const PREFIXO = "texto-diario:";

export async function obterTextoDiario(
  d: Date,
  baixar: (url: string) => Promise<string>,
): Promise<TextoDiario> {
  const data = chaveDia(d);
  const salvo = localStorage.getItem(PREFIXO + data);
  if (salvo) return JSON.parse(salvo) as TextoDiario;
  const texto = extrairTextoDiario(await baixar(urlDia(d)), data);
  if (!texto) throw new Error("Texto diário não encontrado");
  // Guarda só ~10 dias para não acumular.
  const chaves = Object.keys(localStorage).filter((k) => k.startsWith(PREFIXO)).sort();
  while (chaves.length >= 10) localStorage.removeItem(chaves.shift()!);
  localStorage.setItem(PREFIXO + data, JSON.stringify(texto));
  return texto;
}
