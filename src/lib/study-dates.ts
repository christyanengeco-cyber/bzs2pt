import type { Publicacao } from "./db";

const MESES: Record<string, number> = {
  janeiro: 0, fevereiro: 1, marco: 2, abril: 3, maio: 4, junho: 5,
  julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
};

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function isoLocal(ano: number, mes: number, dia: number) {
  const data = new Date(ano, mes, dia, 12);
  if (data.getFullYear() !== ano || data.getMonth() !== mes || data.getDate() !== dia) return undefined;
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function extrairIntervaloSemana(texto: string, anoReferencia = new Date().getFullYear()) {
  const limpo = normalizar(texto).replace(/\s+/g, " ");
  const match = limpo.match(/(\d{1,2})(?:\s+de\s+([a-z]+))?\s*[-–a]\s*(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?/i);
  if (!match) return null;
  const diaInicio = Number(match[1]);
  const diaFim = Number(match[3]);
  const mesFim = MESES[match[4] ?? ""];
  const mesInicio = match[2] ? MESES[match[2]] : mesFim;
  if (mesInicio == null || mesFim == null) return null;
  const anoFim = match[5] ? Number(match[5]) : anoReferencia;
  const anoInicio = mesInicio > mesFim ? anoFim - 1 : anoFim;
  const inicio = isoLocal(anoInicio, mesInicio, diaInicio);
  const fim = isoLocal(anoFim, mesFim, diaFim);
  return inicio && fim ? { inicio, fim } : null;
}

export function intervaloDaPublicacao(publicacao: Publicacao) {
  if (publicacao.semana_inicio && publicacao.semana_fim) {
    return { inicio: publicacao.semana_inicio, fim: publicacao.semana_fim };
  }
  const anoUrl = publicacao.url_origem.match(/(?:19|20)\d{2}/)?.[0];
  return extrairIntervaloSemana(publicacao.semana, anoUrl ? Number(anoUrl) : new Date(publicacao.criado_em).getFullYear());
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
    .filter((item): item is { publicacao: Publicacao; intervalo: { inicio: string; fim: string } } => Boolean(item.intervalo));
  const atual = datadas.find(({ intervalo }) => intervalo.inicio <= hoje && intervalo.fim >= hoje);
  if (atual) return { id: atual.publicacao.id, atual: true };
  const anterior = datadas
    .filter(({ intervalo }) => intervalo.fim < hoje)
    .sort((a, b) => b.intervalo.fim.localeCompare(a.intervalo.fim))[0];
  const primeira = anterior?.publicacao ?? [...publicacoes].sort(ordenarPorSemana)[0];
  return primeira ? { id: primeira.id, atual: false } : null;
}