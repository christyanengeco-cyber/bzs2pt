import { fetchProxy } from "./parser";
import { extrairIntervaloSemana } from "./study-dates";

/** Publicações com edição mensal ou bimestral na home: apostila (meio de semana)
 *  e Sentinela de estudo (fim de semana). */
export type TipoMes = "apostila" | "sentinela";

export interface EdicaoMes {
  tipo: TipoMes;
  url: string;
  rotulo: string;
}

export interface EstudoMes {
  titulo: string;
  url: string;
  /** Rótulo da semana ("2-8 de novembro"), usado na seleção antes de importar. */
  semana: string;
  inicio: string;
  fim: string;
}

export interface ResultadoMes {
  edicao: EdicaoMes;
  artigos: EstudoMes[];
}

const MESES = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

export const INDICE: Record<TipoMes, string> = {
  apostila: "https://www.jw.org/bzs/biblioteca/jw-apostila-do-mes/",
  sentinela: "https://www.jw.org/bzs/biblioteca/revistas/",
};

const PASTA: Record<TipoMes, string> = {
  apostila: "jw-apostila-do-mes",
  sentinela: "revistas",
};

/** Edições de estudo da Sentinela são publicadas cerca de dois meses antes das
 *  semanas que contêm (nov/2026 traz as semanas de jan/2027). A ordem abaixo tenta
 *  primeiro essa distância; as demais cobrem mudanças de calendário do jw.org. */
const DISTANCIAS_SENTINELA = [-2, -1, -3, -4, 0, 1, 2];

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function limpar(texto: string | null | undefined) {
  return (texto ?? "").replace(/\s+/g, " ").trim();
}

/** Mês pedido mais um deslocamento (0 = este mês, 1 = próximo mês). */
export function mesDeslocado(deslocamento: number, hoje = new Date()) {
  const data = new Date(hoje.getFullYear(), hoje.getMonth() + deslocamento, 1, 12);
  return { ano: data.getFullYear(), mes: data.getMonth() };
}

