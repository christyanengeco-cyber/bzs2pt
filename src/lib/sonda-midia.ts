/** Sonda leve de existência de mídia no CDN do jw.org. Usada pela recuperação de
 *  qualidade dos estudos salvos: a troca do vídeo de um estudo só acontece com
 *  confirmação positiva do CDN (DIRETRIZES nº 5) — sem sonda, trocaríamos por um
 *  endereço que pode não existir e o estudo ficaria sem vídeo nenhum, o erro mais
 *  caro da assimetria. Vive em módulo próprio para não arrastar a runtime do
 *  createServerFn para onde só a lógica importa (e para os testes a rodarem direto). */

const AGENTE_MOVEL =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36";
const CABECALHOS: Record<string, string> = {
  "User-Agent": AGENTE_MOVEL,
  Accept: "video/mp4,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
};
const PRAZO_SONDA = 10000;

/** Prazo com folga para navegadores antigos: AbortSignal.timeout não existe no
 *  Safari anterior ao 16 — sem a guarda, um iPhone velho quebraria a sonda. */
const sinal = (ms: number) =>
  typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(ms) : undefined;

export interface SondaMidia {
  ok: boolean;
  status?: number;
  inconclusivo?: boolean;
  motivo?: string;
}

/** HEAD primeiro (barato, sem corpo); se o método for recusado pelo CDN
 *  (403/405/501), um GET de faixa de 2 bytes. 404 é conclusão do CDN — a
 *  variante não existe. Erro de rede nas duas sondas é inconclusivo: quem chama
 *  fica com o vídeo atual em vez de trocar por um endereço não verificado
 *  (DIRETRIZES nº 6, falhar aberto). */
export async function sondarMidia(url: string): Promise<SondaMidia> {
  const sondas: RequestInit[] = [
    { method: "HEAD", headers: CABECALHOS, signal: sinal(PRAZO_SONDA) },
    {
      method: "GET",
      headers: { ...CABECALHOS, Range: "bytes=0-1" },
      signal: sinal(PRAZO_SONDA),
    },
  ];
  let ultimoErro = "";
  for (const opcoes of sondas) {
    try {
      const r = await fetch(url, opcoes);
      if (r.status >= 200 && r.status < 300) return { ok: true, status: r.status };
      if (r.status === 404) return { ok: false, status: r.status };
      ultimoErro = `HTTP ${r.status} no ${opcoes.method}`;
    } catch (e) {
      ultimoErro = e instanceof Error ? e.message : String(e);
    }
  }
  return { ok: false, inconclusivo: true, motivo: ultimoErro };
}
