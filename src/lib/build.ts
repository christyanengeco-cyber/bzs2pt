/** Versão exibida no rodapé da tela inicial e no diálogo de backup.
 *  Serve para confirmar no PWA se a versão instalada é a mais recente
 *  (o Lovable nem sempre publica o último commit do GitHub de imediato).
 *  Atualizar estes valores a cada alteração relevante enviada para o app. */
export const BUILD = {
  versao: "1.3.3",
  data: "05/11/2026",
  resumo: "Leitor da Sentinela mostra \"Estudo de A Sentinela\" com o intervalo da semana",
};

export const ROTULO_BUILD = `v${BUILD.versao} · ${BUILD.data}`;
