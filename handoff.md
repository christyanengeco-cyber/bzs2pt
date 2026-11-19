# handoff.md — estado em 19/11/2026

## Contexto

Atualização de 19/11/2026: texto diário em português na tela inicial, tema na cor
normal do texto e citações clicáveis abrindo só o versículo citado.

## Verificado

- `tsc --noEmit` limpo; `vitest run` com todos os testes passando.
- Teste com HTML real do wol.jw.org: "Tia. 4:8" resolve para "Tiago 4:8" e mostra
  só o versículo, não o capítulo inteiro.
- Sem `TODO`/`FIXME`/`shortcut:` pendentes em `src/`.
- Lint local só acusa CRLF (checkout Windows); os arquivos do repo são LF.

## Como funciona o texto diário

- `src/lib/texto-diario.ts` busca `https://wol.jw.org/pt/wol/dt/r5/lp-t/AAAA/M/D`
  via server function e guarda no localStorage (`texto-diario2:<data>`, 10 dias).
- Preferência local `texto-diario-ativo` (padrão ligado), editável em Configurações.
- Links do tema/comentário são resolvidos contra `https://wol.jw.org`.
- O link `/bc/...` do wol.jw.org redireciona para a página do capítulo **sem** o
  hash do versículo. Por isso `extrairReferencia` lê o versículo do rótulo do link
  ("Tia. 4:8", "Êxo. 17:2,7") e recorta os spans `v<livro>-<capítulo>-<versículo>-*`.
  Links com `#v=` e `#h=` continuam suportados.

## Aberto

1. `roadmap.md` ainda não tem entrada para o texto diário e as citações clicáveis.
2. O rótulo do link é a fonte do versículo; abreviações fora do padrão
   "Livro cap:versículo" caem no fallback (primeiros 6 parágrafos do artigo).
3. O APK já foi atualizado pelo fluxo do usuário; `build.ts` não foi bumpado nesta
   alteração, então o changelog do rodapé não lista estas correções.

## Próximo passo sugerido

Publicar pelo Lovable e, se for gerar APK novo, subir `versao`/`data`/`mudancas`
em `src/lib/build.ts` (isso dispara o workflow do APK).

## Como conferir

```sh
npm install
npx tsc --noEmit
npm test
npm run dev
```

No site: Configurações > Texto diário, navegar com as setas de dia e tocar em uma
citação.