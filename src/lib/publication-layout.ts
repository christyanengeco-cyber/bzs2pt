import type { Paragrafo } from "./db";

export type Secao = "tesouros" | "ministerio" | "vida";
export function identificarSecao(texto: string): Secao | undefined {
  if (/TESOUROS DA PALAVRA/i.test(texto)) return "tesouros";
  if (/FA[ÇC]A SEU MELHOR/i.test(texto)) return "ministerio";
  if (/NOSSA VIDA CRIST/i.test(texto)) return "vida";
  return undefined;
}

export function elementosPublicacao(doc: Document) {
  const root =
    doc.querySelector(".slContentText, .bodyTxt")?.closest("article") ??
    doc.querySelector("article, #article, .docSubContent, main") ??
    doc.body;
  return Array.from(
    root.querySelectorAll(
      "h1[data-pid], h2, h3, p, figure .jsRespImg, figure img, figure figcaption",
    ),
  ).filter(
    (el) =>
      !el.closest("nav, footer, .footnote, .jsRelatedPubs, .noJShide, .relatedImage") &&
      !(el.tagName === "IMG" && el.closest(".jsRespImg")),
  );
}

export function imagemDoElemento(el: Element, url: string) {
  // O zoom (lightbox do jw.org) é a maior variante que a página lista — calibrado
  // na prática contra a apostila real: para a figura de conteúdo o zoom é o
  // próprio xl (1200px, mesmos bytes do lg); o lg fica de reserva e o md só
  // entra se a página não listar nada maior. O src (fallback do noscript,
  // 240px) é a última opção — nunca a primeira.
  const src =
    el.getAttribute("data-zoom") ||
    el.getAttribute("data-img-size-lg") ||
    el.getAttribute("data-img-size-md") ||
    el.getAttribute("data-src") ||
    el.getAttribute("src");
  if (!src || src.startsWith("data:")) return undefined;
  try {
    return new URL(src, url).href;
  } catch {
    return undefined;
  }
}

export function estruturaDoElemento(
  el: Element,
): Pick<Paragrafo, "estilo" | "faixa" | "resposta" | "meps_id"> {
  const texto = el.textContent?.replace(/\s+/g, " ").trim() ?? "";
  return {
    meps_id: el.getAttribute("data-pid") ?? undefined,
    estilo: identificarSecao(texto)
      ? "secao"
      : el.tagName === "H1"
        ? "semana"
        : el.tagName === "H2"
          ? "subtitulo"
          : el.tagName === "H3"
            ? /Cântico|Comentários finais/i.test(texto)
              ? "cantico"
              : "titulo"
            : el.tagName === "FIGCAPTION"
              ? "legenda"
              : "corpo",
    faixa: Boolean(el.closest(".du-bgColor--bgSecondary")),
    resposta: Boolean(el.nextElementSibling?.matches(".gen-field")),
  };
}

/** Keep original IDs and notes when recovering the layout of an old import. */
export function mesclarEstrutura(antigos: Paragrafo[], novos: Paragrafo[], pubId: string) {
  const usados = new Set<string>();
  return novos
    .map((novo, i) => {
      const antigo = antigos.find(
        (p) =>
          !usados.has(p.id) &&
          (novo.imagem ? p.imagem === novo.imagem : p.texto_portugues === novo.texto_portugues),
      );
      if (antigo) usados.add(antigo.id);
      return antigo
        ? {
            ...antigo,
            estilo: novo.estilo,
            faixa: novo.faixa,
            resposta: novo.resposta,
            meps_id: novo.meps_id,
            numero_ordem: i,
          }
        : { ...novo, publicacao_id: pubId, numero_ordem: i };
    })
    .concat(
      antigos
        .filter((p) => !usados.has(p.id) && p.texto_portugues)
        .map((p, i) => ({ ...p, numero_ordem: novos.length + i })),
    );
}

export async function guardarImagem(url: string): Promise<string> {
  try {
    const resposta = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resposta.ok) return url;
    const blob = await resposta.blob();
    if (!blob.type.startsWith("image/")) return url;
    return await new Promise<string>((resolve) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(typeof leitor.result === "string" ? leitor.result : url);
      leitor.onerror = () => resolve(url);
      leitor.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}
