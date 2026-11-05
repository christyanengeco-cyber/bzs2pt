/** Versão exibida no rodapé da tela inicial e no diálogo de backup.
 *  Serve para confirmar no PWA se a versão instalada é a mais recente
 *  (o Lovable nem sempre publica o último commit do GitHub de imediato).
 *  Atualizar estes valores a cada alteração relevante enviada para o app. */
export const BUILD = {
  versao: "1.3.10",
  data: "05/11/2026",
  resumo:
    "Recuperação automática dos estudos já salvos: ao abrir um estudo que ficou no _r240P.mp4/_r360P.mp4 da versão antiga, o leitor confirma a variante em 720p no CDN e atualiza o estudo sozinho — sem precisar apagar e importar tudo de novo; sem confirmação, o estudo segue no vídeo atual",
};

export const ROTULO_BUILD = `v${BUILD.versao} · ${BUILD.data}`;
