import { getPublicacao, atualizarPublicacao, type Publicacao } from "./db";
import { verificarMidia } from "./fetch-page.functions";

/** Estudos importados pela versão antiga do parser ficaram no _r240P.mp4 ou no
 *  _r360P.mp4: o seletor /720p/ (minúsculo) não casava com o sufixo real do CDN
 *  do jw.org (_r720P.mp4, com P maiúsculo) e a escolha caía no primeiro arquivo
 *  da lista. A detecção cobre os dois sufixos, com ou sem o prefixo "r". */
export const QUALIDADE_BAIXA_RE = /r?(240|360)[pP]\.mp4(?=$|\?)/;

/** Reescreve o sufixo de qualidade de um MP4 do jw.org mantendo o formato do
 *  próprio arquivo: _r240P.mp4 → _r720P.mp4 (com o "r") e aula_240p.mp4 →
 *  aula_720P.mp4 (sem). Sobrevive a ?query no fim do endereço. */
export function reescreverQualidade(url: string, alvo: string): string {
  return url.replace(/(r?)(\d{3,4})[pP]\.mp4(?=$|\?)/i, `$1${alvo}.mp4`);
}

/** Variantes candidatas para a recuperação, da melhor para a pior. 720P é o alvo
 *  do relato (expressão facial e mãos nítidas em Libras); 480P cobre o vídeo que
 *  só oferece a variante baixa. Não entra 1080P: 4× os dados para ganho pequeno
 *  na tela do celular. */
export function candidatosDeRecuperacao(url: string): string[] {
  return [
    ...new Set(["720P", "480P"].map((a) => reescreverQualidade(url, a)).filter((u) => u !== url)),
  ];
}

/** Auto-recuperação dos estudos já salvos: ao abrir um estudo cujo vídeo aponta
 *  para 240p/360p, confirma a variante melhor no CDN e grava o novo endereço no
 *  banco — sem precisar apagar e importar tudo de novo. Sem confirmação
 *  conclusiva, o estudo fica no vídeo atual: o erro barato é seguir um tempo em
 *  240p, não trocar por um endereço que pode não existir (DIRETRIZES nº 6).
 *  Devolve o novo URL quando houve recuperação. */
export async function recuperarVideoSalvo(pub: Publicacao): Promise<string | undefined> {
  const url = pub.video_url;
  if (!url || !QUALIDADE_BAIXA_RE.test(url)) return undefined;
  // Lê o registro de novo: a reimportação que roda ao abrir o estudo pode ter
  // gravado uma versão nova enquanto esta recuperação começava — e nunca é
  // correto gravar por cima do banco a partir de um snapshot antigo.
  const atual = (await getPublicacao(pub.id)) ?? pub;
  if (!atual.video_url || !QUALIDADE_BAIXA_RE.test(atual.video_url)) return undefined;
  for (const candidato of candidatosDeRecuperacao(atual.video_url)) {
    const r = await verificarMidia({ data: { url: candidato } }).catch(() => null);
    if (r?.ok) {
      await atualizarPublicacao({ ...atual, video_url: candidato });
      return candidato;
    }
  }
  return undefined;
}
