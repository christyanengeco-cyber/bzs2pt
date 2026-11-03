/** Versão exibida no rodapé da tela inicial e no diálogo de backup.
 *  Serve para confirmar no PWA se a versão instalada é a mais recente
 *  (o Lovable nem sempre publica o último commit do GitHub de imediato).
 *  Atualizar estes valores a cada alteração relevante enviada para o app. */
export const BUILD = {
  versao: "1.1.0",
  data: "04/11/2026",
  resumo: "Vídeo da apostila no painel de referência e fim da replicação da própria apostila",
};

export const ROTULO_BUILD = `v${BUILD.versao} · ${BUILD.data}`;
