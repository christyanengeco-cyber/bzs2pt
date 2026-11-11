# APK Android

O app Android é um **TWA** (Trusted Web Activity): um invólucro do Chrome sobre
`https://bzs2pt.lovable.app`. Nada do código web muda. O servidor continua
existindo, então o import do jw.org segue funcionando como no site.

Distribuição: **APK no GitHub Releases**, sem Play Store. O app avisa sozinho
quando sai versão nova e instala por cima.

---

## Regras que não podem ser quebradas

1. **Mesmo keystore para sempre.** Android só aceita instalar por cima se a
   assinatura for idêntica. Assinatura diferente = `App not installed`.
2. **`applicationId` fixo:** `br.com.estudoemlibras.app`.
3. **`versionCode` sempre crescente.** O workflow calcula
   `major*10000 + minor*100 + patch` a partir de `versao` em
   `src/lib/build.ts`. Nunca publique a mesma versão duas vezes.
4. **Nunca orientar o usuário a desinstalar.** Desinstalar apaga o IndexedDB e
   leva os estudos, notas e marcações junto.

Perdeu o keystore? Todo mundo precisa desinstalar e perder os dados. Guarde o
`.jks` e as senhas fora da máquina, em pelo menos dois lugares.

### Se o keystore for perdido

Não existe recuperação automática. O caminho manual, usuário por usuário:

1. Exportar o backup JSON em “Backup e restauração”, salvando fora do app
   (“Salvar no Drive” ou “Salvar no aparelho”).
2. Desinstalar o app antigo (apaga o IndexedDB).
3. Instalar o APK assinado com a chave nova.
4. Importar o backup JSON.

Quem desinstalar **sem** exportar antes perde os estudos. Por isso o keystore
nunca fica só no celular: formatar o aparelho apaga a chave, e aí nenhum build
futuro atualiza o app de ninguém.

---

## Preparar uma vez

### 1. Criar o keystore

```sh
keytool -genkeypair -v \
  -keystore release.jks \
  -alias estudo \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass SENHA_FORTE -keypass SENHA_FORTE \
  -dname "CN=Estudo em Libras, O=Estudo em Libras, C=BR"
```

Guarde `release.jks` e `SENHA_FORTE`. Sem eles não existe atualização futura.

### 2. Subir como segredo no GitHub

Estado atual: **já feito**. O keystore existe em
`C:\Users\Usuario\Documents\estudo-em-libras-apk\release.jks`, a senha em
`SENHA.txt` na mesma pasta, e os quatro segredos já estão gravados no repositório.
Mova a senha para o gerenciador de senhas e apague o `SENHA.txt` do disco.

Se precisar refazer, o procedimento é:

```sh
# base64 de uma linha só
base64 -w0 release.jks > release.jks.b64   # macOS: base64 -i release.jks -o release.jks.b64
```

Em **Settings → Secrets and variables → Actions**, criar:

| Segredo | Valor |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | conteúdo de `release.jks.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | senha do keystore |
| `ANDROID_KEY_ALIAS` | `estudo` |
| `ANDROID_KEY_PASSWORD` | senha da chave |

Depois apague o `release.jks.b64` do disco.

---

## Publicar uma versão

1. Subir `versao` e `data` em `src/lib/build.ts`.
2. Escrever em `mudancas` o que mudou (aparece escondido no rodapé e nas notas
   do release).
3. Commit e push na `main`.

O workflow `APK Android` faz o resto: builda, assina, publica em
`releases/tag/v<versao>` e commita o `assetlinks.json` com a digital correta.

O APK fica sempre no mesmo link:

```
https://github.com/christyanengeco-cyber/bzs2pt/releases/latest/download/estudo-em-libras.apk
```

Esse link está em `URL_APK` (`src/lib/atualizacao.ts`). Não é para mudar.

---

## Como o aviso de atualização funciona

A página não tem como ler o `versionCode` do Android. Então o APK é gerado com a
própria versão na startUrl:

```
https://bzs2pt.lovable.app/?v=1.4.0
```

`versaoApkInstalada()` lê o `?v=` e guarda em `sessionStorage` (o router limpa a
query ao navegar). `haAtualizacao()` compara com `BUILD.versao`, que é sempre a
versão publicada no site. Versão do site maior que a do APK = aviso aparece.

Consequência: **bumpar `BUILD.versao` é o que dispara o aviso**. Se a versão do
site não subir, ninguém é avisado.

---

## Limites conhecidos

- **Não existe atualização silenciosa** fora da Play Store. Android exige dois
  toques: baixar e confirmar o instalador.
- **O APK precisa de internet na primeira abertura**, como qualquer TWA.
- **`assetlinks.json` errado** faz o app abrir com barra de endereço do Chrome.
  Sintoma clássico. Conferir com:
  `https://bzs2pt.lovable.app/.well-known/assetlinks.json`.
  Já preenchido com a digital do keystore atual —
  `A0:B6:E5:...:4A:AD:D6`. Só muda se o keystore mudar.
- **Não use `keytool` para tirar a digital neste computador.** O keytool do JDK 8
  instalado imprime `SHA256: SHA256withRSA` no lugar do hash. O workflow usa
  `apksigner` justamente por isso.
- **Primeira instalação troca a origem** (navegador → app). O IndexedDB do
  navegador não migra: exportar backup no site e importar no APK. Depois disso,
  toda atualização preserva os dados.

---

## Testar localmente (opcional)

Precisa de JDK 17 e Android SDK:

```sh
cd android
gradle assembleDebug      # APK sem assinatura, para instalar por cabo
```

Sem `ANDROID_KEYSTORE_PATH` no ambiente, o build de release sai sem assinatura.
