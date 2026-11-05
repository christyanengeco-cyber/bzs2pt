/** Versão exibida no rodapé da tela inicial e no diálogo de backup.
 *  Serve para confirmar no PWA se a versão instalada é a mais recente
 *  (o Lovable nem sempre publica o último commit do GitHub de imediato).
 *  Atualizar estes valores a cada alteração relevante enviada para o app. */
export const BUILD = {
  versao: "1.3.9",
  data: "05/11/2026",
  resumo:
    "Vídeo volta para alta definição: o jw.org grava o sufixo com P maiúsculo (_r720P.mp4) e o seletor antigo, em minúsculo, nunca casava — todo estudo ficava no _r240P.mp4 (426×240), que borra a expressão facial em Libras; agora a busca aceita 1080p, 720p e 480p sem distinguir maiúsculas",
};

export const ROTULO_BUILD = `v${BUILD.versao} · ${BUILD.data}`;
