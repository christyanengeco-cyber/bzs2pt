import type { Publicacao } from "./db";
import { hojeIso, intervaloDaPublicacao, ordenarSemanasCronologicamente } from "./study-dates";

export interface SemanaReunioes {
  chave: string;
  estudos: Publicacao[];
  intervalo: { inicio: string; fim: string } | null;
}

/** Sunday-only labels and Monday–Sunday ranges belong to the same meeting week. */
export function agruparReunioes(publicacoes: Publicacao[]): SemanaReunioes[] {
  const grupos = new Map<string, SemanaReunioes>();
  for (const p of [...publicacoes].sort(ordenarSemanasCronologicamente)) {
    const iv = intervaloDaPublicacao(p);
    let intervalo = iv;
    if (iv) {
      const data = new Date(`${iv.inicio}T12:00:00`);
      data.setDate(data.getDate() - (data.getDay() + 6) % 7);
      const inicio = hojeIso(data);
      data.setDate(data.getDate() + 6);
      intervalo = { inicio, fim: hojeIso(data) };
    }
    const chave = intervalo?.inicio ?? `texto:${p.semana.trim().toLocaleLowerCase("pt-BR")}`;
    const grupo = grupos.get(chave);
    if (grupo) grupo.estudos.push(p);
    else grupos.set(chave, { chave, estudos: [p], intervalo });
  }
  return [...grupos.values()];
}