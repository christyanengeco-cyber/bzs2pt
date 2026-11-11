<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- All study data lives client-side in IndexedDB (src/lib/db.ts); no backend — the app must work offline per user.
- jw.org import uses the app server fetch first and browser CORS proxies only as fallback, because mobile reliability matters while parsing remains best-effort.
- Direct jw.org fetch uses the empirically verified JW Library request profile; WAF indicators only reject responses without real content, and browser fallback proxies race within one shared deadline to avoid serial stalls.
- Study week comparisons use normalized local ISO date ranges while preserving the original display label, because Portuguese labels vary between publications.
- Backups use a versioned JSON envelope and restore transactionally, because all user data remains local and future formats must stay recoverable.
- Appearance preferences use a shared browser-safe module and semantic CSS tokens, because the library and reader must preserve the same user-selected accent offline.
- Week navigation sorts dated studies chronologically independently of default week selection, because previous weeks belong on the left and upcoming weeks on the right.
- Publication layout metadata is stored with paragraphs and recovered by matching original text while preserving paragraph IDs, because imported studies must gain images and editorial structure without losing notes or timestamps.
- Imported image bytes are stored as data URLs in existing paragraph records when fetch succeeds, because offline reading and versioned JSON backups must include illustrations without a separate storage format.
- Bible citations preserve verse metadata separately from paragraph IDs; the keyed reference player seeks once per citation with readiness retries so later playback is not rewound.
- The player's `noscript` fallback from jw.org ("Baixar o vídeo") is dropped during extraction and filtered again in the reader, because studies imported before the fix must not show it either.
- "Salvar no Drive" must never depend on a Google login: the automatic upload (OAuth) was removed because the test mode requires every account to be pre-registered, so it shares the file or downloads it and links to Drive.
