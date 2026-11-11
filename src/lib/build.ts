/** Versão exibida no rodapé da tela inicial e no diálogo de backup.
 *  Serve para confirmar no PWA se a versão instalada é a mais recente
 *  (o Lovable nem sempre publica o último commit do GitHub de imediato).
 *  Atualizar estes valores a cada alteração relevante enviada para o app. */
export const BUILD = {
  versao: "1.3.12",
  data: "11/11/2026",
  resumo:
    "Sem o link “Baixar o vídeo” no começo dos estudos: ele vem do aviso de fallback do player do jw.org, sai já na importação e também some dos estudos salvos antes desta versão. As caixas de Apostila/Sentinela e de mês agora aparecem preenchidas com a cor de destaque e um check na opção escolhida",
};

export const ROTULO_BUILD = `v${BUILD.versao} · ${BUILD.data}`;
