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
- jw.org import runs in the browser through public CORS proxies (src/lib/parser.ts); parsing is best-effort, so the reader offers manual video URL and per-paragraph timestamp sync.
