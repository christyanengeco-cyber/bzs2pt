# init.md — orientação do projeto

App de estudo em Libras/português inspirado no JW Library: importa a apostila/Sentinela
do jw.org, sincroniza o texto com o vídeo em Libras e guarda tudo offline no aparelho.

- **Site publicado:** https://bzs2pt.lovable.app
- **Repo:** https://github.com/christyanengeco-cyber/bzs2pt
- **Editor Lovable:** projeto `6db17a5a-1270-4a90-b6ed-112cd36603fe`
- **Atenção (Lovable):** não reescrever histórico já publicado (force push, rebase,
  amend ou squash de commits antigos). Commits na `main` sincronizam de volta no editor.

## Stack

React 19 + TanStack Start/Router, Vite 8, Tailwind 4, shadcn/Radix, TypeScript estrito
(`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), IndexedDB via `idb`,
Vitest + Testing Library. Sem backend de dados: o servidor só existe para buscar
páginas do jw.org (server functions).

## Comandos

```sh
npm install
npm run dev       # Vite dev
npm run build     # build de produção
npm test          # Vitest (src/test)
npm run lint
```

Node 22+ recomendado. O projeto usa `bun.lock`; não versionar `package-lock.json`.

## Estrutura

- `src/routes/index.tsx` — biblioteca/home: estudos, texto diário, configurações.
- `src/routes/estudo.$id.tsx` — leitor do estudo, vídeo, destaques e notas.
- `src/lib/db.ts` — modelo IndexedDB (`Publicacao`, `Paragrafo`, ...).
- `src/lib/parser.ts` — importação e extração do HTML do jw.org.
- `src/lib/fetch-page.functions.ts` — server function que busca páginas do jw.org.
- `src/lib/texto-diario.ts` — texto diário do wol.jw.org + cache local (10 dias).
- `src/lib/build.ts` — **fonte única da versão** exibida no rodapé e no APK.
- `src/lib/atualizacao.ts` — comparação de versões e GitHub Releases.
- `src/components/` — UI (TextoDiarioCard, ThemeToggle, Backup, player, etc.).
- `src/test/` — testes Vitest.
- `docs/` — notas de APK e da UI de referência.
- `DIRETRIZES.md` — regras de mudança em fluxo que já funciona (ler antes de mexer).

## Regras que não podem quebrar

- Dados de estudo ficam **só no IndexedDB** do usuário; o app precisa funcionar offline.
- Importação usa fetch direto no servidor primeiro; proxies CORS do navegador só como
  contingência, com prazo único compartilhado.
- Detecção de bloqueio do jw.org é **positiva** (só recusa sem conteúdo real). Não
  voltar a regex negativa que rejeita página boa.
- Backup é JSON versionado e restauração é transacional.
- "Salvar no Drive" não existe mais; backup é download/escolha de pasta.
- Citações bíblicas mantêm metadados de versículo separados dos IDs de parágrafo.
- Preferências de aparência usam módulo compartilhado e tokens CSS semânticos.
- Texto diário: preferência local `texto-diario-ativo` (padrão ligado); cache
  `texto-diario2:<AAAA-MM-DD>`; links internos resolvidos contra `https://wol.jw.org`.

## Versão e publicação

`src/lib/build.ts` (`versao`, `data`, `mudancas`) é a fonte única. O workflow
`.github/workflows/apk.yml` dispara quando esse arquivo muda na `main`, gera o APK
assinado e publica no GitHub Releases (`vX.Y.Z`). O site é publicado pelo Lovable;
o rodapé do app mostra `ROTULO_BUILD` e o changelog fica escondido atrás da versão.
Ao publicar mudança relevante: subir versão, data e itens de `mudancas`.