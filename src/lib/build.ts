/** Versão exibida no rodapé da tela inicial e no diálogo de backup.
 *  Serve para confirmar no PWA se a versão instalada é a mais recente
 *  (o Lovable nem sempre publica o último commit do GitHub de imediato).
 *  Atualizar estes valores a cada alteração relevante enviada para o app. */
export const BUILD = {
  versao: "1.3.4",
  data: "05/11/2026",
  resumo: "Acessibilidade: rótulos únicos por parágrafo e navegação por cabeçalhos",
};

export const ROTULO_BUILD = `v${BUILD.versao} · ${BUILD.data}`;
