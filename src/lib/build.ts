/** Versão exibida no rodapé da tela inicial e no diálogo de backup.
 *  Serve para confirmar no PWA se a versão instalada é a mais recente
 *  (o Lovable nem sempre publica o último commit do GitHub de imediato).
 *  Atualizar estes valores a cada alteração relevante enviada para o app. */
export const BUILD = {
  versao: "1.3.7",
  data: "05/11/2026",
  resumo:
    "Importação por link de volta ao download direto: timeout de 15s com User-Agent de celular, validação por conteúdo real do jw.org em vez de tamanho, espelho do Google removido",
};

export const ROTULO_BUILD = `v${BUILD.versao} · ${BUILD.data}`;
