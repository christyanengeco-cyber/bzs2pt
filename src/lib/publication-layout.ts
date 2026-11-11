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

/** Estilos que o jw.org marca por classe/contexto, e não por tag. A ordem importa:
 *  o rótulo mais específico vence (uma seção não vira quadro, um quadro não vira corpo). */
function classificarEstilo(el: Element, texto: string): Paragrafo["estilo"] {
  if (identificarSecao(texto)) return "secao";
  if (el.closest(".contextTtl")) return "dataEstudo";
  if (el.closest(".boxSupplement, .blockTeach")) {
    if (/COMO VOC[ÊE] RESPONDERIA/i.test(texto)) return "revisao";
    if (el.closest(".boxTtl")) return "titulo";
    return "corpo";
  }
  if (el.closest(".pubRefs")) {
    if (/^OBJETIVO$/i.test(texto)) return "objetivo";
    // Na Sentinela o cântico abre em `p.pubRefs` ("CÂNTICO 36 Proteja o Coração");
    // na apostila ele já vem em `h3`.
    if (/C[ÂA]NTICO\s*\d/i.test(texto)) return "cantico";
  }
  if (/^PARA MEDITAR/i.test(texto)) return "meditar";
  if (/^Saiba mais on-line/i.test(texto)) return "saibaMais";
  if (/^\(\d+\s*min\)$/i.test(texto)) return "duracao";
  // O rodapé da imagem chega com o símbolo da nota antes do rótulo ("a DESCRIÇÃO
  // DA IMAGEM:"), por isso a busca não é ancorada no início.
  if (/DESCRI[ÇC][ÃA]O DA IMAGEM/i.test(texto)) return "descricaoImagem";
  if (el.tagName === "H1") return "semana";
  if (el.tagName === "H2") return "subtitulo";
  if (el.tagName === "H3") return /Cântico|Comentários finais/i.test(texto) ? "cantico" : "titulo";
  if (el.tagName === "FIGCAPTION") return "legenda";
  return "corpo";
}

/** Identidade estável do quadro que contém o elemento, usada para agrupar os
 *  parágrafos dele no leitor. Cai para o `id`/início do texto quando o quadro
 *  não expõe `data-pid` (nem todo `.boxSupplement` expõe). */
function idDoBloco(quadro: Element): string {
  const pid = quadro.querySelector("[data-pid]")?.getAttribute("data-pid");
  if (pid) return pid;
  if (quadro.id) return quadro.id;
  return `caixa:${(quadro.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 32)}`;
}

export function estruturaDoElemento(
  el: Element,
): Pick<Paragrafo, "estilo" | "faixa" | "resposta" | "meps_id" | "bloco"> {
  const texto = el.textContent?.replace(/\s+/g, " ").trim() ?? "";
  const quadro = el.closest(".boxSupplement, .blockTeach");
  return {
    meps_id: el.getAttribute("data-pid") ?? undefined,
    estilo: classificarEstilo(el, texto),
    faixa: Boolean(el.closest(".du-bgColor--bgSecondary")),
    resposta: Boolean(el.nextElementSibling?.matches(".gen-field")),
    bloco: quadro ? idDoBloco(quadro) : undefined,
  };
}

/** Keep original IDs and notes when recovering the layout of an old import. */
/** O jw.org passou a separar `span.parNum` do texto do parágrafo: o antigo guarda
 *  "9 Pense no seguinte" e o novo "Pense no seguinte". Sem normalizar, o parágrafo
 *  não casa na remesclagem e as anotações caem no fim da lista. */
function semNumero(texto: string): string {
  return texto.replace(/^\d+\s+/, "").trim();
}

export function mesclarEstrutura(antigos: Paragrafo[], novos: Paragrafo[], pubId: string) {
  const usados = new Set<string>();
  return novos
    .map((novo, i) => {
      const antigo = antigos.find(
        (p) =>
          !usados.has(p.id) &&
          (novo.imagem
            ? p.imagem === novo.imagem
            : semNumero(p.texto_portugues) === semNumero(novo.texto_portugues)),
      );
      if (antigo) usados.add(antigo.id);
      return antigo
        ? {
            ...antigo,
            estilo: novo.estilo,
            faixa: novo.faixa,
            resposta: novo.resposta,
            meps_id: novo.meps_id,
            numero_paragrafo: novo.numero_paragrafo,
            bloco: novo.bloco,
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
