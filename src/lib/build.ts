/** Versão exibida no rodapé da tela inicial e no diálogo de backup.
 *  Serve para confirmar no PWA se a versão instalada é a mais recente
 *  (o Lovable nem sempre publica o último commit do GitHub de imediato).
 *  Atualizar estes valores a cada alteração relevante enviada para o app.
 *
 *  Esta versão também é a fonte única do APK: o workflow do GitHub Actions lê
 *  `versao` daqui para montar o versionName/versionCode e a startUrl do app
 *  (ver .github/workflows/apk.yml e src/lib/atualizacao.ts). Não duplicar. */
export const BUILD = {
  versao: "1.4.0",
  data: "11/11/2026",
  /** O que mudou nesta versão.
   *
   *  REGRA: este texto NUNCA aparece aberto na tela. Ele fica escondido atrás
   *  do toque em "Versão do app" no rodapé da biblioteca, e só aparece para
   *  quem procura. Não transforme o rodapé em changelog visível: ao publicar
   *  uma versão nova, escreva os itens aqui e deixe o padrão continuar
   *  escondido (index.tsx: rodapé com `aria-expanded` começando em false). */
  mudancas: [
    "Agora existe app Android (APK): dá para instalar no celular e usar igual ao PWA.",
    "A biblioteca avisa sozinha quando sai versão nova, com botão para baixar e instalar por cima.",
    "Configurações ganhou “Verificar atualizações”, que vira botão de download quando há versão nova.",
    "Backup agora tem “Salvar no Drive”, com download normal quando o aparelho não compartilha arquivo.",
    "Antes de atualizar, o app recomenda o backup e já oferece os botões para salvar.",
    "O rodapé mostra só a versão; o que mudou fica atrás de um toque nela.",
    "Quem entra pelo site vê “Baixar app para Android” em Configurações.",
  ],
};

export const ROTULO_BUILD = `v${BUILD.versao} · ${BUILD.data}`;