export function rotuloDoMes(ano: number, mes: number) {
  const nome = MESES[mes] ?? "";
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${ano}`;
}

/** Edições listadas no índice da publicação, com o rótulo visível ("Novembro de
 *  2026", "Novembro-dezembro de 2026"). O índice é a fonte mais estável: o slug
 *  muda de idioma para idioma. */
export function edicoesDoIndice(
  html: string,
  tipo: TipoMes,
  base: string = INDICE[tipo],
): { url: string; rotulo: string }[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const basePath = new URL(base).pathname;
  const vistos = new Map<string, string>();
  doc.querySelectorAll("a[href]").forEach((a) => {
    let u: URL;
    try {
      u = new URL(a.getAttribute("href") ?? "", base);
    } catch {
      return;
    }
    if (!u.pathname.startsWith(`/bzs/biblioteca/${PASTA[tipo]}/`)) return;
    if (u.pathname === basePath) return;
    const resto = u.pathname.slice(`/bzs/biblioteca/${PASTA[tipo]}/`.length);
    if (!resto || resto.split("/").filter(Boolean).length !== 1) return;
    if (tipo === "sentinela" && !/^sentinela-estudo-/.test(resto)) return;
    if (tipo === "apostila" && !/-mwb\/$/.test(u.pathname)) return;
    const rotulo = limpar(a.textContent);
    if (!rotulo) return;
    vistos.set(u.origin + u.pathname, rotulo);
  });
  return Array.from(vistos, ([url, rotulo]) => ({ url, rotulo }));
}

function combina(rotulo: string, alvo: { ano: number; mes: number }) {
  const texto = normalizar(rotulo);
  return texto.includes(MESES[alvo.mes] ?? "") && texto.includes(String(alvo.ano));
}

/** Endereço provável da edição quando o índice não lista meses antigos. A
 *  apostila é bimestral: janeiro-fevereiro, março-abril, maio-junho,
 *  julho-agosto, setembro-outubro, novembro-dezembro. */
function slugProvavel(tipo: TipoMes, ano: number, mes: number) {
  if (tipo === "sentinela") {
    return `${INDICE.sentinela}sentinela-estudo-${MESES[mes]}-${ano}/`;
  }
  const base = Math.floor(mes / 2) * 2;
  return `${INDICE.apostila}${MESES[base]}-${MESES[base + 1]}-${ano}-mwb/`;
}

/** Candidatos na ordem em que devem ser testados. O primeiro que trouxer semanas
 *  do mês pedido vence; a validação é sempre pelas datas das semanas, nunca pelo
 *  rótulo da edição. */
export function candidatosDeEdicao(
  edicoes: { url: string; rotulo: string }[],
  tipo: TipoMes,
  ano: number,
  mes: number,
): EdicaoMes[] {
  const out: EdicaoMes[] = [];
  const adicionar = (url: string, rotulo: string) => {
    if (!out.some((e) => e.url === url)) out.push({ tipo, url, rotulo });
  };
  const distancias = tipo === "sentinela" ? DISTANCIAS_SENTINELA : [0];
  for (const distancia of distancias) {
    const alvo = new Date(ano, mes + distancia, 1, 12);
    for (const edicao of edicoes)
      if (combina(edicao.rotulo, { ano: alvo.getFullYear(), mes: alvo.getMonth() }))
        adicionar(edicao.url, edicao.rotulo);
  }
  for (const edicao of edicoes) adicionar(edicao.url, edicao.rotulo);
  // Fallback por slug: útil quando o índice não lista meses antigos. Na Sentinela
  // o deslocamento de dois meses também vale aqui, porque a edição não traz o mês
  // das próprias semanas.
  const deslocamentosSlug = tipo === "sentinela" ? [-2, -1, -3, -4] : [0];
  for (const deslocamento of deslocamentosSlug) {
    const alvo = new Date(ano, mes + deslocamento, 1, 12);
    adicionar(
      slugProvavel(tipo, alvo.getFullYear(), alvo.getMonth()),
      rotuloDoMes(alvo.getFullYear(), alvo.getMonth()),
    );
  }
  adicionar(slugProvavel(tipo, ano, mes), rotuloDoMes(ano, mes));
  return out;
}

/** Semanas e artigos de estudo da edição que começam no mês pedido.
 *  - Apostila: cada semana é uma página; "Referências para a Apostila" fica de fora
 *    porque o rótulo não tem data.
 *  - Sentinela: só entram artigos com a data da semana (`p.contextTitle`), o que
 *    exclui "Você Sabia?" e "Dica de Estudo". */
export function extrairEstudosDaEdicao(
  html: string,
  urlEdicao: string,
  tipo: TipoMes,
  ano: number,
  mes: number,
): EstudoMes[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const anoUrl = Number(urlEdicao.match(/(?:19|20)\d{2}/)?.[0]) || ano;
  const prefixoMes = `${ano}-${String(mes + 1).padStart(2, "0")}`;
  const artigos: EstudoMes[] = [];
  const vistos = new Set<string>();
  doc.querySelectorAll(".synopsis").forEach((bloco) => {
    const link = bloco.querySelector("h2 a[href]") ?? bloco.querySelector("a[href]");
    const href = link?.getAttribute("href");
    if (!href) return;
    const titulo = limpar(link?.textContent);
    const contexto = limpar(bloco.querySelector(".contextTitle")?.textContent);
    const rotulo = tipo === "sentinela" ? contexto : titulo;
    // Sem data não é estudo da semana (referências, dicas, "Você Sabia?").
    if (!rotulo || !/\d/.test(rotulo)) return;
    const intervalo =
      extrairIntervaloSemana(rotulo, anoUrl) ?? extrairIntervaloSemana(titulo, anoUrl);
    if (!intervalo || !intervalo.inicio.startsWith(prefixoMes)) return;
    let url: string;
    try {
      url = new URL(href, urlEdicao).href;
    } catch {
      return;
    }
    if (vistos.has(url)) return;
    vistos.add(url);
    artigos.push({
      titulo: titulo || rotulo,
      url,
      semana: rotulo,
      inicio: intervalo.inicio,
      fim: intervalo.fim,
    });
  });
  return artigos.sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/** Busca a edição que contém as semanas do mês e devolve as páginas a importar. */
export async function buscarMes(tipo: TipoMes, ano: number, mes: number): Promise<ResultadoMes> {
  const indice = (await fetchProxy(INDICE[tipo])).texto;
  const edicoes = edicoesDoIndice(indice, tipo);
  const candidatos = candidatosDeEdicao(edicoes, tipo, ano, mes);
  const falhas: string[] = [];
  for (const edicao of candidatos.slice(0, 5)) {
    try {
      const html = (await fetchProxy(edicao.url)).texto;
      const artigos = extrairEstudosDaEdicao(html, edicao.url, tipo, ano, mes);
      if (artigos.length) return { edicao, artigos };
    } catch {
      falhas.push(edicao.rotulo);
    }
  }
  throw new Error(
    `Não encontramos os estudos de ${rotuloDoMes(ano, mes)} no jw.org.` +
      (falhas.length ? " Tente o link manual." : ""),
  );
}
