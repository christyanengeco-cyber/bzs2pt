/** Sinal positivo de conteúdo real do jw.org (DIRETRIZES nº 5 e 7).
 *
 * Uma página boa do jw.org — artigo de revista, lição da apostila, matéria
 * curta, página de referência — sempre traz pelo menos um destes elementos.
 * Tamanho NÃO é critério: artigos curtos e páginas de referência têm menos
 * de 20 KB, e a checagem antiga de tamanho os descartava como "bloqueio"
 * (falso positivo — o erro mais caro da assimetria). Marcadores de "ruim"
 * (desafio de WAF) só rejeitam na ausência deste sinal, nunca o contrário.
 *
 * Módulo puro, compartilhado pelo servidor (fetch-page) e pelo parser,
 * para que uma revisão futura (quando o site mudar) aconteça num só lugar. */
export const CONTEUDO_RE =
  /<article|class="bodyTxt"|class="docSubContent"|<main|data-docid|mediaItems/i;
