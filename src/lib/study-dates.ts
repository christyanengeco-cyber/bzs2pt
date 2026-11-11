import type { Publicacao } from "./db";

const MESES: Record<string, number> = {
  janeiro: 0,
  fevereiro: 1,
  marco: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
};

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isoLocal(ano: number, mes: number, dia: number) {
  const data = new Date(ano, mes, dia, 12);
  if (data.getFullYear() !== ano || data.getMonth() !== mes || data.getDate() !== dia)
    return undefined;
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function extrairIntervaloSemana(texto: string, anoReferencia = new Date().getFullYear()) {
  const limpo = normalizar(texto)
    .replace(/(\d)\s*\.?[º°ª]/g, "$1")
    .replace(/\s+/g, " ");
  const match = limpo.match(
    /(\d{1,2})(?:\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?)?\s*[-–a]\s*(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?/i,
  );
  if (!match) {
    const unico = limpo.match(/^(?:semana de\s+)?(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?$/);
    if (!unico) return null;
    const mes = MESES[unico[2] ?? ""];
    const ano = unico[3] ? Number(unico[3]) : anoReferencia;
    if (mes == null) return null;
    const inicio = isoLocal(ano, mes, Number(unico[1]));
    if (!inicio) return null;
    const fim = new Date(ano, mes, Number(unico[1]) + 6, 12);
    return { inicio, fim: hojeIso(fim) };
  }
  const diaInicio = Number(match[1]);
  const diaFim = Number(match[4]);
  const mesFim = MESES[match[5] ?? ""];
  const mesInicio = match[2] ? MESES[match[2]] : mesFim;
  if (mesInicio == null || mesFim == null) return null;
  // O rótulo pode trazer o ano na abertura ("28 de dezembro de 2026-3 de
  // janeiro de 2027"), no fechamento ou em nenhum dos dois. Sem tratar o ano
  // inicial, a última semana de dezembro da apostila ficava sem intervalo.
  const anoInicioDecl = match[3] ? Number(match[3]) : undefined;
  const anoFimDecl = match[6] ? Number(match[6]) : undefined;
  let anoFim: number;
  let anoInicio: number;
  if (anoInicioDecl != null) {
    anoInicio = anoInicioDecl;
    anoFim = anoFimDecl ?? (mesFim < mesInicio ? anoInicio + 1 : anoInicio);
  } else {
    anoFim = anoFimDecl ?? anoReferencia;
    anoInicio = mesInicio > mesFim ? anoFim - 1 : anoFim;
  }
  const inicio = isoLocal(anoInicio, mesInicio, diaInicio);
  const fim = isoLocal(anoFim, mesFim, diaFim);
  return inicio && fim && inicio <= fim ? { inicio, fim } : null;
}

export function intervaloDaPublicacao(publicacao: Publicacao) {
  const anoUrl = publicacao.url_origem.match(/(?:19|20)\d{2}/)?.[0];
  const interpretado = extrairIntervaloSemana(
    publicacao.semana,
    anoUrl ? Number(anoUrl) : new Date(publicacao.criado_em).getFullYear(),
  );
  if (interpretado) return interpretado;
  if (publicacao.semana_inicio && publicacao.semana_fim) {
    return { inicio: publicacao.semana_inicio, fim: publicacao.semana_fim };
  }
  return null;
}

export function hojeIso(data = new Date()) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

export function ordenarPorSemana(a: Publicacao, b: Publicacao) {
  const ai = intervaloDaPublicacao(a)?.inicio;
  const bi = intervaloDaPublicacao(b)?.inicio;
  if (ai && bi) return bi.localeCompare(ai) || b.criado_em - a.criado_em;
  if (ai) return -1;
  if (bi) return 1;
  return b.criado_em - a.criado_em;
}

export function ordenarSemanasCronologicamente(a: Publicacao, b: Publicacao) {
  const ai = intervaloDaPublicacao(a)?.inicio;
  const bi = intervaloDaPublicacao(b)?.inicio;
  if (ai && bi) return ai.localeCompare(bi) || a.criado_em - b.criado_em;
  if (ai) return -1;
  if (bi) return 1;
  return a.criado_em - b.criado_em;
}

export function escolherSemanaInicial(publicacoes: Publicacao[], hoje = hojeIso()) {
  const datadas = publicacoes
    .map((publicacao) => ({ publicacao, intervalo: intervaloDaPublicacao(publicacao) }))
    .filter(
      (item): item is { publicacao: Publicacao; intervalo: { inicio: string; fim: string } } =>
        Boolean(item.intervalo),
    );
  const atual = datadas.find(({ intervalo }) => intervalo.inicio <= hoje && intervalo.fim >= hoje);
  if (atual) return { id: atual.publicacao.id, atual: true };
  const anterior = datadas
    .filter(({ intervalo }) => intervalo.fim < hoje)
    .sort((a, b) => b.intervalo.fim.localeCompare(a.intervalo.fim))[0];
  const primeira = anterior?.publicacao ?? [...publicacoes].sort(ordenarPorSemana)[0];
  return primeira ? { id: primeira.id, atual: false } : null;
}

const MESES_CURTOS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/** "26 out–1º nov" a partir do intervalo ISO; o ano só entra quando difere do atual. */
export function formatarIntervalo(
  intervalo: { inicio: string; fim: string },
  anoReferencia = new Date().getFullYear(),
): string {
  const [ai, mi, di] = intervalo.inicio.split("-").map(Number);
  const [af, mf, df] = intervalo.fim.split("-").map(Number);
  if (!ai || !mi || !di || !af || !mf || !df) return "";
  const dia = (d: number) => (d === 1 ? "1º" : String(d));
  const ano = af !== anoReferencia ? ` de ${af}` : "";
  if (mi === mf && ai === af) return `${dia(di)}–${df} ${MESES_CURTOS[mf - 1]}${ano}`;
  return `${dia(di)} ${MESES_CURTOS[mi - 1]}–${dia(df)} ${MESES_CURTOS[mf - 1]}${ano}`;
}
