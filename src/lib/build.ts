/** Versão exibida no rodapé da tela inicial e no diálogo de backup.
 *  Serve para confirmar no PWA se a versão instalada é a mais recente
 *  (o Lovable nem sempre publica o último commit do GitHub de imediato).
 *  Atualizar estes valores a cada alteração relevante enviada para o app. */
export const BUILD = {
  versao: "1.3.8",
  data: "05/11/2026",
  resumo:
    "Leitor ajustado ao retorno do import: player assume a proporção real do vídeo (sem faixas pretas de letterbox) e todo o espaçamento do texto acompanha a escala escolhida; figuras passam a preferir a variante de zoom do jw.org",
};

export const ROTULO_BUILD = `v${BUILD.versao} · ${BUILD.data}`;
