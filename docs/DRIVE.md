# Salvar backup no Google Drive

O botão **Salvar no Drive** sobe o arquivo de backup direto para a conta Google
escolhida pelo usuário. Não existe servidor no meio: o `fetch` sai do aparelho e
vai para `www.googleapis.com`.

Para isso funcionar é preciso um **Client ID** de um projeto no Google Cloud.
Ele não é segredo — vai no HTML da página, como o Google exige —, mas identifica
o app na tela de autorização. Enquanto estiver com o valor de exemplo
(`COLE_AQUI.apps.googleusercontent.com`), o app cai no caminho antigo
(compartilhar pelo Android ou baixar o arquivo), sem quebrar nada.

## Como o fluxo funciona

1. Usuário toca em **Salvar no Drive**.
2. O app guarda no `sessionStorage` a marca do pedido e navega para
   `accounts.google.com` com `response_type=token` e `prompt=select_account`.
   É aí que aparece a lista de contas Gmail do aparelho.
3. O Google devolve a página com `#access_token=…&state=…` no fragmento.
   Fragmento não é enviado a servidor nenhum, então o token não cai em log.
4. `src/components/RetornoDrive.tsx` (montado na raiz) lê o fragmento, apaga o
   hash do histórico, confere o `state`, remonta o backup do IndexedDB e envia
   por `multipart/related` para a Drive API v3.
5. O token fica só no `sessionStorage` (morre ao fechar o app) e vale ~1 hora.

Por que fluxo implícito e não código + PKCE: o Google exige `client_secret` para
trocar o código em clientes do tipo "Aplicativo da Web", e não existe lugar
seguro para guardar segredo em um app que roda inteiro no aparelho.

Por que não popup: dentro do TWA o popup abre em outra aba do Chrome e nunca
devolve a resposta para a página. Navegação de página inteira funciona nos dois
lugares (site e APK).

## Criar o Client ID (uma vez, ~10 minutos)

1. **Criar o projeto** — <https://console.cloud.google.com/projectcreate>.
   Nome sugerido: `Estudo em Libras`.
2. **Ativar a Drive API** — APIs e serviços → Biblioteca → *Google Drive API* →
   Ativar.
3. **Tela de consentimento** — APIs e serviços → Tela de consentimento OAuth:
   - Tipo de usuário: **Externo**.
   - Nome do app: `Estudo em Libras`; informe o e-mail de suporte e o do
     desenvolvedor.
   - Escopos: adicionar `https://www.googleapis.com/auth/drive.file`.
   - Usuários de teste: inclua **o Gmail de cada pessoa** que vai salvar no
     Drive (inclusive o seu). Sem isso o Google bloqueia com "acesso negado".
   - Não precisa publicar nem pedir verificação: em modo de teste funciona para
     até 100 contas, com o aviso "app não verificado" (Avançado → Acessar).
4. **Criar a credencial** — APIs e serviços → Credenciais → Criar credenciais →
   ID do cliente OAuth → tipo **Aplicativo da Web**.
   - Origens JavaScript autorizadas:
     `https://bzs2pt.lovable.app` e `http://localhost:5199`
   - URIs de redirecionamento autorizados:
     `https://bzs2pt.lovable.app/` e `http://localhost:5199/`
     (com a barra no final; é a origem + `/`, exatamente como o app monta)
5. Copiar o **Client ID** (termina em `.apps.googleusercontent.com`) e colar em
   `CLIENTE_DRIVE`, em `src/lib/drive.ts`.

O push não publica sozinho: depois de colar o Client ID, é preciso commitar, dar
push e clicar em **Publish** no Lovable para o valor chegar ao site e ao APK.

## Limites conhecidos

- O escopo `drive.file` só dá acesso aos arquivos que o próprio app criou. O
  app nunca enxerga o resto do Drive — e por isso também não consegue sobrescrever
  um backup antigo; cada envio cria um arquivo novo com data e hora no nome.
- Sem internet não há envio. O backup no aparelho continua funcionando.
- Token expirado (1 hora) ou permissão revogada: o app pede para tocar de novo em
  **Salvar no Drive**; não tenta renovar em silêncio.
- Em modo de teste, cada conta nova precisa ser adicionada como usuário de teste
  antes de conseguir autorizar.
