# Crate — vinyl shopping list from playlist exports

Single-file web app (`index.html` — everything inline: CSS, JS, no build step, no dependencies, no backend). The user drops in a music-service export; the app rolls tracks up into unique albums, finds vinyl pressings on Discogs with live marketplace prices, and gives buy links. Two views: card grid and an iTunes-style Cover Flow (CSS 3D).

Built by Kaan with Claude (Cowork), August 2026. UK-based user; default currency GBP.

## Architecture (all in index.html's single <script>)

- **Ingest** — `ingest(text)` sniffs the input: Apple plist XML → `itemsFromPlist`; delimited text → `parseDelimited` + `itemsFromRows`; else plain "Artist - Album" lines → `itemsFromLines`. `detectFormat(H)` matches header signatures because Apple ships ≥6 export shapes with inconsistent column names (see "Format notes"). Every reader emits `{artist, album, song, plays, year}` items; `mergeItems` folds them into `ALBUMS` keyed by `norm(artist)|norm(album)`.
- **Pending albums** — play-history exports often name the song but not the album (modern Play Activity has NO artist column at all). Those get key `?|artist|song` and `pending:true`; `enrich()` resolves them against the iTunes Search API, then `rekey()` re-keys/merges. `enrich()` also fetches cover art for everyone.
- **Pricing** — `fetchVinyl()`: Discogs search (format=Vinyl, artist+release_title), fallback loose search, then `scoreRelease()` ranks pressings and the top ≤3 get marketplace/stats price checks; cheapest in-stock wins, early-stop below the CHEAP threshold (~£25). This deliberately prefers an in-print reissue over a pricey collector's original.
- **Throttling** — `makeQueue(gapMs)` promise chains. CRITICAL: `dg()` routes every individual Discogs REQUEST through `discQ` (25/min anonymous, 60/min with user token). Do not re-introduce per-album pacing — an album makes up to 5 requests. iTunes goes through `artQ` (1.4s gap) with `ART_BUDGET` (400) and a 90s backoff on 403/429 (`ART_PAUSE_UNTIL`).
- **Views** — `render()` dispatches to `renderGrid()` / `renderFlow()` on `VIEW`. Cover Flow: `FLIST`/`FCUR`, transforms in `updateFlow()` (responsive: `compact` when stage < 560px). `paint(a)` updates one album in whichever view is live.

## Invariants — do not break

- A `pending` album must ALWAYS eventually settle: every exit path of `enrich()` goes through `settle()` (clears `pending`, decrements `PENDING_LEFT`). Regression test: `tests/resilience.test.mjs` (403 storm).
- Never price an album with an empty `album` (`fetchVinyl` guards; `runPrices` filters) — an empty `release_title` makes Discogs return the artist's whole discography and prices a random record.
- Everything user- or API-supplied that reaches `innerHTML` goes through `esc()`. `data-k` keys are `norm()`-restricted.
- Currency select and token input are disabled while a price run is `RUNNING` (mid-run changes corrupt results).
- `scoreRelease()` penalties (singles/7" −80, box sets −60, picture discs −40) exist because a wildly popular 7" of a title track can out-`have` the LP. Title/artist bonuses are skipped when `norm()` returns "" (non-Latin titles) — `"".includes` is true for everything.
- CSV export: keep the `﻿` BOM (Excel/UTF-8), the formula-injection prefix (`'` before leading `=+-@`), CRLF line endings.
- Scripts detect Apple's desktop playlist export by BOM: UTF-16LE + CR-only line endings (`readFiles` decodes by BOM sniff).

## Format notes (hard-won, verified against real files)

- Apple privacy-download "Play Activity.csv" (modern): 118 columns, track artist column DOES NOT EXIST; only `Container Artist Name` (filled only when playing from an album). Filter to `Event Type == PLAY_END` or plays double-count; drop `FAILED_TO_LOAD`; count a play at ≥30s or ≥50% duration.
- "Recently Played Tracks.csv": header typo `Last End Reason Tyoe` is genuinely in Apple's file. `Track Description` = "Artist - Song" combined string (split on first " - ").
- "Play History Daily Tracks.csv" is the best file: small, pre-aggregated `Play Count`/`Skip Count`.
- Legacy (~2019) Play Activity: 31 columns, `Content Name`/`Artist Name` instead.
- Library Tracks uses `Title`/`Artist`/`Album`; Play Activity uses `Song Name`/`Album Name`. Same archive, different names — that's why `detectFormat` exists.
- Exportify: `Artist Name(s)`, `Album Name`. Soundiiz: lowercase `title,artist,album`. TuneMyMusic: `Track name,Artist name,Album`.

## Testing

`npm install` then `npm test` (or individual `npm run test:*`). Tests are plain node scripts (no framework) driving Playwright; external APIs are mocked via `page.route` with fixtures in `tests/fixtures/` (real captured Discogs/iTunes responses in `fixtures/discogs/`, synthesized Apple exports in `fixtures/apple/` matching the verified real schemas). Set `CHROMIUM_PATH` to use a specific browser binary. Screenshots land in `tests/out/`.

When changing parsing or state logic, run `test:formats` and `test:resilience` first — they catch the classes of bug that have actually occurred.

## Known limitations / roadmap (biggest value first)

1. "N pressings" uses Discogs `pagination.items` from a fuzzy search — overstates for generic titles ("Greatest Hits"). The "not on vinyl" verdict only inspects the first 50 all-format results.
2. Grid/Cover Flow render every album eagerly — fine to ~500 albums, janky at 2,000+ (full library imports). Needs windowing/virtualization and incremental rendering.
3. No persistence: wishlist/owned marks and prices die with the tab (artifact context has no localStorage). Options: export/import a JSON snapshot, or "copy state as URL hash".
4. iTunes song→album resolution can still pick a live/compilation release for ambiguous song-only rows; artist+karaoke filters exist but a confidence UI ("is this right?") would be better.
5. Mixed-unit imports (playlist + play history in one session) sum plays and tracks together in the stats line.
6. Price alerts, Discogs OAuth (sync wantlist/collection), Bandcamp/juno price scraping, and a "total crate cost by priority" planner are all unexplored.
